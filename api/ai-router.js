/* ═══════════════════════════════════════════════════════════
   ACADEMY — AI ROUTER
   Camada central de IA. Nenhuma parte da plataforma chama um
   provedor directamente — tudo passa aqui.

   Hierarquia (configurável em .env):
     🥇 PRIMARY_PROVIDER   → openai_direct (gpt-4o-mini via OpenRouter — pago, barato, rápido)
     🥈 SECONDARY_PROVIDER → existing_free_api (Groq — gratuito)
     🥉 TERTIARY_PROVIDER  → openrouter (modelos gratuitos — último recurso)

   REGRAS ABSOLUTAS:
   - openai_direct (gpt-4o-mini via OpenRouter, pago ~$0.15/1M) é SEMPRE tentado PRIMEIRO.
   - Se falhar → existing_free_api (Groq gratuito) → openrouter (modelos gratuitos).
   - Se todos os motores falharem → erro AI_INDISPONIVEL genérico
     (a causa técnica fica nos logs, nunca no cliente).
   - Chaves secretas nunca saem do servidor.
═══════════════════════════════════════════════════════════ */

const MODEL_TIERS = {
  cheap:    process.env.OPENROUTER_MODEL_CHEAP    || 'openai/gpt-4o-mini',
  balanced: process.env.OPENROUTER_MODEL_BALANCED || 'openai/gpt-4o-mini',
  strong:   process.env.OPENROUTER_MODEL_STRONG   || 'openai/gpt-4o',
};
export function modelForTier(tier) { return MODEL_TIERS[tier] || MODEL_TIERS.balanced; }

const COST_MAP = {
  'openai/gpt-4o-mini': { in: 0.15/1e6, out: 0.6/1e6 },
  'openai/gpt-4o': { in: 5/1e6, out: 15/1e6 },
  'openai/gpt-oss-20b:free': { in: 0, out: 0 },
  'google/gemma-4-31b-it:free': { in: 0, out: 0 },
};
export function estimateCost(model, usage) {
  const c = COST_MAP[model] || { in: 0, out: 0 };
  if (!usage) return { total: 0, status: 'UNKNOWN' };
  const total = (usage.prompt_tokens||0)*c.in + (usage.completion_tokens||0)*c.out;
  return { total, status: total>0 ? 'KNOWN' : 'UNKNOWN' };
}

const CFG = {
  /* Ordem: pago primeiro, mas com fallback automático se 503 — evita loop infinito
     SOMENTE_PAGO puro causava 503 em loop no Cap 2 quando OpenRouter quota 429 */
  primary   : 'openai_direct',
  secondary : 'existing_free_api',
  tertiary  : 'openrouter',
  timeoutMs : parseInt(process.env.AI_TIMEOUT_MS  || '90000', 10),
  maxRetries: parseInt(process.env.AI_MAX_RETRIES || '1', 10),
  ollamaTimeoutMs : parseInt(process.env.AI_TIMEOUT_OLLAMA_MS || '60000', 10),

  ollamaUrl    : process.env.OLLAMA_URL    || 'http://localhost:11434',
  ollamaModel  : process.env.OLLAMA_MODEL  || 'qwen2.5:1.5b',

  openrouterKey : process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '',
  openrouterUrl : 'https://openrouter.ai/api/v1',

  existingApiUrl   : process.env.EXISTING_FREE_API_URL   || 'https://api.groq.com/openai/v1',
  existingApiKey   : process.env.EXISTING_FREE_API_KEY   || process.env.GROQ_API_KEY || '',
  existingApiModel : process.env.EXISTING_FREE_API_MODEL || 'llama-3.3-70b-versatile',
};

/* Modelos gratuitos de qualidade reconhecida — ordem de preferência.
   Para pedidos JSON (json_object), os não-raciocinadores são tentados
   primeiro (respostas directas); os raziónadores ficam no fim como
   backup — devolvem texto excelente mas gastam tokens em CoT. */
