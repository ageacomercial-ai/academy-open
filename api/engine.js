/* =======================================================================
   ACADEMY ENGINE - SAAS BLINDADO (PRODUÇÃO)
   v75: Modular — prompts/schemas/engines importados de academic/
   OpenRouter + Gemini
======================================================================= */

import {
  PERFIL_NIVEL, PERFIL_AREA,
  detectarNivel, detectarArea, detectarContextoGeo,
  montarPromptCapitulo, montarPromptAST, montarPromptRetry,
  montarPromptReferencias, peneirarReferencias,
  montarPromptPlano, montarPromptEstrutura,
  montarPromptEdicaoSimples, montarPromptEdicaoDocumento,
  montarPromptCoerencia, montarPromptChat,
  parseReferencias, validarListaReferencias,
  CONFIDENCE_LEVELS,
  gerarDiagnostico, analisarInput,
  extrairAfirmacoes, validarAfirmacoes,
  analisarEstruturaArgumentativa, verificarCoerenciaArgumentativa,
  gerarScorecard, simularProfessor,
  gerarRelatorioIntegridade, determinarEstadoDocumento,
  analisarCobertura,
  verificarReferenciaOnline, verificarListaReferencias,
  criarSnapshot, listarSnapshots, obterSnapshot, reverterPara,
  guardarSnapshot, compararSnapshots,
} from '../academic/index.js';

const OR_SITE  = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://academy-open.vercel.app';
const OR_TITLE = 'ACADEMY';

/* ---------------- RATE LIMIT ---------------- */
const RATE = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const d = RATE.get(ip) || { count: 0, start: now };
  if (now - d.start > 60000) { RATE.set(ip, { count: 1, start: now }); return true; }
  if (d.count >= 25) return false;
  d.count++; RATE.set(ip, d); return true;
}

/* ---------------- CORS ---------------- */
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

/* ---------------- TRUNCAR ---------------- */
function truncar(texto, max) {
  if (!texto) return texto;
  const p = texto.split(/\s+/);
  if (p.length <= max) return texto;
  const c = p.slice(0, max).join(' ');
  const u = Math.max(c.lastIndexOf('. '), c.lastIndexOf('.\n'));
  return (u > c.length * 0.7 ? c.substring(0, u+1) : c).trim();
}

/* ================================================================
   AST REPAIR ENGINE — v72
================================================================ */
function repararAST(raw, capNum, capTit, subs) {
  let ast = null;
  if (raw && typeof raw === 'object') {
    ast = raw;
  } else if (typeof raw === 'string') {
    try { ast = JSON.parse(raw.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'').trim()); }
    catch (_) { ast = null; }
    if (!ast) {
      const m = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (m) try { ast = JSON.parse(m[1]); } catch (_) {}
    }
  }
  const base = {
    chapter_id : String(capNum),
    title      : capTit || `Capítulo ${capNum}`,
    status     : 'generated',
    generated_at: new Date().toISOString(),
    generated_by: 'academy-engine-v72',
    version    : 1,
    sections   : [],
  };
  if (!ast && typeof raw === 'string' && raw.length > 100) {
    const secs = [];
    const linhas = raw.split('\n').map(l => l.trim()).filter(Boolean);
    let secAtual = null;
    for (const linha of linhas) {
      const numMatch = linha.match(/^(\d+\.\d+(?:\.\d+)?)\s+(.+)/);
      if (numMatch && subs.some(s => linha.toLowerCase().includes(s.toLowerCase().substring(0, 15)))) {
        if (secAtual) secs.push(secAtual);
        secAtual = { section_id: `${capNum}.${numMatch[1]}`, title: numMatch[2], paragraphs: [] };
        continue;
      }
      if (!secAtual) {
        secAtual = { section_id: `${capNum}.1`, title: subs?.[0] || 'Introdução', paragraphs: [] };
      }
      if (linha.length > 20) secAtual.paragraphs.push(linha);
    }
    if (secAtual) secs.push(secAtual);
    if (secs.length > 0 && secs.some(s => s.paragraphs.length > 0)) {
      return { ...base, sections: secs, _repaired: true, _repair_reason: 'raw_text_parsed' };
    }
  }
  if (!ast) {
    const secsDefault = (Array.isArray(subs) && subs.length > 0 ? subs : [
      'Contextualização', 'Desenvolvimento', 'Análise Crítica'
    ]).map((s, i) => ({
      section_id  : `${capNum}.${i+1}`,
      title       : s,
      status      : 'empty',
      paragraphs  : [],
    }));
    return { ...base, sections: secsDefault, _repaired: true, _repair_reason: 'no_json' };
  }
  ast.chapter_id  = ast.chapter_id  || base.chapter_id;
  ast.title       = ast.title       || base.title;
  ast.status      = ast.status      || 'generated';
  ast.generated_at= ast.generated_at|| base.generated_at;
  ast.generated_by= ast.generated_by|| base.generated_by;
  ast.version     = ast.version     || 1;
  if (!Array.isArray(ast.sections) || ast.sections.length === 0) {
    ast.sections = base.sections;
    ast._repaired = true;
    ast._repair_reason = 'missing_sections';
  } else {
    ast.sections = ast.sections.map((sec, i) => {
      if (!sec.section_id) sec.section_id = `${capNum}.${i+1}`;
      if (!sec.title) sec.title = subs?.[i] || `${capNum}.${i+1}`;
      if (!Array.isArray(sec.paragraphs)) {
        if (typeof sec.content === 'string' && sec.content.trim()) {
          sec.paragraphs = sec.content.split('\n\n')
            .map(p => p.trim()).filter(p => p.length > 20);
        } else {
          sec.paragraphs = [];
        }
        ast._repaired = true;
        ast._repair_reason = 'paragraphs_repaired';
      }
      sec.paragraphs = sec.paragraphs
        .map(p => typeof p === 'string' ? p.trim() : '')
        .filter(p => p.length > 15);
      return sec;
    });
  }
  return ast;
}

function validarAST(ast) {
  if (!ast || !ast.sections || !Array.isArray(ast.sections)) return false;
  if (ast.sections.length === 0) return false;
  return ast.sections.some(s =>
    Array.isArray(s.paragraphs) && s.paragraphs.length >= 1
  );
}

