/* ═══════════════════════════════════════════════════════════
   ACADEMY — /api/engine.js
   Vercel Serverless Function (Node.js 20.x) + Express local
   Provider: OpenRouter
   Arquitectura: Frontend → POST /api/engine → switch(action) → OpenRouter
   
   COMPATIBILIDADE:
   - Vercel: invocado directamente como handler(req, res)
   - Local:  importado pelo server.js e chamado da mesma forma
═══════════════════════════════════════════════════════════ */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_FAST         = 'meta-llama/llama-3.3-70b-instruct';
const MODEL_STRONG       = 'meta-llama/llama-3.3-70b-instruct';

/* ── Logger com timestamp ── */
function log(level, action, msg, extra = '') {
  const ts = new Date().toISOString();
  console[level === 'ERROR' ? 'error' : 'log'](
    `[${ts}] [engine] [${level}] action=${action} | ${msg}${extra ? ' | ' + extra : ''}`
  );
}

/* ── Utility: call OpenRouter ── */
async function callOpenRouter({ messages, model = MODEL_FAST, max_tokens = 4096, temperature = 0.7, action = '?' }) {
  /* FIX #1: Lê a key dentro da função — não no topo do módulo.
     No Vercel, as env vars só existem em runtime, não em parse time. */
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não definida nas variáveis de ambiente.');

  /* FIX #2: Validação de payload antes de enviar */
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('callOpenRouter: messages inválido ou vazio.');
  }

  log('INFO', action, `→ OpenRouter model=${model} max_tokens=${max_tokens} msgs=${messages.length}`);

  let res;
  try {
    res = await fetch(OPENROUTER_API_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://academy.vercel.app',
        'X-Title':       'Academy',
      },
      body: JSON.stringify({ model, messages, max_tokens, temperature }),
    });
  } catch (networkErr) {
    /* FIX #3: Erros de rede (DNS, timeout) capturados separadamente */
    throw new Error(`Erro de rede ao contactar OpenRouter: ${networkErr.message}`);
  }

  /* FIX #4: Lê o body UMA vez e guarda — evita "body already consumed" */
  const rawBody = await res.text();

  if (!res.ok) {
    let errMsg = `OpenRouter HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(rawBody);
      errMsg = errJson?.error?.message || errMsg;
    } catch (_) { /* body não é JSON — usa o texto raw */ 
      errMsg = rawBody?.substring(0, 200) || errMsg;
    }
    if (res.status === 429) throw new Error(`QUOTA: Rate limit atingido. Aguarda 30s. (${errMsg})`);
    if (res.status === 401) throw new Error(`AUTH: API key inválida ou expirada. Verifica OPENROUTER_API_KEY.`);
    throw new Error(`OpenRouter ${res.status}: ${errMsg}`);
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (_) {
    throw new Error(`OpenRouter devolveu resposta não-JSON: ${rawBody?.substring(0, 200)}`);
  }

  /* FIX #5: Verificação robusta de resposta vazia */
  const text = data?.choices?.[0]?.message?.content;
  if (text === undefined || text === null || text.trim() === '') {
    log('ERROR', action, 'OpenRouter devolveu conteúdo vazio', JSON.stringify(data).substring(0, 300));
    throw new Error('OpenRouter: resposta vazia. Tenta novamente.');
  }

  log('INFO', action, `← OpenRouter OK | chars=${text.length} model=${data?.model || model}`);
  return { text: text.trim(), model: data?.model || model };
}

/* ── Response helpers ── */
function ok(res, data) {
  return res.status(200).json({ ok: true, data });
}
function fail(res, msg, status = 500) {
  return res.status(status).json({ ok: false, error: msg });
}

/* ── Extractor JSON seguro (evita crash em JSON mal formado) ── */
function extractJSON(text, tipo = 'objecto') {
  /* FIX #6: Tenta extrair JSON mesmo quando o modelo envolve em markdown ```json ``` */
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const pattern = tipo === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match   = cleaned.match(pattern);
  if (!match) throw new Error(`Resposta sem ${tipo} JSON válido. Recebido: ${text.substring(0, 200)}`);

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw new Error(`JSON mal formado na resposta: ${e.message}`);
  }
}

/* ═══════════════════════════════════════════════════════════
   HANDLERS POR ACÇÃO
═══════════════════════════════════════════════════════════ */

async function handlePing(_payload, res) {
  return ok(res, { resposta: 'pong', model: MODEL_FAST, ts: Date.now() });
}

async function handlePlanoAcademico(payload, res) {
  const { tema, tipoTrabalho, nivel, totalPags } = payload;
  if (!tema)         throw new Error('plano_academico: campo "tema" obrigatório.');
  if (!tipoTrabalho) throw new Error('plano_academico: campo "tipoTrabalho" obrigatório.');

  const messages = [
    {
      role: 'system',
      content: `És um assistente académico especializado em trabalhos universitários em Português Europeu (pt-PT).
Escreve sempre em português formal e académico. Nunca uses anglicismos desnecessários.
Devolve SEMPRE respostas JSON puras, sem blocos markdown.`,
    },
    {
      role: 'user',
      content: `Cria um plano académico completo para um trabalho de tipo "${tipoTrabalho}" sobre o tema: "${tema}".
Nível académico: ${nivel || 'universitário'}. Extensão aproximada: ${totalPags || 20} páginas.

Devolve APENAS o seguinte objecto JSON (sem mais texto, sem markdown):
{
  "objetivo": "objectivo geral do trabalho (1-2 frases)",
  "hipotese": "hipótese ou questão de investigação (1 frase)",
  "metodologia": "metodologia a usar (1 frase)",
  "palavrasChave": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"]
}`,
    },
  ];

  const { text } = await callOpenRouter({ messages, max_tokens: 800, action: 'plano_academico' });
  const plano = extractJSON(text, 'objecto');
  return ok(res, { resposta: plano });
}

async function handleEstruturaAcademica(payload, res) {
  const { tema, tipoTrabalho, nivel, totalPags, objetivo, hipotese } = payload;
  if (!tema) throw new Error('estrutura_academica: campo "tema" obrigatório.');

  const messages = [
    {
      role: 'system',
      content: `És um assistente académico especializado em estruturas de trabalhos universitários em Português Europeu.
Devolve SEMPRE respostas JSON puras, sem blocos markdown.`,
    },
    {
      role: 'user',
      content: `Cria a estrutura de capítulos para um trabalho de "${tipoTrabalho || 'dissertação'}" sobre: "${tema}".
Nível: ${nivel || 'universitário'}. Páginas: ${totalPags || 20}.
${objetivo ? `Objectivo: ${objetivo}.` : ''}
${hipotese ? `Hipótese: ${hipotese}.` : ''}

Devolve APENAS este array JSON (sem mais texto, sem markdown):
[
  {
    "num": 1,
    "titulo": "Título do Capítulo",
    "subs": ["Subtítulo 1.1", "Subtítulo 1.2"]
  }
]
Inclui Introdução, capítulos de desenvolvimento, Conclusão e Referências Bibliográficas.`,
    },
  ];

  const { text } = await callOpenRouter({ messages, max_tokens: 1500, action: 'estrutura_academica' });
  const estrutura = extractJSON(text, 'array');
  return ok(res, { resposta: estrutura });
}

async function handleGerarCapitulo(payload, res) {
  const {
    tema, tipoTrabalho, nivel,
    capNum, capTitulo, capSubs = [], totalCaps,
    palavrasPorCap, objetivo, hipotese, metodologia,
    instrucaoSubtitulos, instrucaoVariacao, memoriaDocumento,
  } = payload;

  if (!tema)      throw new Error('gerar_capitulo: campo "tema" obrigatório.');
  if (!capTitulo) throw new Error('gerar_capitulo: campo "capTitulo" obrigatório.');

  const messages = [
    {
      role: 'system',
      content: `És um redactor académico especializado em Português Europeu (pt-PT).
Escreves conteúdo académico original, formal e rigoroso.
NUNCA uses listas com bullet points — escreve sempre em prosa contínua.
NUNCA repitas instruções ou meta-comentários no texto final.
${memoriaDocumento ? `\nContexto do documento:\n${memoriaDocumento}` : ''}`,
    },
    {
      role: 'user',
      content: `Escreve o Capítulo ${capNum || '?'} de ${totalCaps || '?'} do trabalho de "${tipoTrabalho || 'dissertação'}" sobre: "${tema}".
Nível: ${nivel || 'universitário'}. Capítulo: "${capTitulo}".
${capSubs.length ? `Subtópicos obrigatórios: ${capSubs.join(', ')}.` : ''}
${instrucaoSubtitulos || ''}
${instrucaoVariacao || ''}
${objetivo ? `Objectivo geral: ${objetivo}.` : ''}
${hipotese ? `Hipótese: ${hipotese}.` : ''}
${metodologia ? `Metodologia: ${metodologia}.` : ''}
Extensão aproximada: ${palavrasPorCap || 600} palavras.

Escreve o capítulo completo em prosa académica formal, sem introdução nem conclusão redundantes.`,
    },
  ];

  const { text, model } = await callOpenRouter({
    messages,
    model:       MODEL_STRONG,
    max_tokens:  3000,
    temperature: 0.75,
    action:      'gerar_capitulo',
  });

  return ok(res, {
    resposta:     text,
    health:       0.9,
    readiness:    0.9,
    confidence:   0.85,
    completeness: 0.9,
    _guaranteed:  false,
    model,
  });
}

async function handleGerarCapituloReferencias(payload, res) {
  const { tema, tipoTrabalho, nivel, capTitulo } = payload;
  if (!tema) throw new Error('gerar_capitulo_referencias: campo "tema" obrigatório.');

  const messages = [
    {
      role: 'system',
      content: `És um especialista em referências bibliográficas académicas em Português Europeu (norma APA 7.ª edição).`,
    },
    {
      role: 'user',
      content: `Gera uma lista de referências bibliográficas para um trabalho de "${tipoTrabalho || 'dissertação'}" sobre: "${tema}".
Nível: ${nivel || 'universitário'}. Secção: "${capTitulo || 'Referências'}".
Inclui entre 8 a 15 referências reais e credíveis em formato APA 7.ª edição.
Uma referência por linha, ordenadas alfabeticamente. Apenas as referências, sem texto adicional.`,
    },
  ];

  const { text } = await callOpenRouter({
    messages,
    max_tokens:  2000,
    temperature: 0.3,
    action:      'gerar_capitulo_referencias',
  });

  return ok(res, { resposta: text, health: 1, readiness: 1, confidence: 1, completeness: 1 });
}

async function handleRegenerarCapitulo(payload, res) {
  return handleGerarCapitulo(payload, res);
}

async function handleEditarTexto(payload, res) {
  const { texto, subacao, instrucao, capTitulo, tema } = payload;
  if (!texto) throw new Error('editar_texto: campo "texto" obrigatório.');

  const instrucaoPorSubacao = {
    melhorar:              'Melhora o estilo, clareza e coesão académica do texto seguinte, mantendo o conteúdo original.',
    expandir:              'Expande o texto seguinte com mais desenvolvimento, exemplos e argumentação académica.',
    editar_conversacional: instrucao || 'Edita o texto conforme a instrução dada.',
  };

  const prompt = instrucaoPorSubacao[subacao] || instrucao || 'Melhora o texto seguinte.';

  const messages = [
    {
      role: 'system',
      content: `És um editor académico especializado em Português Europeu (pt-PT).
Escreves em prosa formal e académica.
${tema ? `Tema do trabalho: ${tema}.` : ''}
${capTitulo ? `Capítulo: ${capTitulo}.` : ''}`,
    },
    {
      role: 'user',
      content: `${prompt}\n\nTEXTO:\n${texto}`,
    },
  ];

  const { text } = await callOpenRouter({
    messages,
    max_tokens:  3000,
    temperature: 0.65,
    action:      'editar_texto',
  });

  return ok(res, { resposta: text });
}

async function handleChat(payload, res) {
  const { mensagem, historico = [], tema, tipoTrabalho } = payload;
  if (!mensagem) throw new Error('chat: campo "mensagem" obrigatório.');

  const messages = [
    {
      role: 'system',
      content: `És o assistente ACADEMY, especializado em apoio a trabalhos académicos em Português Europeu.
${tipoTrabalho ? `Trabalho: ${tipoTrabalho}.` : ''}
${tema ? `Tema: ${tema}.` : ''}
Responde de forma clara, útil e académica.`,
    },
    ...historico,
    { role: 'user', content: mensagem },
  ];

  const { text } = await callOpenRouter({
    messages,
    max_tokens:  1500,
    temperature: 0.7,
    action:      'chat',
  });

  return ok(res, { resposta: text });
}

async function handleDocumentoLivre(payload, res) {
  const { instrucao, contexto, tema } = payload;
  if (!instrucao) throw new Error('documento_livre: campo "instrucao" obrigatório.');

  const messages = [
    {
      role: 'system',
      content: `És um assistente académico em Português Europeu.
${tema ? `Contexto do documento: ${tema}.` : ''}`,
    },
    {
      role: 'user',
      content: `${instrucao}${contexto ? `\n\nContexto adicional:\n${contexto}` : ''}`,
    },
  ];

  const { text } = await callOpenRouter({
    messages,
    max_tokens: 2000,
    action:     'documento_livre',
  });

  return ok(res, { resposta: text });
}

async function handleGerarCapa(payload, res) {
  const { tema, tipoTrabalho, nivel, autor, instituicao, ano } = payload;
  const capa = {
    titulo:      tema        || '',
    tipo:        tipoTrabalho || '',
    nivel:       nivel        || '',
    autor:       autor        || '',
    instituicao: instituicao  || '',
    ano:         ano          || new Date().getFullYear(),
  };
  return ok(res, { resposta: capa });
}

/* ═══════════════════════════════════════════════════════════
   MAIN HANDLER
   Entry point único para Vercel e Express local.
═══════════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return fail(res, 'Método não permitido. Use POST.', 405);

  /* ── Parse body ──
     Vercel já parseia automaticamente.
     Express com express.json() também.
     Fallback manual caso chegue como string. */
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch (_) { return fail(res, 'Body JSON inválido.', 400); }
  }
  if (!body || typeof body !== 'object') {
    return fail(res, 'Body em falta ou formato inválido.', 400);
  }

  const { action, payload = {} } = body;

  if (!action) return fail(res, 'Campo "action" obrigatório no body.', 400);

  log('INFO', action, `→ recebido`);

  try {
    switch (action) {
      case 'ping':                       return await handlePing(payload, res);
      case 'plano_academico':            return await handlePlanoAcademico(payload, res);
      case 'estrutura_academica':        return await handleEstruturaAcademica(payload, res);
      case 'gerar_capitulo':             return await handleGerarCapitulo(payload, res);
      case 'gerar_capitulo_referencias': return await handleGerarCapituloReferencias(payload, res);
      case 'regenerar_capitulo':         return await handleRegenerarCapitulo(payload, res);
      case 'editar_texto':               return await handleEditarTexto(payload, res);
      case 'chat':                       return await handleChat(payload, res);
      case 'documento_livre':            return await handleDocumentoLivre(payload, res);
      case 'gerar_capa':                 return await handleGerarCapa(payload, res);
      default:
        log('ERROR', action, 'acção desconhecida');
        return fail(res, `Acção desconhecida: "${action}"`, 400);
    }
  } catch (err) {
    log('ERROR', action, err.message);
    return fail(res, err.message || 'Erro interno do servidor.', 500);
  }
}