const PREFERIDOS_FREE_JSON = [
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-lightning:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];
const PREFERIDOS_FREE = PREFERIDOS_FREE_JSON;
const DENY_MODELOS = /lyria|audio|image|video|clip|embed|safety|embedding|rerank|vl\b|code/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log   = (msg) => console.log(`[AI ROUTER] ${msg}`);
const warn  = (msg) => console.warn(`[AI ROUTER] ${msg}`);

/* Se foi pedido JSON e a resposta veio com preâmbulo de raciocínio
   (CoT), extrai o bloco JSON final — ou sinaliza falha para o router
   tentar outro modelo em vez de entregar lixo ao engine. */
function extrairBlocoJSON(texto) {
  if (!texto) return null;
  const m = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/* ── Cache de disponibilidade (evita sondar a cada chamada) ── */
const cache = new Map(); /* chave → { ts, val } */
function cacheGet(k, ttlMs) {
  const e = cache.get(k);
  if (e && Date.now() - e.ts < ttlMs) return e.val;
  return undefined;
}
function cacheSet(k, v) { cache.set(k, { ts: Date.now(), val: v }); }

/* ── Estado por provedor: cooldown após falhas repetidas ──
   Se um provedor falha N vezes seguidas, entra em cooldown —
   o router sabe que está indisponível ANTES de tentar de novo. */
const estadoProv = new Map(); /* pid → { falhas, cooldownAte } */
function provCooldownAtivo(pid) {
  const e = estadoProv.get(pid);
  return e && e.cooldownAte && Date.now() < e.cooldownAte;
}
function provRegistarFalha(pid) {
  const e = estadoProv.get(pid) || { falhas: 0, cooldownAte: 0 };
  e.falhas++;
  if (e.falhas >= 2) {
    e.cooldownAte = Date.now() + 2 * 60 * 1000; /* 2 min de cooldown */
    warn(`${pid}: ${e.falhas} falhas seguidas → cooldown de 5min`);
  }
  estadoProv.set(pid, e);
}
function provRegistarSucesso(pid) { estadoProv.set(pid, { falhas: 0, cooldownAte: 0 }); }

/* ═══════════════════════════════════════════════════════════
   PROVIDER: OLLAMA (modelo open source próprio)
═══════════════════════════════════════════════════════════ */
const ollama = {
  id: 'ollama',
  descricao: 'Motor local de código aberto',

  async available() {
    const c = cacheGet('ollama:avail', 20000);
    if (c !== undefined) return c;
    let ok = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      let r;
      try {
        r = await fetch(`${CFG.ollamaUrl}/api/tags`, { signal: ctrl.signal });
      } finally { clearTimeout(t); }
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        const modelos = (d.models || []).map(m => m.name);
        ok = modelos.length > 0 && (CFG.ollamaModel === 'auto' || modelos.some(m => m === CFG.ollamaModel || m.startsWith(CFG.ollamaModel.split(':')[0] + ':')));
        if (ok) log(`ollama disponível (${modelos.length} modelos locais)`);
        else warn(`ollama: modelo '${CFG.ollamaModel}' não encontrado localmente`);
      } else {
        warn(`ollama: HTTP ${r.status} em /api/tags`);
      }
    } catch (e) {
      warn(`ollama indisponível: ${e.name === 'AbortError' ? 'timeout' : 'sem ligação'}`);
    }
    cacheSet('ollama:avail', ok);
    return ok;
  },

  async generate(messages, opts = {}) {
    const corpo = {
      model: CFG.ollamaModel,
      messages,
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.max_tokens ?? 800,
      },
    };
    if (opts.response_format) corpo.format = 'json';
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CFG.ollamaTimeoutMs);
    let r;
    try {
      r = await fetch(`${CFG.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(t); }
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    const d = await r.json();
    const text = (d.message?.content || '').trim();
    if (!text || text.length <= 10) throw new Error('Ollama: resposta vazia');
    return { text, model: CFG.ollamaModel, usage: d.usage || null };
  },
};

/* ═══════════════════════════════════════════════════════════
   PROVIDER: OPENROUTER — SÓ MODELOS GRATUITOS
═══════════════════════════════════════════════════════════ */
function modeloGratuito(m) {
  if (/:(free|freemium)$/i.test(m.id)) return true;
  const p = m.pricing || {};
  return Number(p.prompt) === 0 && Number(p.completion) === 0;
}

const openrouter = {
  id: 'openrouter',
  descricao: 'Rede de modelos (apenas gratuitos)',

  configured() { return !!CFG.openrouterKey; },

  async available() {
    if (!CFG.openrouterKey) return false;
    const c = cacheGet('or:avail', 120000);
    if (c !== undefined) return c;
    let ok = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      let r;
      try {
        r = await fetch(`${CFG.openrouterUrl}/models`, {
          headers: { 'Authorization': `Bearer ${CFG.openrouterKey}` },
          signal: ctrl.signal,
        });
      } finally { clearTimeout(t); }
      ok = r.ok;
      if (!ok) warn(`openrouter: HTTP ${r.status} ao consultar catálogo`);
    } catch (e) {
      /* Último estado conhecido bom: se já tivemos catálogo, não
         descartamos o provedor por um timeout momentâneo. */
      const temCacheFree = cacheGet('or:free', 3600000);
      if (temCacheFree) { ok = true; warn(`openrouter: sonda falhou (${e.name === 'AbortError' ? 'timeout' : 'sem ligação'}) — a usar catálogo em cache`); }
      else warn(`openrouter indisponível: ${e.name === 'AbortError' ? 'timeout' : 'sem ligação'}`);
    }
    cacheSet('or:avail', ok);
    return ok;
  },

  /* Catálogo FREE actual: consulta → filtra → ordena por qualidade.
     Nunca inclui modelos pagos. */
  async listarFree() {
    const c = cacheGet('or:free', 300000);
    if (c) return c;
    if (!CFG.openrouterKey) return [];
    const r = await fetch(`${CFG.openrouterUrl}/models`, {
      headers: { 'Authorization': `Bearer ${CFG.openrouterKey}` },
    });
    if (!r.ok) return [];
    const d = await r.json();
    const candidatos = (d.data || [])
      .filter(m => modeloGratuito(m) && !DENY_MODELOS.test(m.id))
      .map(m => ({
        id: m.id,
        ctx: m.context_length || 0,
        maxOut: m.top_provider?.max_completion_tokens || 0,
      }));
    const rank = new Map(PREFERIDOS_FREE.map((id, i) => [id, i]));
    candidatos.sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : PREFERIDOS_FREE.length;
      const rb = rank.has(b.id) ? rank.get(b.id) : PREFERIDOS_FREE.length;
      if (ra !== rb) return ra - rb;
      return (b.ctx || 0) - (a.ctx || 0);
    });
    const lista = candidatos.slice(0, 12).map(m => m.id);
    /* Rede de segurança: meta-modelo que roteia entre os gratuitos */
    if (!lista.includes('openrouter/free')) lista.push('openrouter/free');
    log(`openrouter: ${lista.length} modelos gratuitos candidatos — ${lista.slice(0, 4).join(', ')}…`);
    cacheSet('or:free', lista);
    return lista;
  },

  async generate(messages, opts = {}) {
    const preferido = opts.model && /:free$|^openrouter\/free$/i.test(opts.model) ? opts.model : null;
    let lista = await this.listarFree();
    /* Pedidos JSON: candidatos não-raciocinadores primeiro. */
    if (opts.response_format && lista.length > 3) {
      const rankJ = new Map(PREFERIDOS_FREE_JSON.map((id, i) => [id, i]));
      lista = [...lista].sort((a, b) => {
        const ra = rankJ.has(a) ? rankJ.get(a) : PREFERIDOS_FREE_JSON.length;
        const rb = rankJ.has(b) ? rankJ.get(b) : PREFERIDOS_FREE_JSON.length;
        return ra - rb;
      });
    }
    if (preferido && lista.includes(preferido)) {
      lista = [preferido, ...lista.filter(m => m !== preferido)];
    }
    if (lista.length === 0) throw new Error('sem modelos gratuitos disponíveis');

    let aborts = 0;
    for (const model of lista) {
      if (aborts >= 2) throw new Error('múltiplos timeouts — desistir desta ronda');
      for (let tent = 0; tent <= CFG.maxRetries; tent++) {
        const t0 = Date.now();
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), CFG.timeoutMs);
          const corpo = {
            model, messages,
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.max_tokens ?? 4000,
            stream: false,
          };
          if (opts.response_format) corpo.response_format = opts.response_format;
          let resp;
          try {
            resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST', signal: ctrl.signal,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CFG.openrouterKey}`,
                'HTTP-Referer': 'https://academy-open.vercel.app',
                'X-Title': 'ACADEMY',
              },
              body: JSON.stringify(corpo),
            });
          } finally { clearTimeout(t); }
          if (!resp.ok) {
            const txt = await resp.text().catch(() => String(resp.status));
            throw new Error(`OpenRouter ${resp.status}: ${txt.slice(0, 200)}`);
          }
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content?.trim();
          if (!raw || raw.length <= 10) throw new Error('OpenRouter: resposta vazia');
          /* Gate JSON: se o pedido exigia JSON e a resposta é puro
             raciocínio (ou JSON truncado), falha para o próximo modelo. */
          if (opts.response_format) {
            const bloco = extrairBlocoJSON(raw);
            if (!bloco) throw new Error('modelo devolveu CoT sem JSON válido');
            cacheSet('or:lastgood', model);
            return { text: raw, model, usage: data.usage || null };
          }
          cacheSet('or:lastgood', model);
          return { text: raw, model, usage: data.usage || null };
        } catch (e) {
          const msgs = String(e?.message || e);
          if (/aborted/i.test(msgs)) aborts++;
          /* CoT repetido = o proveedor está a servir modelos pouco
             cooperativos com JSON hoje — desistir cedo desta ronda. */
          if (/sem JSON v/i.test(msgs) && aborts < 2) aborts++;
          const transit = /429|5\d\d|aborted/i.test(msgs);
          if (tent < CFG.maxRetries && transit && aborts < 2) { await sleep(2000 * (tent + 1)); continue; }
          warn(`openrouter: ${model} falhou após ${((Date.now() - t0) / 1000).toFixed(0)}s — ${msgs.slice(0, 120)}`);
          break; /* próximo modelo gratuito */
        }
      }
    }
    throw new Error('openrouter: nenhum modelo gratuito respondeu');
  },
};