/* ================================================================
   DOCUMENT HEALTH ENGINE — v72
================================================================ */
function calcularDocumentHealth(ast, nivel) {
  const issues = [];
  let score = 100;
  const secsVazias = ast.sections?.filter(
    s => !s.paragraphs || s.paragraphs.length === 0
  ) || [];
  if (secsVazias.length > 0) {
    score -= secsVazias.length * 15;
    issues.push({
      severity : 'error',
      code     : 'EMPTY_SECTIONS',
      message  : `${secsVazias.length} subtópico(s) sem conteúdo`,
      sections : secsVazias.map(s => s.section_id),
    });
  }
  const parasMinimos = { 'ensino médio': 60, 'licenciatura': 80, 'mestrado': 100, 'doutoramento': 120 };
  const minChars = parasMinimos[nivel] || 80;
  let parasCurtos = 0;
  (ast.sections || []).forEach(s =>
    (s.paragraphs || []).forEach(p => { if ((p||'').length < minChars) parasCurtos++; })
  );
  if (parasCurtos > 2) {
    score -= Math.min(20, parasCurtos * 4);
    issues.push({
      severity : 'warning',
      code     : 'SHORT_PARAGRAPHS',
      message  : `${parasCurtos} parágrafos abaixo do mínimo para ${nivel}`,
    });
  }
  if (ast._repaired) {
    score -= 10;
    issues.push({
      severity : 'warning',
      code     : 'AST_REPAIRED',
      message  : `Estrutura reconstruída automaticamente (razão: ${ast._repair_reason})`,
    });
  }
  score = Math.max(0, score);
  return {
    health  : score,
    issues,
    label   : score >= 85 ? 'Saudável' : score >= 60 ? 'Aceitável' : 'Necessita revisão',
  };
}

/* ================================================================
   READINESS SCORE — v72
================================================================ */
function calcularReadiness(ast, nivel, geoCtx) {
  const blockers = [];
  const warnings = [];
  if (!validarAST(ast)) {
    blockers.push('Capítulo sem conteúdo gerado');
  }
  const totalParas = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).length, 0
  );
  const minParas = { 'ensino médio': 6, 'licenciatura': 9, 'mestrado': 12, 'doutoramento': 15 };
  if (totalParas < (minParas[nivel] || 6)) {
    blockers.push(`Parágrafos insuficientes: ${totalParas} (mínimo: ${minParas[nivel] || 6})`);
  }
  if (ast._repaired) {
    warnings.push('Estrutura foi reconstruída automaticamente');
  }
  if (geoCtx === 'global' && ast._angola_count > 10) {
    warnings.push('Texto contém referências geográficas inesperadas');
  }
  const ready = blockers.length === 0;
  return {
    ready,
    verdict : ready ? 'Pronto para entrega' : 'Não recomendado para entrega',
    blockers,
    warnings,
  };
}

/* ================================================================
   CONFIDENCE SCORE — v73
================================================================ */
function calcularConfidence(ast, meta) {
  let score = 100;
  const factores = [];
  if (ast._repaired || meta.ast_repaired) {
    const penalty = meta.repair_reason === 'no_json' ? 25 : 12;
    score -= penalty;
    factores.push({ factor: 'ast_repaired', impact: -penalty, reason: meta.repair_reason });
  }
  if (meta.retry_count > 0) {
    const penalty = meta.retry_count * 8;
    score -= Math.min(penalty, 20);
    factores.push({ factor: 'retries', count: meta.retry_count, impact: -Math.min(penalty, 20) });
  }
  const secsVazias = (ast.sections || []).filter(
    s => !s.paragraphs || s.paragraphs.length === 0
  ).length;
  if (secsVazias > 0) {
    score -= secsVazias * 10;
    factores.push({ factor: 'empty_sections', count: secsVazias, impact: -secsVazias * 10 });
  }
  const totalParas = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).length, 0
  );
  if (totalParas < 6) {
    score -= 15;
    factores.push({ factor: 'low_paragraph_count', count: totalParas, impact: -15 });
  }
  if (meta.generation_time_ms > 60000) {
    score -= 5;
    factores.push({ factor: 'slow_generation', ms: meta.generation_time_ms, impact: -5 });
  }
  score = Math.max(0, score);
  return {
    confidence : score,
    label      : score >= 85 ? 'Alta' : score >= 65 ? 'Média' : 'Baixa',
    factores,
  };
}

/* ================================================================
   TELEMETRIA — v73
================================================================ */
async function registarTelemetria(payload) {
  const record = {
    ts               : new Date().toISOString(),
    tema             : payload.tema,
    nivel            : payload.nivel,
    area             : payload.area,
    tipo             : payload.tipo,
    cap_num          : payload.cap_num,
    ast_generated    : payload.ast_generated,
    ast_repaired     : payload.ast_repaired     || false,
    repair_reason    : payload.repair_reason    || null,
    retry_count      : payload.retry_count      || 0,
    health           : payload.health           || null,
    confidence       : payload.confidence       || null,
    ready            : payload.ready            || false,
    generation_time_ms: payload.generation_time_ms || 0,
    pages_requested  : payload.pages_requested  || null,
    word_count       : payload.word_count       || 0,
    model_used       : payload.model_used       || 'unknown',
  };
  console.log('[TELEMETRIA v73]', JSON.stringify(record));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 5000);
  try {
    await fetch(`${url}/rest/v1/academy_ai_logs`, {
      method  : 'POST',
      signal  : ctrl.signal,
      headers : {
        'Content-Type'  : 'application/json',
        'apikey'        : key,
        'Authorization' : `Bearer ${key}`,
        'Prefer'        : 'return=minimal',
      },
      body: JSON.stringify(record),
    });
  } catch (_) {}
  finally { clearTimeout(t); }
}