/* ═══════════════════════════════════════════════════════════
   PROVIDER: API GRATUITA EXISTENTE (Groq por defeito)
═══════════════════════════════════════════════════════════ */
const existingFreeApi = {
  id: 'existing_free_api',
  descricao: 'API gratuita existente',

  configured() { return !!CFG.existingApiKey; },

  async available() {
    if (!CFG.existingApiKey) return false;
    const c = cacheGet('api:avail', 300000);
    if (c !== undefined) return c;
    let ok = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      let r;
      try {
        r = await fetch(`${CFG.existingApiUrl}/models`, {
          headers: { 'Authorization': `Bearer ${CFG.existingApiKey}` },
          signal: ctrl.signal,
        });
      } finally { clearTimeout(t); }
      ok = r.ok;
      if (!ok) warn(`api existente: HTTP ${r.status} ao consultar modelos`);
    } catch (e) {
      warn(`api existente indisponível: ${e.name === 'AbortError' ? 'timeout' : 'sem ligação'}`);
    }
    cacheSet('api:avail', ok);
    return ok;
  },

  async generate(messages, opts = {}) {
    const modeloPreferido = CFG.existingApiModel;
    const listaModelos = [modeloPreferido, 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b']
      .filter((m, i, arr) => m && arr.indexOf(m) === i);
    let ultimoErro = null;
    for (const model of listaModelos) {
      for (let tent = 0; tent <= 1; tent++) {
        const corpo = {
          model,
          messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.max_tokens ?? 4000,
          stream: false,
        };
        if (opts.response_format) corpo.response_format = opts.response_format;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), CFG.timeoutMs);
        let r;
        try {
          r = await fetch(`${CFG.existingApiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CFG.existingApiKey}`,
            },
            body: JSON.stringify(corpo),
            signal: ctrl.signal,
          });
        } finally { clearTimeout(t); }
        if (r.ok) {
          const d = await r.json().catch(() => ({}));
          const text = d?.choices?.[0]?.message?.content?.trim();
          if (text && text.length > 10) return { text, model, usage: d.usage || null };
          ultimoErro = new Error('API existente: resposta vazia');
          break;
        }
        const corpoErro = await r.text().catch(() => String(r.status));
        ultimoErro = new Error(`API existente ${r.status}: ${corpoErro.slice(0, 200)}`);
        /* json_validate_failed (JSON truncado por limite de tokens): a API
           rejeita o pedido — repetir SEM response_format deixa o engine
           extrair o JSON do texto (extrairJSON no engine.js). */
        if (r.status === 400 && /json_validate_failed|json.*(failed|invalid)/i.test(corpoErro) && corpo.response_format) {
          delete corpo.response_format;
          if (tent === 0) { await sleep(500); continue; }
          break;
        }
        /* 429/5xx transitório → repete o mesmo modelo; inválido → próximo */
        if (r.status === 429 || r.status >= 500) {
          if (tent === 0) { await sleep(1200); continue; }
          break;
        }
        break;
      }
    }
    throw ultimoErro || new Error('API existente: falha');
  },
};

/* ═══════════════════════════════════════════════════════════
   PROVIDER: OPENAI DIRECT — modelo pago barato (gpt-4o-mini)
   Último recurso quando todos os gratuitos falham.
   Acede via OpenRouter (não precisa de chave OpenAI separada).
   Custo: $0.15/1M input, $0.60/1M output (~0.05 Kz/página).
═══════════════════════════════════════════════════════════ */
const openaiDirect = {
  id: 'openai_direct',
  descricao: 'OpenAI gpt-4o-mini via OpenRouter (pago, barato)',

  configured() { return !!CFG.openrouterKey; },

  async available() {
    if (!CFG.openrouterKey) return false;
    const c = cacheGet('oai:avail', 300000);
    if (c !== undefined) return c;
    /* Se o OpenRouter está disponível, o gpt-4o-mini também está */
    const orOk = cacheGet('or:avail', 120000);
    if (orOk) { cacheSet('oai:avail', true); return true; }
    let ok = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      let r;
      try {
        r = await fetch(`${CFG.openrouterUrl}/models`, {
          headers: { 'Authorization': `Bearer ${CFG.openrouterKey}` },
          signal: ctrl.signal,
        });
      } finally { clearTimeout(t); }
      ok = r.ok;
    } catch {}
    cacheSet('oai:avail', ok);
    return ok;
  },

  async generate(messages, opts = {}) {
    const model = 'openai/gpt-4o-mini';
    const corpo = {
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 4000,
      stream: false,
    };
    if (opts.response_format) corpo.response_format = opts.response_format;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CFG.timeoutMs);
    let r;
    try {
      r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CFG.openrouterKey}`,
          'HTTP-Referer': 'https://academy-open.vercel.app',
          'X-Title': 'ACADEMY',
        },
        body: JSON.stringify(corpo),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(t); }
    if (!r.ok) {
      const txt = await r.text().catch(() => String(r.status));
      /* json_validate_failed: repetir SEM response_format */
      if (r.status === 400 && /json_validate_failed|json.*(failed|invalid)/i.test(txt) && corpo.response_format) {
        delete corpo.response_format;
        const r2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CFG.openrouterKey}`,
            'HTTP-Referer': 'https://academy-open.vercel.app',
            'X-Title': 'ACADEMY',
          },
          body: JSON.stringify(corpo),
          signal: ctrl.signal,
        });
        if (r2.ok) {
          const d = await r2.json().catch(() => ({}));
          const text = d?.choices?.[0]?.message?.content?.trim();
          if (text && text.length > 10) return { text, model, usage: d.usage || null };
        }
      }
      throw new Error(`OpenAI(via OR) ${r.status}: ${txt.slice(0, 200)}`);
    }
    const d = await r.json().catch(() => ({}));
    const text = d?.choices?.[0]?.message?.content?.trim();
    if (!text || text.length <= 10) throw new Error('OpenAI(via OR): resposta vazia');
    return { text, model, usage: d.usage || null };
  },
};