/* ================================================================
   COMPLETENESS SCORE — v74
================================================================ */
function calcularCompleteness(ast, palavrasAlvo, totalCaps, nivelKey) {
  const dimensoes = {};
  const totalPalavras = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).join(' ').split(/\s+/).filter(Boolean).length, 0
  );
  const coberturaRatio = Math.min(1, totalPalavras / Math.max(palavrasAlvo, 1));
  dimensoes.paginas = Math.round(coberturaRatio * 100);
  const secCounts = (ast.sections || []).map(s => (s.paragraphs || []).length);
  const minPorSec = { 'ensino médio': 3, 'licenciatura': 4, 'mestrado': 5, 'doutoramento': 6 };
  const min = minPorSec[nivelKey] || 4;
  const densidadeRatio = secCounts.length > 0
    ? secCounts.reduce((a, n) => a + Math.min(1, n / min), 0) / secCounts.length
    : 0;
  dimensoes.densidade = Math.round(densidadeRatio * 100);
  const secsComConteudo = (ast.sections || []).filter(s => (s.paragraphs || []).length > 0).length;
  const totalSecs = Math.max((ast.sections || []).length, 1);
  dimensoes.cobertura = Math.round((secsComConteudo / totalSecs) * 100);
  const todasParas = (ast.sections || []).flatMap(s => s.paragraphs || []);
  const charsMedios = todasParas.length > 0
    ? todasParas.reduce((a, p) => a + (p || '').length, 0) / todasParas.length
    : 0;
  const charMin = { 'ensino médio': 200, 'licenciatura': 300, 'mestrado': 400, 'doutoramento': 500 };
  dimensoes.profundidade = Math.min(100, Math.round((charsMedios / (charMin[nivelKey] || 300)) * 100));
  const score = Math.round(
    dimensoes.paginas    * 0.35 +
    dimensoes.densidade  * 0.25 +
    dimensoes.cobertura  * 0.25 +
    dimensoes.profundidade * 0.15
  );
  return {
    completeness : score,
    label        : score >= 85 ? 'Completo' : score >= 65 ? 'Parcial' : 'Superficial',
    dimensoes,
    palavras     : _totalWords(ast),
    paginas_est  : Math.round(_totalWords(ast) / 320 * 10) / 10,
  };
}

function _totalWords(ast) {
  return (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).join(' ').split(/\s+/).filter(Boolean).length, 0
  );
}

/* ================================================================
   ISSUE ACTIONS — v74
================================================================ */
const ISSUE_ACTIONS = {
  EMPTY_SECTIONS     : { label: 'Regenerar secções vazias',   acao: 'regenerar_capitulo',  auto: true  },
  SHORT_PARAGRAPHS   : { label: 'Enriquecer capítulo',        acao: 'editar_texto',         auto: true  },
  AST_REPAIRED       : { label: 'Regenerar capítulo',          acao: 'regenerar_capitulo',  auto: false },
  NO_REFERENCES      : { label: 'Gerar referências',           acao: 'gerar_capitulo_referencias', auto: true },
  NO_CONCLUSION      : { label: 'Gerar conclusão',             acao: 'gerar_capitulo',       auto: false },
  NO_INTRODUCTION    : { label: 'Gerar introdução',            acao: 'gerar_capitulo',       auto: false },
  LOW_PARAGRAPH_COUNT: { label: 'Expandir conteúdo',          acao: 'editar_texto',         auto: true  },
};

function enriquecerIssuesComAccoes(issues) {
  return (issues || []).map(issue => ({
    ...issue,
    action: ISSUE_ACTIONS[issue.code] || null,
  }));
}

/* ---------------- HANDLER ---------------- */
export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip)) return res.status(429).json({ ok:false, error:'RATE_LIMIT' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok:false, error:'INVALID_JSON' }); }

  const action    = body?.action || '';
  const payload   = body?.payload || {};
  /* Engine opts — propagado globalmente para todas as calls a callAI */
  const ac_engine = payload.ac_engine || 'openrouter';
  const ac_model  = payload.ac_model  || 'google/gemini-2.5-flash-lite';
  globalThis.__ac_engine = ac_engine;
  globalThis.__ac_model  = ac_model;

  try {
    switch (action) {
      case 'ping':
        return res.json({ ok:true, action:'ping', data:{ resposta:'pong', pong:true, ts:Date.now(), site:OR_SITE, openrouter:!!process.env.OPENROUTER_API_KEY } });
      case 'chat':
        return res.json(ok('chat', await doChat(payload)));
      case 'generate_lesson':
      case 'gerar_capitulo':
        return res.json(ok(action, await doCapitulo(payload)));
      case 'gerar_capitulo_referencias':
      case 'gerar_referencias':
        return res.json(ok(action, await doReferencias(payload)));
      case 'regenerar_capitulo':
        return res.json(ok(action, await doCapitulo({ ...payload, regenerar:true })));
      case 'plano_academico':
        return res.json(ok(action, await doPlano(payload)));
      case 'estrutura_academica':
        return res.json(ok(action, await doEstrutura(payload)));
      case 'editar_texto':
        return res.json(ok(action, await doEditar(payload)));
      case 'verificar_coerencia':
        return res.json(ok(action, await doCoerencia(payload)));
      case 'diagnostico_academico':
        return res.json(ok(action, doDiagnostico(payload)));
      case 'extract_evidencias':
        return res.json(ok(action, doExtractEvidencias(payload)));
      case 'verificar_argumentacao':
        return res.json(ok(action, doVerificarArgumentacao(payload)));
      case 'gerar_scorecard':
        return res.json(ok(action, doGerarScorecard(payload)));
      case 'analisar_documento':
        return res.json(ok(action, doAnalisarDocumento(payload)));
      case 'verificar_referencias':
        return res.json(ok(action, await doVerificarReferencias(payload)));
      case 'gerar_capa':
        return res.json(ok(action, { resposta: JSON.stringify({ capa:{ titulo:payload.tema||'', tipo:payload.tipoTrabalho||'' } }) }));
      case 'verificar_admin':
        return res.json(ok(action, await doVerificarAdmin(payload)));
      case 'gerar_mea':
      case 'mea_grafico':
      case 'mea_tabela':
      case 'mea_esquema':
        return res.json(ok(action, await doMEA(action, payload)));
      case 'save_history':
        return res.json(ok(action, await doSaveHistory(payload)));
      case 'get_history':
        return res.json(ok(action, await doGetHistory(payload)));
      case 'criar_versao':
        return res.json(ok(action, doCriarVersao(payload)));
      case 'listar_versoes':
        return res.json(ok(action, doListarVersoes(payload)));
      case 'reverter_versao':
        return res.json(ok(action, doReverterVersao(payload)));
      case 'comparar_versoes':
        return res.json(ok(action, doCompararVersoes(payload)));
      case 'get_stock':
        return res.json(ok(action, { items:[] }));
      case 'setup_tables':
        return res.json(ok('setup_tables', await doSetupTables()));
      case '__health':
        return res.json(ok('__health', await doHealthCheck()));
      case '__diagnose':
        return res.json({ ok:true, action:'__diagnose', data:{
          hasOpenRouterKey:!!process.env.OPENROUTER_API_KEY,
          hasSupabaseUrl:!!process.env.SUPABASE_URL,
          hasSupabaseKey:!!process.env.SUPABASE_SERVICE_KEY,
          supabaseUrl: (process.env.SUPABASE_URL||'').substring(0,30),
          hasAdminPin:!!process.env.ADMIN_PIN,
          adminPinLen: (process.env.ADMIN_PIN||'').length,
          site: OR_SITE,
          node: process.version,
          platform: process.platform,
          memory: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE||'?',
          region: process.env.VERCEL_REGION||'?',
          tables_created: true,
          version: 'v15',
        }});
      default:
        return res.status(400).json({ ok:false, error:'UNKNOWN_ACTION', action });
    }
  } catch (err) {
    console.error('[ENGINE v66]', action, err.message);
    return res.status(500).json({ ok:false, error:'INTERNAL_ERROR', detail:err.message.substring(0,200) });
  }
}