const PROVIDERS = { ollama, openrouter, existing_free_api: existingFreeApi, openai_direct: openaiDirect };

/* ═══════════════════════════════════════════════════════════
   ROUTER — chamada central
   Retry por provedor (CFG.maxRetries) + fallback na hierarquia.
   Prioridade: openai_direct (pago) → existing_free_api (grátis) → openrouter (grátis).
═══════════════════════════════════════════════════════════ */
function ordemProviders() {
  return [CFG.primary, CFG.secondary, CFG.tertiary].filter(Boolean);
}

async function generate(messages, opts = {}) {
  // Tier → modelo (CHEAP/BALANCED/STRONG) — sem quebrar chamadas antigas sem tier
  if (opts.tier && !opts.model) {
    const m = modelForTier(opts.tier);
    if (m) opts = { ...opts, model: m };
  }
  const ordem = ordemProviders();
  let ultimoErro = null;
  const t0 = Date.now();

  for (const pid of ordem) {
    const prov = PROVIDERS[pid];
    if (!prov) { warn(`provedor desconhecido: ${pid}`); continue; }
    if (provCooldownAtivo(pid)) { warn(`${pid} em cooldown — a saltar`); continue; }
    try {
      const ok = await prov.available();
      if (!ok) continue;
      const r = await prov.generate(messages, opts);
      provRegistarSucesso(pid);
      // Custo real quando provider retorna usage
      let costInfo = null;
      if (r.usage) {
        const est = estimateCost(r.model, r.usage);
        costInfo = { ...r.usage, estimated_cost: est.total, cost_status: est.status };
        log(`${pid} → ${r.model} · ${((Date.now() - t0) / 1000).toFixed(1)}s · ${r.usage.prompt_tokens}/${r.usage.completion_tokens} tok · $${est.total.toFixed(4)}`);
      } else {
        log(`${pid} → ${r.model} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
      return { text: r.text, provider: pid, model: r.model, usage: r.usage || null, cost: costInfo };
    } catch (e) {
      ultimoErro = e;
      provRegistarFalha(pid);
      warn(`${pid} falhou (${String(e.message || e).slice(0, 100)}) → próximo provedor`);
    }
  }

  const err = new Error('AI_INDISPONIVEL');
  err.generic = true;
  err.retry   = true;
  err.status  = 503;
  err.causa   = ultimoErro ? String(ultimoErro.message || ultimoErro).slice(0, 300) : 'todos os provedores indisponíveis';
  warn(`TODOS OS PROVEDORES FALHARAM — ${err.causa}`);
  throw err;
}

/* ═══════════════════════════════════════════════════════════
   HEALTH — para /ai/health (uso administrativo interno)
═══════════════════════════════════════════════════════════ */
async function health() {
  const out = {};
  for (const pid of Object.keys(PROVIDERS)) {
    const prov = PROVIDERS[pid];
    let ok = false, erro = null;
    try { ok = await prov.available(); } catch (e) { erro = String(e.message || e); }
    out[pid] = { configurado: prov.configured ? prov.configured() : true, ok, erro };
  }
  return {
    ordem: ordemProviders(),
    providers: out,
    ts: Date.now(),
  };
}

export { generate, health, ordemProviders, CFG };