/* ---------------- VERIFICAR ADMIN ---------------- */
async function doVerificarAdmin(p) {
  const pinRecebido = String(p?.pin || '').trim();
  const pinCorreto  = String(process.env.ADMIN_PIN || '').trim();
  if (!pinCorreto) {
    console.warn('[ADMIN] ADMIN_PIN não configurado nas variáveis de ambiente da Vercel.');
    return { resposta: { ok:false } };
  }
  const autorizado = pinRecebido.length > 0 && pinRecebido === pinCorreto;
  return { resposta: { ok: autorizado } };
}

/* ---------------- CHAT ---------------- */
async function doChat(p) {
  const pedido = (p.pedido||'').substring(0,2000);
  if (!pedido) throw new Error('pedido obrigatório');
  const hist = (Array.isArray(p.historico)?p.historico:[]).slice(-8)
    .map(m => ({ role:m.role==='assistant'?'assistant':'user', content:String(m.content||'').substring(0,800) }));
  const engineUsed = globalThis.__ac_engine || 'openrouter';
  const modelUsed  = globalThis.__ac_model  || 'google/gemini-2.5-flash-lite';
  const conf = montarPromptChat(null, hist, pedido, p.tema, p.tipoTrabalho);
  const resposta = await callAI([
    { role:'system', content: conf.system },
    ...hist,
    { role:'user', content:pedido },
  ], { max_tokens: conf.maxTokens });
  console.log(`[CHAT] engine=${engineUsed} model=${modelUsed}`);
  return { resposta, _engine: engineUsed, _model: modelUsed };
}

/* ---------------- CAPÍTULO (v65: estratificado) ---------------- */
async function doCapitulo(p) {
  const tema      = (p.tema||'').substring(0,300);
  const tipo      = (p.tipoTrabalho||'Trabalho Académico').substring(0,100);
  const nivel     = (p.nivel||'').substring(0,80);
  const inst      = (p.inst||'').substring(0,100);
  const prof      = (p.prof||'').substring(0,100);
  const area      = (p.area||'').substring(0,100);
  const capNum    = parseInt(p.capNum)||1;
  const capTit    = (p.capTitulo||'').substring(0,200);
  const totalCaps = parseInt(p.totalCaps)||parseInt(p.totalPags)||4;
  const totalPags = parseInt(p.totalPags)||15;
  const capSubs   = (Array.isArray(p.capSubs)?p.capSubs:[]).slice(0,8).map(s=>String(s).substring(0,150));

  if (!tema||!capTit) throw new Error('tema e capTitulo obrigatórios');
  const _startTime = Date.now();
  let retryCount = 0;

  const PAGINAS_FIXAS = 3;
  const PALAVRAS_POR_PAGINA = 320;
  const paginasConteudo = Math.max(totalPags - PAGINAS_FIXAS, 1);
  const palavrasCalc = Math.round((paginasConteudo * PALAVRAS_POR_PAGINA) / totalCaps);
  const palavras = Math.min(Math.max(parseInt(p.palavrasPorCap)||palavrasCalc, 200), 4000);

  const nivelKey  = detectarNivel(nivel);
  const areaKey   = detectarArea(tema, p.area);
  const pNivel    = PERFIL_NIVEL[nivelKey];
  const pArea     = PERFIL_AREA[areaKey];
  const geoCtx    = detectarContextoGeo(tema, p.pais);

  const maxTok = Math.min(Math.max(Math.round(palavras*1.8), 600), 12000);

  const prompt = montarPromptCapitulo({
    tema, tipo, nivel, inst, prof, area,
    capNum, capTit, totalCaps, totalPags, capSubs,
    nivelKey, areaKey, pNivel, pArea,
    geoCtx: detectarContextoGeo(tema, p.pais),
    palavras, subs: capSubs.map((s,i) => `${capNum}.${i+1} ${s}`).join('\n') ||
      `${capNum}.1 Contextualização\n${capNum}.2 Desenvolvimento\n${capNum}.3 Análise crítica`,
    maxTok, instrucaoSubtitulos: p.instrucaoSubtitulos,
  });

  const promptAST = prompt + montarPromptAST(capNum, capTit, palavras);

  let r1 = await callAI([{ role:'user', content:promptAST }], { max_tokens:maxTok, temperature:0.65 });
  let astRaw = null;
  try { astRaw = extrairJSON(r1); } catch (_) {}
  let rawFallback = r1;

  if (!validarAST(astRaw)) {
    console.warn(`[AST v73] T1 falhou — retry simplificado — cap ${capNum}`);
    retryCount++;
    const promptSimples = montarPromptRetry(capNum, capTit, tema, capSubs);
    const r2 = await callAI([{ role:'user', content:promptSimples }], { max_tokens:maxTok, temperature:0.5 });
    rawFallback = r2;
    try { astRaw = extrairJSON(r2); } catch (_) {}
  }

  const ast = repararAST(astRaw || rawFallback, capNum, capTit, capSubs);
  if (ast._repaired) {
    console.warn(`[AST v72] Reparado — cap ${capNum} — razão: ${ast._repair_reason}`);
  }

  const health   = calcularDocumentHealth(ast, nivelKey);
  const readiness = calcularReadiness(ast, nivelKey, geoCtx);

  ast.version      = (ast.version || 0) + 1;
  ast.generated_by = 'academy-engine-v73';
  ast.generated_at = new Date().toISOString();
  ast.retry_count  = retryCount;

  const confidence = calcularConfidence(ast, {
    retry_count       : retryCount,
    ast_repaired      : ast._repaired || false,
    repair_reason     : ast._repair_reason || null,
    generation_time_ms: Date.now() - _startTime,
  });

  const totalWords = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).join(' ').split(/\s+/).length, 0
  );
  registarTelemetria({
    tema, nivel, area: areaKey, tipo, cap_num: capNum,
    ast_generated      : true,
    ast_repaired       : ast._repaired || false,
    repair_reason      : ast._repair_reason || null,
    retry_count        : retryCount,
    health             : health.health,
    confidence         : confidence.confidence,
    ready              : readiness.ready,
    generation_time_ms : Date.now() - _startTime,
    pages_requested    : totalPags,
    word_count         : totalWords,
    model_used         : 'openrouter/google/gemini-2.5-flash-lite',
  });

  const completeness = calcularCompleteness(
    ast, palavras * (capSubs.length || 3), totalCaps, nivelKey
  );

  health.issues = enriquecerIssuesComAccoes(health.issues);

  const firstPassSuccess = retryCount === 0 && !ast._repaired;
  registarTelemetria({
    tema, nivel, area: areaKey, tipo, cap_num: capNum,
    ast_generated      : true,
    ast_repaired       : ast._repaired || false,
    repair_reason      : ast._repair_reason || null,
    retry_count        : retryCount,
    first_pass_success : firstPassSuccess,
    health             : health.health,
    confidence         : confidence.confidence,
    completeness       : completeness.completeness,
    ready              : readiness.ready,
    generation_time_ms : Date.now() - _startTime,
    pages_requested    : totalPags,
    word_count         : completeness.palavras,
    model_used         : 'openrouter/google/gemini-2.5-flash-lite',
  });

  return {
    resposta    : ast,
    ast         : true,
    health,
    readiness,
    confidence,
    completeness,
    _guaranteed : true,
  };
}

/* ---------------- REFERÊNCIAS (v2 — estruturadas com confiança) ---------------- */
async function doReferencias(p) {
  const tema  = (p.tema||'').substring(0,300).trim();
  if (!tema) throw new Error('tema obrigatório');
  const tipo  = (p.tipoTrabalho||'Trabalho Académico').substring(0,100);
  const nivel = (p.nivel||'').substring(0,80);
  const totalPags = parseInt(p.totalPags) || 15;

  const promptRef = montarPromptReferencias({
    tema, tipo, nivel, area: p.area, pais: p.pais, totalPags,
  });

  const montarPrompt = (reforcar) => promptRef.promptPadrao(reforcar);

  let bruta = await callAI([{ role:'user', content: montarPrompt(false) }], { max_tokens:2500, temperature:0.4 });
  let peneira = peneirarReferencias(bruta);

  if (peneira.validas.length < promptRef.MIN_VALIDAS) {
    console.warn(`[Referências] ${peneira.validas.length}/${promptRef.numRefs} válidas — retry reforçado`);
    const bruta2 = await callAI([{ role:'user', content: montarPrompt(true) }], { max_tokens:2500, temperature:0.35 });
    const peneira2 = peneirarReferencias(bruta2);
    if (peneira2.validas.length > peneira.validas.length) peneira = peneira2;
  }

  const parseResult = parseReferencias(peneira.texto);
  const validacao = validarListaReferencias(parseResult.validas);

  /* Estruturar cada referência com confiança */
  const refsEstruturadas = validacao.resultados.map(r => ({
    raw:       r.estruturada.raw,
    author:    r.estruturada.author,
    year:      r.estruturada.year,
    confidence: r.valida
      ? CONFIDENCE_LEVELS.PARTIALLY_VERIFIED
      : CONFIDENCE_LEVELS.UNVERIFIED,
    issues:    r.issues,
  }));

  return {
    resposta:          peneira.texto || 'Nenhuma referência válida gerada.',
    referencias_validas: peneira.validas.length,
    referencias_pedidas: promptRef.numRefs,
    referencias_rejeitadas: peneira.invalidas,
    referencias_estruturadas: refsEstruturadas,
    taxa_validade:     validacao.taxaValidade,
  };
}

/* ---------------- VERIFICAR REFERÊNCIAS (online) ---------------- */
async function doVerificarReferencias(p) {
  const referencias = Array.isArray(p.referencias) ? p.referencias : [];

  if (referencias.length === 0) {
    return { verificadas: [], total: 0, taxaVerificacao: 0, aviso: 'Nenhuma referência fornecida.' };
  }

  const estruturadas = referencias.map(r => {
    const raw = r.raw || r;
    const anoMatch = raw.match(/\((\d{4})\)/);
    const year = anoMatch ? parseInt(anoMatch[1]) : null;
    const autorMatch = raw.match(/^([A-ZÀ-Ü][^,]+,\s*[A-Z\.]+\s*(?:&amp;\s*[A-ZÀ-Ü][^,]+,\s*[A-Z\.]+\s*)*)/);
    const author = autorMatch ? autorMatch[1].trim() : null;
    const title = r.title || extrairTituloRef(raw);
    const doi = r.doi || extrairDoiRef(raw);
    const isbn = r.isbn || extrairIsbnRef(raw);
    return { raw, author, year, title, doi, isbn };
  });

  const resultado = await verificarListaReferencias(estruturadas);

  return {
    verificadas: resultado.resultados,
    total: resultado.total,
    verified: resultado.verified,
    partiallyVerified: resultado.partiallyVerified,
    needsReview: resultado.needsReview,
    unverified: resultado.unverified,
    taxaVerificacao: Math.round(resultado.taxaVerificacao * 100),
  };
}

/* Helpers locais para extrair dados de referências (sem depender de schemas) */
function extrairTituloRef(raw) {
  const limpo = raw.replace(/^[A-ZÀ-Ü][^,]+,\s*[A-Z\.]+\s*/g, '');
  const match = limpo.match(/\(\d{4}\)\.\s*(.+?)(?:\.\s+(?:Editora|Universidade|Tese|Dissertação|Relatório|Working Paper)|\.\s*$|$)/);
  return match ? match[1].trim() : '';
}

function extrairDoiRef(raw) {
  const match = raw.match(/(?:doi|DOI)[:\s]*([^.\s]+)/);
  if (match) return match[1].trim();
  const urlMatch = raw.match(/doi\.org\/([^\s.]+)/);
  return urlMatch ? urlMatch[1].trim() : null;
}

function extrairIsbnRef(raw) {
  const cleaned = raw.replace(/[-\s]/g, '');
  const match = cleaned.match(/(?:ISBN|isbn)[:\s]*((?:97[89])?\d{9}[\dX])/);
  return match ? match[1] : null;
}

/* ---------------- VERSÕES DE DOCUMENTO (imutável) ---------------- */
function doCriarVersao(p) {
  const state = {
    secs: p.secs || [],
    cfg: p.cfg || {},
    diagnostic: p.diagnostic || null,
    refs: p.refs || [],
    qual: p.qual || null,
    plano: p.plano || null,
    est: p.est || null,
    academicAnalysis: p.academicAnalysis || null,
    refVerification: p.refVerification || null,
  };
  const snapshot = criarSnapshot(state, {
    source: p.source || 'manual_save',
    reason: p.reason || '',
    docId: p.docId || null,
    parentVersion: p.parentVersion || null,
  });
  return { versao: snapshot, aviso: `Versão ${snapshot.id} criada.` };
}

function doListarVersoes(p) {
  const storage = { versoes: Array.isArray(p.versoes) ? p.versoes : [] };
  const list = listarSnapshots(p.docId || null, storage);
  return { versoes: list };
}

function doReverterVersao(p) {
  const storage = { versoes: Array.isArray(p.versoes) ? p.versoes : [] };
  const snapshot = obterSnapshot(p.versionId, storage);
  if (!snapshot) return { error: 'Versão não encontrada.', ok: false };
  const data = reverterPara(snapshot);
  return { ok: true, estado: data, versao: snapshot.id };
}

function doCompararVersoes(p) {
  const storage = { versoes: Array.isArray(p.versoes) ? p.versoes : [] };
  const snapA = obterSnapshot(p.versionA, storage);
  const snapB = obterSnapshot(p.versionB, storage);
  if (!snapA || !snapB) {
    return { error: 'Uma ou ambas as versões não encontradas.', ok: false };
  }
  const diff = compararSnapshots(snapA, snapB);
  return { ok: true, diff, de: p.versionA, para: p.versionB };
}

/* ---------------- PLANO ACADÉMICO ---------------- */
async function doPlano(p) {
  const tema = (p.tema||'').substring(0,300);
  if (!tema) throw new Error('tema obrigatório');
  const r = await callAI([{ role:'user', content: montarPromptPlano(tema, p.tipoTrabalho, p.nivel) }],
    { max_tokens:600, temperature:0.4 });
  return { resposta: extrairJSON(r) };
}

/* ---------------- ESTRUTURA ACADÉMICA ---------------- */
async function doEstrutura(p) {
  const tema = (p.tema||'').substring(0,300);
  if (!tema) throw new Error('tema obrigatório');
  const pags = Math.min(Math.max(parseInt(p.totalPags)||15, 5), 100);
  const r = await callAI([{ role:'user', content: montarPromptEstrutura(tema, p.tipoTrabalho, p.nivel, pags, p.objetivo) }],
    { max_tokens:1000, temperature:0.4 });
  return { resposta: extrairJSON(r) };
}

/* ---------------- EDITAR TEXTO ---------------- */
async function doEditar(p) {
  const texto  = (p.texto||'').substring(0,8000);
  const subacao = p.subacao||p.acao||'melhorar';
  if (!texto) throw new Error('texto obrigatório');

  if (subacao === 'editar_documento_completo') {
    const prompt = montarPromptEdicaoDocumento(p.pedido, texto);
    const r = await callAI([{ role:'user', content: prompt }],
      { max_tokens:4000, temperature:0.3 });
    let json;
    try {
      const m = r.match(/```json\n?([\s\S]*?)\n?```/);
      json = JSON.parse(m ? m[1] : r);
    } catch { json = { operacoes: [] }; }
    return json;
  }

  const r = await callAI([{ role:'user', content: montarPromptEdicaoSimples(subacao, texto) }],
    { max_tokens:4000, temperature:0.5 });
  return { resposta: r };
}

/* ---------------- VERIFICAR COERÊNCIA ---------------- */
async function doCoerencia(p) {
  const a = (p.introTexto||p.textoA||'').substring(0,2000);
  const b = (p.concTexto||p.textoB||'').substring(0,2000);
  if (!a||!b) throw new Error('textos obrigatórios');
  const r = await callAI([{ role:'user', content: montarPromptCoerencia(a, b) }],
    { max_tokens:600, temperature:0.3 });
  return { resposta: extrairJSON(r) };
}

/* ---------------- DIAGNÓSTICO ACADÉMICO ---------------- */
function doDiagnostico(p) {
  const diagnostico = gerarDiagnostico(p);
  return { resposta: diagnostico };
}

/* ---------------- EXTRAIR EVIDÊNCIAS ---------------- */
function doExtractEvidencias(p) {
  const capitulos = Array.isArray(p.capitulos) ? p.capitulos : [];
  const allClaims = capitulos.map((cap, idx) => {
    const texto = typeof cap === 'string' ? cap : (cap.conteudo || cap.texto || '');
    return extrairAfirmacoes(texto, idx);
  }).flat();

  const validated = validarAfirmacoes(allClaims);
  return {
    resposta: validated,
    total: validated.length,
    validos: validated.filter(v => v.validation?.valido).length,
  };
}

/* ---------------- VERIFICAR ARGUMENTAÇÃO ---------------- */
function doVerificarArgumentacao(p) {
  const capitulos = Array.isArray(p.capitulos) ? p.capitulos : [];
  const estrutura = analisarEstruturaArgumentativa(capitulos);
  const analise = verificarCoerenciaArgumentativa(estrutura);
  return {
    resposta: {
      estrutura,
      analise,
    },
  };
}

/* ---------------- SCORECARD DE QUALIDADE ---------------- */
function doGerarScorecard(p) {
  const scorecard = gerarScorecard(p);
  const simulacao = simularProfessor({ metadata: { topic: p.topic }, _scoreData: p });
  return {
    resposta: {
      scorecard,
      simulacao,
    },
  };
}

/* ---------------- ANALISAR DOCUMENTO (orquestrador) ---------------- */
function doAnalisarDocumento(p) {
  const capitulos = Array.isArray(p.capitulos) ? p.capitulos : [];
  const diagnostic = p.diagnostic || null;

  /* Normalizar capítulos para o formato estruturado que os engines esperam */
  const normalizedChapters = capitulos.map((cap) => {
    if (cap.sections) return cap; /* já está no formato estruturado */
    const text = cap.c || cap.conteudo || cap.texto || '';
    return {
      title: cap.titulo || cap.title || 'Capítulo',
      sections: text ? [{ title: 'Conteúdo', paragraphs: text.split('\n\n').filter(Boolean) }] : [],
    };
  });

  /* 1. Extrair afirmações de todos os capítulos */
  const allText = capitulos.map((cap, idx) => {
    const texto = typeof cap === 'string' ? cap : (cap.c || cap.conteudo || cap.texto || '');
    return { chapterIdx: idx, text: texto };
  });

  const allClaims = allText.flatMap(({ chapterIdx, text }) =>
    extrairAfirmacoes(text, chapterIdx)
  );
  const validatedClaims = validarAfirmacoes(allClaims);

  /* 2. Integridade — política de confiança */
  const integrityReport = gerarRelatorioIntegridade(validatedClaims);
  const integrityState = determinarEstadoDocumento(validatedClaims);

  /* 3. Argumentação */
  const argStructure = analisarEstruturaArgumentativa(normalizedChapters);
  const argAnalysis = verificarCoerenciaArgumentativa(argStructure);

  /* 4. Cobertura objectivos ↔ capítulos */
  const docStub = {
    diagnostic: diagnostic ? {
      specificObjectives: diagnostic.specificObjectives || [],
    } : { specificObjectives: [] },
    chapters: normalizedChapters,
  };
  const coverage = analisarCobertura(docStub);

  /* 5. Referências */
  const refs = Array.isArray(p.references) ? p.references : [];

  /* 6. Scorecard */
  const scorecard = gerarScorecard({
    argumentationIssues: argAnalysis.issues,
    argumentationStructure: argStructure,
    references: refs,
    integrityReport: integrityReport,
    integrityState: integrityState.state,
    coverageAnalysis: coverage,
    coverageState: coverage.estado,
    topic: p.tema,
  });

  /* 7. Simulação do professor */
  const professorSim = simularProfessor({
    metadata: { topic: p.tema || '' },
    _scoreData: {
      integrityState: integrityState.state,
      coverageState: coverage.estado,
      integrityReport,
      coverageAnalysis: coverage,
    },
  });

  return {
    claims: validatedClaims.map(c => ({
      statement: c.statement.substring(0, 150),
      type: c.classifiedAs,
      confidence: c.confidence,
      chapterIdx: c.chapterIdx,
      validation: c.validation,
    })),
    integrity: {
      state: integrityState.state,
      label: integrityState.label,
      reason: integrityState.reason,
      report: {
        total: integrityReport.total,
        alerts: integrityReport.alerts,
        blocked: integrityReport.blocked,
        reviewRequired: integrityReport.reviewRequired,
        highCritical: integrityReport.highCritical,
        integro: integrityReport.integro,
      },
    },
    argumentation: {
      issues: argAnalysis.issues,
      coerente: argAnalysis.coerente,
      totalIssues: argAnalysis.totalIssues,
    },
    coverage: {
      estado: coverage.estado,
      totalObjectives: coverage.totalObjectives,
      orfaos: (coverage.orfaos || []).map(o => o.objective?.substring(0, 100)),
      naoRespondidos: (coverage.naoRespondidos || []).map(n => n.objective?.substring(0, 100)),
      orfaosCapitulos: (coverage.orfaosCapitulos || []).map(c => c.title?.substring(0, 60)),
      relatorio: coverage.relatorio,
    },
    scorecard: {
      overall: scorecard.overall,
      grade: scorecard.grade,
      criteria: scorecard.criteria,
    },
    professor: {
      comentario: professorSim.comentarioGeral,
      recomendacoes: professorSim.recomendacoes,
      nota: professorSim.nota,
    },
  };
}

/* ---------------- MEA ---------------- */
async function doMEA(action, p) {
  const tipo_mea = action==='mea_grafico'?'gráfico':action==='mea_tabela'?'tabela':'esquema';
  const tema     = (p.tema||'').substring(0,200);
  const resumo = Array.isArray(p.capitulos)
    ? p.capitulos.slice(0,5).map(c=>`${c.titulo}: ${(c.c||c.conteudo||'').substring(0,200)}`).join('\n')
    : (p.capResumo||p.capTitulo||'').substring(0,400);
  const schemas = {
    mea_grafico: '{"tipo":"grafico","titulo":"...","eixoX":"...","eixoY":"...","dados":[{"label":"...","valor":0}]}',
    mea_tabela:  '{"tipo":"tabela","titulo":"...","colunas":["..."],"linhas":[["...","..."]]}',
    mea_esquema: '{"tipo":"esquema","titulo":"...","nos":[{"id":"...","texto":"...","ligacoes":["..."]}]}',
  };
  const schema = schemas[action] || schemas.mea_esquema;
  const r = await callAI([{ role:'user', content:
    `Cria um ${tipo_mea} académico para o trabalho sobre "${tema}".
Conteúdo dos capítulos: ${resumo}
Responde APENAS com JSON neste formato exacto (sem markdown): ${schema}`
  }], { max_tokens:1000, temperature:0.5 });
  return { resposta: extrairJSON(r) };
}

/* ---------------- SUPABASE: SAVE ---------------- */
async function doSaveHistory(p) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url||!key) return { saved:false };
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 10000);
  try {
    await fetch(`${url}/rest/v1/academy_history`, {
      method:'POST', signal:ctrl.signal,
      headers:{ 'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`,'Prefer':'return=minimal' },
      body:JSON.stringify({ user_id:p.user_id, tipo:p.tipo, tema:p.tema, pags:p.pags, metadata:p.metadata, created_at:new Date().toISOString() }),
    });
  } finally { clearTimeout(t); }
  return { saved:true };
}

/* ---------------- SUPABASE: GET ---------------- */
async function doGetHistory(p) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url||!key) return { rows:[] };
  const params = new URLSearchParams({ select:'*', user_id:`eq.${p.user_id||''}`, order:'created_at.desc', limit:String(Math.min(parseInt(p.limit)||20,100)) });
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 10000);
  let rows = [];
  try {
    const r = await fetch(`${url}/rest/v1/academy_history?${params}`, { signal:ctrl.signal, headers:{ apikey:key, Authorization:`Bearer ${key}` } });
    rows = await r.json();
  } finally { clearTimeout(t); }
  return { rows: Array.isArray(rows)?rows:[] };
}

/* ---------------- SETUP TABLES (Supabase) ---------------- */
async function doSetupTables() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url||!key) return { created:[], error:'no_supabase_creds' };
  const sql = `
CREATE TABLE IF NOT EXISTS instituicoes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  sigla TEXT,
  desconto_porcentagem INTEGER DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO instituicoes (nome, sigla, desconto_porcentagem) VALUES
  ('Universidade Agostinho Neto','UAN',10),
  ('Universidade Independente de Angola','UNIA',10),
  ('Universidade Católica de Angola','UCAN',10),
  ('Universidade Lusíada de Angola','ULA',10),
  ('Instituto Superior Politécnico de Angola','ISPA',10)
ON CONFLICT (nome) DO NOTHING;
CREATE TABLE IF NOT EXISTS comissoes (
  id SERIAL PRIMARY KEY,
  parceiro_nome TEXT NOT NULL,
  parceiro_whatsapp TEXT,
  valor_venda INTEGER NOT NULL,
  percentagem INTEGER NOT NULL DEFAULT 10,
  valor_comissao INTEGER NOT NULL,
  estado TEXT DEFAULT 'pendente',
  pagamento_ref TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  pago_em TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS parceiros (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  comissao_porcentagem INTEGER DEFAULT 10,
  codigo TEXT UNIQUE,
  activo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO precos (faixa_inicio, faixa_fim, preco, label, ativo) VALUES
  (0, 15, 1850, '0-15 páginas', true),
  (16, 20, 2250, '16-20 páginas', true),
  (21, 30, 5500, '21-30 páginas', true),
  (31, 50, 8500, '31-50 páginas', true)
ON CONFLICT (faixa_inicio, faixa_fim) DO NOTHING;
INSERT INTO planos_grafica (nome, paginas, preco, ativo) VALUES
  ('Gráfica 150', 150, 15000, true),
  ('Gráfica 300', 300, 25000, true),
  ('Gráfica 500', 500, 40000, true)
ON CONFLICT (nome) DO NOTHING;
  `;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}` },
      body:JSON.stringify({ sql }),
    });
    return { created:true, tables:['instituicoes'], seed:5 };
  } catch(e) {
    /* Fallback: tentar via SQL direto no Management API */
    try {
      const mgmtKey = process.env.SUPABASE_SERVICE_KEY;
      const projectRef = 'avdzkucdehggueafyukw';
      await fetch(`https://api.supabase.com/v1/projects/${projectRef}/sql`, {
        method:'POST',
        headers:{ 'Authorization':`Bearer ${mgmtKey}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ query:sql }),
      });
      return { created:true, method:'mgmt_api' };
    } catch(e2) {
      return { created:false, error:e2.message };
    }
  }
}

/* ---------------- HEALTH CHECK ---------------- */
async function doHealthCheck() {
  const checks = {};
  /* 1. Variáveis de ambiente */
  checks.openrouter = !!process.env.OPENROUTER_API_KEY;
  checks.supabase_url = !!process.env.SUPABASE_URL;
  checks.supabase_key = !!process.env.SUPABASE_SERVICE_KEY;
  checks.admin_pin = !!process.env.ADMIN_PIN;
  /* 2. Supabase tables */
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    for (const table of ['utilizadores','pagamentos','documentos','senhas_usadas','planos_utilizadores','precos','planos_grafica','academy_ai_logs','academy_history','instituicoes','comissoes','parceiros']) {
      try {
        const r = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers:{ apikey:key, Authorization:`Bearer ${key}` } });
        checks[`table_${table}`] = r.ok;
      } catch { checks[`table_${table}`] = false; }
    }
  }

  const totalOk = Object.values(checks).filter(v => v === true).length;
  const totalChecks = Object.values(checks).filter(v => v !== undefined).length;
  return { checks, total_ok: totalOk, total_checks: totalChecks, healthy: totalOk === totalChecks };
}

/* ---------------- ENGINE IA (OpenRouter) ---------------- */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callAI(messages, opts={}) {
  const model  = opts.model  || 'google/gemini-2.5-flash-lite';
  const orKey  = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
  if (!orKey) throw new Error('OPENROUTER_API_KEY não configurada');

  try {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), 30000);
    let resp;
    try {
      resp = await fetch(OPENROUTER_URL, {
        method:'POST', signal:ctrl.signal,
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+orKey,
          'HTTP-Referer':'https://academy-open.vercel.app',
          'X-Title':'ACADEMY',
        },
        body:JSON.stringify({ model, messages, temperature:opts.temperature??0.7, max_tokens:opts.max_tokens??800, stream:false }),
      });
    } finally { clearTimeout(t); }
    if (!resp.ok) { const err=await resp.text().catch(()=>String(resp.status)); throw new Error('OpenRouter '+resp.status+': '+err); }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text || text.length<=10) throw new Error('resposta vazia ou muito curta');
    return text;
  } catch(e) { throw new Error('OpenRouter: '+e.message); }
}

/* ---------------- JSON EXTRACTOR ---------------- */
function extrairJSON(texto) {
  if (!texto) throw new Error('resposta vazia');
  const s = texto.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'').trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (m) try { return JSON.parse(m[1]); } catch {}
  throw new Error('JSON inválido na resposta');
}

/* ---------------- HELPER ---------------- */
function ok(action, data) {
  return { ok:true, action, data, meta:{ ts:Date.now(), provider:'openrouter', model:'google/gemini-2.5-flash-lite' } };
}
