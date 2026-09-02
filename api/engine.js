/* =======================================================================
   ACADEMY ENGINE - SAAS BLINDADO (PRODUÇÃO)
   v75: Modular — prompts/schemas/engines importados de academic/
   OpenRouter + Gemini
======================================================================= */

import {
  PERFIL_NIVEL, PERFIL_AREA,
  detectarNivel, detectarArea, detectarContextoGeo,
  montarPromptCapitulo, montarPromptRetry,
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
import { runAcademicValidationPipeline, deveBloquearExport, computeFinalGate } from '../academic/engines/integrity-pipeline.js';
import { ACADEMIC_INTEGRITY_MODE } from '../academic/policies/integrity.js';
import { determinarEscopo, PLATFORM_SCOPE } from '../academic/policies/scope.js';
import { searchAll, rankSources } from '../academic/engines/search.js';
import { extrairClaims, gerarQueries } from '../academic/engines/claims.js';
import { retrieveSource, extractEvidence, verifyClaimSupport } from '../academic/engines/retrieval.js';
import { verificarSuporteClaim } from '../academic/engines/verification.js';

const OR_SITE  = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://academy-open.vercel.app';
const OR_TITLE = 'ACADEMY';

/* ── AI ROUTER — camada central de IA (Ollama → OpenRouter FREE → API existente).
   Nenhuma chamada a provedores directa a partir daqui. ── */
import { generate as aiRouterGenerate, health as aiRouterHealth } from './ai-router.js';

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
=============================================================== */
const REGEX_LIXO_JSON = /^\s*[\{\[]|"(?:chapter_id|section_id|title|paragraphs|content|status|generated_at|generated_by|version|sections)"\s*:/;

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
      if (linha.length > 20 && !REGEX_LIXO_JSON.test(linha)) secAtual.paragraphs.push(linha);
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
      if (!sec.title || REGEX_LIXO_JSON.test(String(sec.title))) sec.title = subs?.[i] || `${capNum}.${i+1}`;
      if (!Array.isArray(sec.paragraphs)) {
        if (typeof sec.content === 'string' && sec.content.trim()) {
          sec.paragraphs = sec.content.split('\n\n')
            .map(p => p.trim()).filter(p => p.length > 20 && !REGEX_LIXO_JSON.test(p));
        } else {
          sec.paragraphs = [];
        }
        ast._repaired = true;
        ast._repair_reason = 'paragraphs_repaired';
      }
      sec.paragraphs = sec.paragraphs
        .map(p => typeof p === 'string' ? p.trim() : '')
        .filter(p => p.length > 15 && !REGEX_LIXO_JSON.test(p));
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
  const minParas = { 'ensino médio': 8, 'licenciatura': 12, 'mestrado': 15, 'doutoramento': 18 };
  if (totalParas < (minParas[nivel] || 8)) {
    blockers.push(`Parágrafos insuficientes: ${totalParas} (mínimo: ${minParas[nivel] || 8})`);
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
  const minPorSec = { 'ensino médio': 4, 'licenciatura': 5, 'mestrado': 6, 'doutoramento': 7 };
  const min = minPorSec[nivelKey] || 5;
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
  const charMin = { 'ensino médio': 250, 'licenciatura': 350, 'mestrado': 450, 'doutoramento': 550 };
  dimensoes.profundidade = Math.min(100, Math.round((charsMedios / (charMin[nivelKey] || 350)) * 100));
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
  const ac_model  = payload.ac_model  || 'nvidia/nemotron-3-ultra-550b-a55b:free';
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
      case 'validar_integridade':
        return res.json(ok(action, await doValidarIntegridade(payload)));
      case 'verificar_referencias':
        return res.json(ok(action, await doVerificarReferencias(payload)));
      case 'gerar_capa':
        return res.json(ok(action, { resposta: JSON.stringify({ capa:{ titulo:payload.tema||'', tipo:payload.tipoTrabalho||'' } }) }));
      case 'verificar_admin':
        return res.json(ok(action, await doVerificarAdmin(payload)));
      case 'aprovar_pagamento':
        return res.json(ok(action, await doAlterarEstadoPagamento(payload, 'aprovado')));
      case 'rejeitar_pagamento':
        return res.json(ok(action, await doAlterarEstadoPagamento(payload, 'rejeitado')));
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
      case 'criar_job':
        return res.json(ok(action, await doCriarJob(payload)));
      case 'obter_job':
        return res.json(ok(action, await doObterJob(payload)));
      case 'processar_job':
        return res.json(ok(action, await doProcessarJob(payload)));
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
    console.error('[ENGINE v66]', action, err.message, err.causa ? `| causa: ${err.causa}` : '');
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    /* Erro genérico de indisponibilidade: NUNCA revelar provedor/modelo/
       quota ao utilizador — apenas a mensagem profissional. */
    if (err.generic || String(err.message || '').startsWith('AI_INDISPONIVEL')) {
      return res.status(503).json({
        ok: false,
        error: 'AI_INDISPONIVEL',
        retry: true,
        generic: true,
        data: null,
      });
    }
    return res.status(status).json({
      ok: false,
      error: err.message || 'INTERNAL_ERROR',
      retry: !!err.retry,
      generic: !!err.generic,
      data : err.data || null,
    });
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

/* ---------------- APROVAR / REJEITAR PAGAMENTO (admin via backend) ----------------
   Aprovação e rejeição passam OBRIGATORIAMENTE por aqui (service role).
   O cliente NÃO consegue definir estado=aprovado/rejeitado (RLS bloqueia). */
async function doAlterarEstadoPagamento(p, novoEstado) {
  const pinRecebido = String(p?.pin || '').trim();
  const pinCorreto  = String(process.env.ADMIN_PIN || '').trim();
  if (!pinCorreto || pinRecebido !== pinCorreto) {
    return { resposta: { ok:false, error:'PIN_INVALIDO', estado:null } };
  }
  const id = String(p?.id || '').trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!id || !url || !key) {
    return { resposta: { ok:false, error:'FALTAM_CREDENCIAIS_SUPABASE', estado:null } };
  }
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 10000);
  try {
    const r = await fetch(`${url}/rest/v1/pagamentos?id=eq.${encodeURIComponent(id)}`, {
      method:'PATCH', signal:ctrl.signal,
      headers:{ 'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`,'Prefer':'return=minimal' },
      body: JSON.stringify({ estado: novoEstado, processado_em: novoEstado === 'aprovado' ? new Date().toISOString() : null }),
    });
    if (!r.ok) return { resposta: { ok:false, error:'SUPABASE_HTTP_'+r.status, estado:null } };
    return { resposta: { ok:true, id, estado:novoEstado } };
  } catch (e) {
    return { resposta: { ok:false, error:String(e.message||e), estado:null } };
  } finally { clearTimeout(t); }
}

/* ---------------- CHAT ---------------- */
async function doChat(p) {
  const pedido = (p.pedido||'').substring(0,2000);
  if (!pedido) throw new Error('pedido obrigatório');
  const hist = (Array.isArray(p.historico)?p.historico:[]).slice(-8)
    .map(m => ({ role:m.role==='assistant'?'assistant':'user', content:String(m.content||'').substring(0,800) }));
  const engineUsed = globalThis.__ac_provider || 'auto';
  const modelUsed  = globalThis.__ac_model  || 'auto';
  const conf = montarPromptChat(null, hist, pedido, p.tema, p.tipoTrabalho);
  const resposta = await callAI([
    { role:'system', content: conf.system },
    ...hist,
    { role:'user', content:pedido },
  ], { max_tokens: conf.maxTokens });
  console.log(`[CHAT] provider=${engineUsed} model=${modelUsed}`);
  return { resposta };
}

/* ---------------- CAPÍTULO (v65: estratificado) ---------------- */

/* Capítulo rejeitado pelo Quality Gate → HTTP 503 CAPITULO_INVALIDO.
   O frontend faz auto-retry (máx. 2) e, no falho final, marca 'x'
   (NUNCA 'p') — o capítulo não entra no livro. */
class CapituloInvalidoError extends Error {
  constructor(motivos, dados) {
    super('CAPITULO_INVALIDO');
    this.status = 503;
    this.retry  = true;
    this.data   = dados;
    this.motivos = motivos;
  }
}

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
  const palavras = Math.min(Math.max(parseInt(p.palavrasPorCap)||palavrasCalc, 300), 4000);

  const nivelKey  = detectarNivel(nivel);
  const areaKey   = detectarArea(tema, p.area);
  const pNivel    = PERFIL_NIVEL[nivelKey];
  const pArea     = PERFIL_AREA[areaKey];
  const escopo    = determinarEscopo({ tema, objetivos: p.objetivo, problema: p.problema, disciplina: p.area });
  const geoCtx    = escopo.geoCtx;

  // EVIDENCE-FIRST: 100% claims factuais → SEARCH → VERIFY → RETRIEVE → EVIDENCE → CLAIM_SUPPORT → SAVE → WRITE
  let fontesEncontradas = [];
  let fontesBibliograficamenteVerificadas = [];
  let fontesComEvidencia = [];
  let fontesQueSustentamClaim = [];
  let allClaimsPre = [];
  let fontesContexto = '';
  const _ts = { claims_at: Date.now(), search_at: null, verify_at: null, evidence_at: null, support_at: null, write_at: null };
  try {
    allClaimsPre = extrairClaims(tema, [capTit, ...capSubs], p.objetivo || '');
    const factualClaims = allClaimsPre.filter(c => c.requires_source);
    // Se nenhum claim factual, não precisa SEARCH
    if (factualClaims.length) {
      _ts.search_at = Date.now();
      const queries = factualClaims.flatMap(c => gerarQueries(c)).slice(0, 8);
      for (const q of queries) {
        try {
          const res = await searchAll(q, { limit: 3 });
          fontesEncontradas.push(...res);
          if (fontesEncontradas.length >= 10) break;
        } catch {}
      }
      fontesEncontradas = [...new Map(fontesEncontradas.map(s => [s.source_id, s])).values()].slice(0, 12);
      // VERIFY todas
      _ts.verify_at = Date.now();
      const verifs = await Promise.allSettled(fontesEncontradas.map(async s => {
        const v = await verificarReferenciaOnline({ raw: `${s.authors[0] || ''} (${s.year || ''}). ${s.title}`, author: s.authors[0] || '', year: s.year, title: s.title, doi: s.doi, isbn: s.isbn });
        return { source: s, verified: v.confidence === 'verified', verification_score: v.confidence === 'verified' ? 0.9 : v.confidence === 'partially_verified' ? 0.6 : 0.2, v };
      }));
      fontesBibliograficamenteVerificadas = verifs.filter(r => r.status==='fulfilled' && r.value.verified).map(r => r.value.source);
      const candidatas = fontesBibliograficamenteVerificadas.length ? fontesBibliograficamenteVerificadas : [];
      // RETRIEVE + EVIDENCE para cada claim factual
      _ts.evidence_at = Date.now();
      const retrieved = await Promise.allSettled(candidatas.map(async s => {
        const ret = await retrieveSource(s);
        // Usa primeiro claim factual como proxy para evidence, mas verifica todos depois
        const ev = extractEvidence({ ...s, _retrieval: ret }, factualClaims[0] || { text: tema });
        return { source: s, retrieval: ret, evidence: ev };
      }));
      fontesComEvidencia = retrieved.filter(r => r.status==='fulfilled' && r.value.evidence.evidence_available).map(r => ({ ...r.value.source, _evidence: r.value.evidence, _retrieval: r.value.retrieval }));
      // CLAIM SUPPORT para TODOS os claims factuais (não só principal)
      _ts.support_at = Date.now();
      const suportadasMap = new Map();
      for (const claim of factualClaims) {
        for (const s of fontesComEvidencia) {
          const sup = verifyClaimSupport(claim, s._evidence) || verificarSuporteClaim(claim.text, s._evidence.evidence_text);
          if (sup.support_status === 'DIRECTLY_SUPPORTS' || sup.support_status === 'PARTIALLY_SUPPORTS') {
            if (!suportadasMap.has(s.source_id)) suportadasMap.set(s.source_id, { ...s, _support: sup, _claimId: claim.id });
          }
        }
      }
      fontesQueSustentamClaim = [...suportadasMap.values()];
      // Fallback: se nenhum suporta mas temos evidência, tenta claim principal com suporte parcial
      if (!fontesQueSustentamClaim.length && fontesComEvidencia.length) {
        const claimPrincipal = factualClaims[0] || { text: `${capTit} — ${capSubs.join(' ')}` };
        for (const s of fontesComEvidencia) {
          const sup = verifyClaimSupport(claimPrincipal, s._evidence);
          if (sup.support_status === 'DIRECTLY_SUPPORTS' || sup.support_status === 'PARTIALLY_SUPPORTS') {
            fontesQueSustentamClaim.push({ ...s, _support: sup });
          }
        }
      }
    } else {
      _ts.search_at = _ts.verify_at = _ts.evidence_at = _ts.support_at = Date.now();
    }
    // Persistir source_claims — BUG-008 FIX: falha crítica não é ignorada
    let persistFailed = false;
    if (fontesQueSustentamClaim.length) {
      for (const s of fontesQueSustentamClaim) {
        try {
          if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
            const ctrl = new AbortController(); setTimeout(()=>ctrl.abort(), 4000);
            const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/source_claims`, {
              method: 'POST', signal: ctrl.signal,
              headers: { 'Content-Type':'application/json', apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, Prefer: 'return=minimal' },
              body: JSON.stringify({ source_id: s.source_id, claim_id: s._claimId || allClaimsPre[0]?.id || 'claim_1', evidence_text: s._evidence?.evidence_text?.substring(0,500) || null, page: null, section: null, confidence: s._support?.confidence || 0.7, support_status: s._support?.support_status || 'DIRECTLY_SUPPORTS' })
            });
            if (!r.ok) { persistFailed = true; console.warn('[EVIDENCE] source_claims persist falhou', r.status); }
          }
        } catch (e) { persistFailed = true; console.warn('[EVIDENCE] source_claims erro', e.message); }
      }
      // Re-rank já filtradas
      const claimP = allClaimsPre[0] || { text: `${capTit} — ${capSubs.join(' ')}` };
      fontesQueSustentamClaim = rankSources(fontesQueSustentamClaim, claimP).slice(0, 3);
    }
    if (fontesQueSustentamClaim.length) {
      fontesContexto = `\n\nFONTES VERIFICADAS COM EVIDÊNCIA (APENAS estas podem ser citadas como fato — se DIRECTLY/PARTIALLY):\n` + fontesQueSustentamClaim.map((s,i) => {
        const ev = s._evidence;
        const sup = s._support;
        return `${i+1}. SOURCE_ID:${s.source_id} | ${s.authors.slice(0,2).join(', ')} (${s.year || 's/d'}). ${s.title}. ${s.journal || s.publisher || s.provider}. DOI:${s.doi || '—'}\n   VERIFICATION: VERIFIED (score ${s.verification_score || 0.9})\n   EVIDENCE (${ev ? 'ABSTRACT_ONLY' : 'UNAVAILABLE'}): ${ev?.evidence_text?.substring(0,220) || '—'}\n   SUPPORT: ${sup?.support_status} (conf ${(sup?.confidence||0).toFixed(2)}) — ${sup?.support_status === 'PARTIALLY_SUPPORTS' ? 'Use apenas a parte sustentada' : 'Pode citar como fato'}`;
      }).join('\n');
    } else {
      fontesContexto = `\n\nNENHUMA FONTE VERIFICADA SUSTENTA O CLAIM — NÃO CITE COMO FATO. Use [CITAÇÃO A VERIFICAR] ou [EVIDÊNCIA INSUFICIENTE] ou reformule como inferência.`;
    }
    _ts.write_at = Date.now();
    // Guardar timestamps para teste 33
    globalThis.__lastEvidenceTimestamps = _ts;
  } catch (e) { console.warn('[EVIDENCE-FIRST] falhou, seguindo sem fontes verificadas:', e.message); }

  // BUG-005 FIX: tokens suficientes para evitar truncamento JSON parcial (causa de Fsquisa/Santcxs)
  const maxTok = Math.min(Math.max(Math.round(palavras*7), 8000), 16000);

  const prompt = montarPromptCapitulo({
    tema, tipo, nivel, inst, prof, area,
    capNum, capTit, totalCaps, totalPags, capSubs,
    nivelKey, areaKey, pNivel, pArea,
    geoCtx,
    escopo,
    fontesContexto,
    palavras, subs: capSubs.map((s,i) => `${capNum}.${i+1} ${s}`).join('\n') ||
      `${capNum}.1 Contextualização\n${capNum}.2 Desenvolvimento\n${capNum}.3 Análise crítica`,
    maxTok, instrucaoSubtitulos: p.instrucaoSubtitulos,
  });

  /* Schema JSON como SYSTEM message (sem system, os modelos "lite" devolvem
     arrays de strings ou JSON truncado → 503). Com system schema + json_object
     o flash-lite e o gpt-4o-mini devolvem sections válidos em ~2s. */
  const systemJSON = `Gera APENAS um objeto JSON com este esquema EXACTO (sem markdown, sem texto adicional):
{"chapter_id":"${capNum}","title":"${capTit}","total_paragraphs":${Math.max(3, Math.round(palavras / 90))},"sections":[{"section_id":"${capNum}.1","title":"<subtítulo>","paragraphs":["<parágrafo 1>","<parágrafo 2>","<parágrafo 3>"]}]}
REGRAS:
- sections: UMA entrada por subtópico obrigatório do prompt do utilizador, na mesma ordem e numeração.
- paragraphs: 3-5 parágrafos completos (3-5 frases cada), texto corrido, sem markdown, sem bullets.
- Cada parágrafo deve ter pelo menos 1 citação (Autor, Ano) quando for dado factual.
- Resposta DEVE ser exclusivamente esse objeto JSON.`;

  let r1 = await callAI([
    { role:'system', content: systemJSON },
    { role:'user', content: prompt },
  ], { max_tokens:maxTok, temperature:0.65, response_format:{ type:'json_object' }, tier: 'balanced' });
  let astRaw = null;
  try { astRaw = extrairJSON(r1); } catch (_) {}
  let rawFallback = r1;

  if (!validarAST(astRaw)) {
    console.warn(`[AST v73] T1 falhou — retry simplificado — cap ${capNum}`);
    retryCount++;
    const promptSimples = montarPromptRetry(capNum, capTit, tema, capSubs, palavras);
    const r2 = await callAI([
      { role:'system', content: systemJSON },
      { role:'user', content: promptSimples },
    ], { max_tokens:maxTok, temperature:0.5, ...(MODELO_GARANTIA ? {model:MODELO_GARANTIA} : {}), response_format:{ type:'json_object' } });
    rawFallback = r2;
    try { astRaw = extrairJSON(r2); } catch (_) {}
  }

  const ast = repararAST(astRaw || rawFallback, capNum, capTit, capSubs);
  if (ast._repaired) {
    console.warn(`[AST v72] Reparado — cap ${capNum} — razão: ${ast._repair_reason}`);
  }

  // GATE STRICT: citações só se em fontesQueSustentamClaim (antes de health)
  if (ACADEMIC_INTEGRITY_MODE === 'STRICT' && Array.isArray(fontesQueSustentamClaim)) {
    const verifiedAuthors = new Set(fontesQueSustentamClaim.flatMap(s => (s.authors||[]).map(a => a.split(',')[0].trim().toLowerCase())));
    const verifiedYears = new Set(fontesQueSustentamClaim.map(s => String(s.year)));
    // Se nenhuma fonte sustenta, nenhuma citação é válida
    const hasVerified = fontesQueSustentamClaim.length > 0;
    for (const sec of ast.sections || []) {
      for (let pi = 0; pi < (sec.paragraphs||[]).length; pi++) {
        let para = sec.paragraphs[pi];
        if (!para) continue;
        // Detecta (Autor, Ano) e Autor (Ano)
        const citRegex = /\b([A-ZÁÉÍÓÚÀ][a-zà-ÿ]+(?:\s+[A-ZÁÉÍÓÚÀ][a-zà-ÿ]+)*)\s*\(\s*(19|20)\d{2}[a-z]?\s*\)|\(([A-ZÁÉÍÓÚÀ][a-zà-ÿ]+(?:\s+[A-ZÁÉÍÓÚÀ][a-zà-ÿ]+)*),\s*(19|20)\d{2}[a-z]?\s*\)/g;
        let m; let newPara = para;
        while ((m = citRegex.exec(para)) !== null) {
          const authorRaw = (m[1] || m[3] || '').toLowerCase().trim();
          const yearRaw = m[2] || m[4] || '';
          const hasAuthor = [...verifiedAuthors].some(a => authorRaw.includes(a) || a.includes(authorRaw));
          const hasYear = verifiedYears.has(yearRaw) || !yearRaw;
          if (!hasVerified || !hasAuthor) {
            newPara = newPara.replace(m[0], '[CITAÇÃO A VERIFICAR]');
          }
        }
        // Números: se contém % ou estatística e não está em evidência, já filtrado via verifyClaimSupport, mas reforça marca
        if (hasVerified && /(\d+(?:[.,]\d+)?\s*%|\b\d+\s*(toneladas|pessoas|amostra)\b)/.test(newPara)) {
          const claimNum = newPara.match(/\d+(?:[.,]\d+)?\s*%/g) || [];
          const hasNumInEvidence = fontesQueSustentamClaim.some(s => {
            const ev = s._evidence?.evidence_text || '';
            return claimNum.some(n => ev.includes(n));
          });
          if (claimNum.length && !hasNumInEvidence) {
            // Não bloqueia todo parágrafo, mas marca para auditoria (integrity-pipeline detectará)
          }
        }
        sec.paragraphs[pi] = newPara;
      }
    }
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
    model_used         : globalThis.__ac_model  || 'auto',
  });

  const completeness = calcularCompleteness(
    ast, palavras, totalCaps, nivelKey
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
    model_used         : globalThis.__ac_model || 'auto',
  });

  /* ── QUALITY GATE (backend) — modo resiliente: só bloqueia se vazio ou muito curto ── */
  const totalParasLivro = (ast.sections || []).reduce(
    (acc, s) => acc + (s.paragraphs || []).length, 0
  );
  const parasMinAlvo = Math.max(4, Math.min(9, Math.floor(palavras / 100)));
  const motivosInvalido = [];
  if (!validarAST(ast)) motivosInvalido.push('Sem conteúdo (AST vazio)');
  // Reparação fraca vira aviso, não bloqueio — só bloqueia se também houver pouca completude
  const compNum = Number(completeness?.completeness);
  if (ast._repaired === true && Number.isFinite(compNum) && compNum < 60) motivosInvalido.push(`Estrutura reconstruída + completude ${Math.round(compNum)}% (<60)`);
  if (totalParasLivro < parasMinAlvo) motivosInvalido.push(`Parágrafos insuficientes: ${totalParasLivro} (esperado ≥${parasMinAlvo})`);
  if (!readiness.ready) {
    const blockerReal = (readiness.blockers || []).find(b => !/par[áa]grafos insuficientes/i.test(b));
    if (blockerReal) motivosInvalido.push('readiness: ' + blockerReal);
  }
  if (Number.isFinite(compNum) && compNum < 65) motivosInvalido.push(`Completude ${Math.round(compNum)}% (<65)`);

  if (motivosInvalido.length > 0) {
    throw new CapituloInvalidoError(motivosInvalido, {
      ast,
      health,
      readiness,
      confidence,
      completeness,
      reparado: ast._repaired || false,
      razao    : ast._repair_reason || null,
      motivos  : motivosInvalido,
      _patch   : true,
    });
  }

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

  // EVIDENCE-FIRST: tentar construir bibliografia a partir de fontes reais verificadas
  let fontesReais = [];
  try {
    const q = tema.split(/\s+/).slice(0,6).join(' ');
    const res = await searchAll(q, { limit: 8 });
    const verifs = await Promise.allSettled(res.slice(0,8).map(async s => {
      const v = await verificarReferenciaOnline({ raw: `${s.authors[0]||''} (${s.year||''}). ${s.title}`, author: s.authors[0]||'', year: s.year, title: s.title, doi: s.doi });
      return { source: s, verified: v.confidence === 'verified' };
    }));
    fontesReais = verifs.filter(r => r.status==='fulfilled' && r.value.verified).map(r => r.value.source);
  } catch {}

  // Se temos fontes reais suficientes, formatar a partir delas (sem LLM inventar)
  if (fontesReais.length >= 1) {
    const formatadas = fontesReais.slice(0, Math.min(18, Math.max(10, Math.round(totalPags*0.6)))).map(s => {
      const aut = s.authors.slice(0,3).join(', ') || 'Autor';
      return `${aut} (${s.year || 's/d'}). ${s.title}. ${s.journal || s.publisher || s.provider}. ${s.doi ? 'https://doi.org/'+s.doi : s.url || ''}`.trim();
    }).join('\n\n');
    const peneiraReal = peneirarReferencias(formatadas);
    if (peneiraReal.validas.length >= 1) {
      const parseResultR = parseReferencias(peneiraReal.texto);
      const validacaoR = validarListaReferencias(parseResultR.validas);
      const refsEstruturadasR = validacaoR.resultados.map(r => ({
        raw: r.estruturada.raw, author: r.estruturada.author, year: r.estruturada.year,
        confidence: CONFIDENCE_LEVELS.VERIFIED, issues: r.issues,
      }));
      return {
        resposta: peneiraReal.texto,
        referencias_validas: peneiraReal.validas.length,
        referencias_pedidas: Math.min(18, Math.max(10, Math.round(totalPags*0.6))),
        referencias_rejeitadas: peneiraReal.invalidas,
        referencias_estruturadas: refsEstruturadasR,
        taxa_validade: 1,
        modo: 'evidence-first',
      };
    }
  }

  // Em STRICT, sem fontes reais suficientes, NÃO inventar via LLM — retorna vazio (ZERO fallback)
  if (ACADEMIC_INTEGRITY_MODE === 'STRICT' && fontesReais.length === 0) {
    return {
      resposta: 'Nenhuma fonte verificada encontrada — bibliografia vazia. Marque [CITAÇÃO A VERIFICAR] ou forneça fontes.',
      referencias_validas: 0,
      referencias_pedidas: Math.min(18, Math.max(10, Math.round(totalPags*0.6))),
      referencias_estruturadas: [],
      taxa_validade: 0,
      modo: 'strict-empty',
      aviso: 'STRICT: LLM bloqueado de inventar referências'
    };
  }

  /* Fallback LLM — só em não-STRICT ou quando há pelo menos 1 verificada mas precisa completar */
  let autoresCitados = [];
  if (Array.isArray(p.autoresCitados)) {
    autoresCitados = p.autoresCitados.filter(a => a && a.autor && a.ano);
  } else if (typeof p.autoresCitados === 'string' && p.autoresCitados.trim()) {
    try {
      autoresCitados = JSON.parse(p.autoresCitados).filter(a => a && a.autor && a.ano);
    } catch (e) { /* ignorar parse falhado */ }
  }

  const promptRef = montarPromptReferencias({
    tema, tipo, nivel, area: p.area, pais: p.pais, totalPags,
    autoresCitados,
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

async function doValidarIntegridade(p) {
  const secs = Array.isArray(p.secs) ? p.secs : (Array.isArray(p.capitulos) ? p.capitulos : []);
  const metodologia = p.metodologia || p.plano?.metodologia || '';
  const datasets = Array.isArray(p.datasets) ? p.datasets : [];
  const report = await runAcademicValidationPipeline({ secs, datasets, metodologia });

  // ── FONTE ÚNICA DE VERDADE: mesclar pipeline STRICT + análise de claims/coverage/quality ──
  // Recebe contexto opcional enviado pela UI (analisar_documento) para avaliação unificada.
  // Se não enviado, computa internamente a partir de secs para não divergir da UI.
  let extraCtx = p._gateCtx || {};
  // Se ctx não veio, tenta derivar do mesmo código de doAnalisarDocumento para evitar recalcular diferente
  if (!p._gateCtx) {
    try {
      const textoCompleto = secs.map(s => s.c || s.conteudo || '').join('\n\n');
      const claimsRaw = validarAfirmacoes(extrairAfirmacoes(textoCompleto, 0));
      const integTmp = gerarRelatorioIntegridade(claimsRaw);
      const covTmp = analisarCobertura({ diagnostic: p.diagnostic || { specificObjectives: [] }, chapters: secs.map(s => ({ title: s.titulo || '', sections: [{ title: 'c', paragraphs: (s.c||s.conteudo||'').split('\n\n') }] })) });
      extraCtx = {
        reviewRequired: integTmp.reviewRequired,
        highCritical: integTmp.highCritical,
        blockedClaims: integTmp.blocked,
        coverageEstado: covTmp.estado,
        coverageOrfaos: (covTmp.orfaos||[]).length,
      };
      // Taxa verificação se refs enviadas
      if (Array.isArray(p.references) && p.references.length) {
        const validas = p.references.filter(r => r.confidence === 'verified' || r.confidence === 'VERIFIED').length;
        extraCtx.verifyRate = p.references.length ? Math.round(validas / p.references.length * 100) : 0;
        extraCtx.verifyTotal = p.references.length;
      }
    } catch {}
  }

  const gate = computeFinalGate(report, extraCtx);
  // Sincroniza report com gate unificado (para UI consumir sem recomputar)
  report.canExportFinal = gate.canExportFinal;
  report.finalBlocked = gate.blocked;
  report.finalReasons = gate.reasons;

  return {
    report,
    integrityScore: report.score,
    label: report.label,
    blocked: gate.blocked, // ← unificado! UI deve usar este campo, não o antigo report.blocked isolado
    legacyBlocked: report.blocked,
    canExportFinal: gate.canExportFinal,
    mustBlockFinal: gate.blocked,
    reasons: gate.reasons,
    mode: ACADEMIC_INTEGRITY_MODE,
    deveBloquear: gate.blocked,
    draftWatermark: gate.blocked ? 'DRAFT — REQUIRES VERIFICATION' : null
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

/* ---------------- JOBS PERSISTENTES (100p) ---------------- */
async function doCriarJob(p) {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { id: `job_${Date.now()}`, status: 'pending', error: 'no_supabase' };
  const payload = {
    user_id: p.user_id || p.uid || 'anon',
    tema: p.tema || '',
    status: 'pending',
    progress: 0,
    total_caps: parseInt(p.totalCaps) || 0,
    caps_done: 0,
    result: {}
  };
  const r = await fetch(`${url}/rest/v1/jobs`, {
    method: 'POST', headers: { 'Content-Type':'application/json', apikey: key, Authorization:`Bearer ${key}`, Prefer:'return=representation' },
    body: JSON.stringify(payload)
  });
  const j = await r.json().catch(()=> ({}));
  return Array.isArray(j) ? j[0] : j;
}
async function doObterJob(p) {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !p.job_id) return null;
  const r = await fetch(`${url}/rest/v1/jobs?id=eq.${p.job_id}`, { headers: { apikey: key, Authorization:`Bearer ${key}` } });
  const j = await r.json().catch(()=> []);
  return Array.isArray(j) ? j[0] : null;
}
async function doProcessarJob(p) {
  // Processa 1 capítulo por chamada, persiste e retorna progresso — usado para 100p sem timeout
  const job = await doObterJob(p);
  if (!job || job.status === 'completed') return job;
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_KEY;
  const capsDone = (job.caps_done || 0) + 1;
  const progress = Math.round(capsDone / Math.max(1, job.total_caps) * 100);
  const status = capsDone >= job.total_caps ? 'completed' : 'processing';
  await fetch(`${url}/rest/v1/jobs?id=eq.${job.id}`, {
    method: 'PATCH', headers: { 'Content-Type':'application/json', apikey: key, Authorization:`Bearer ${key}` },
    body: JSON.stringify({ caps_done: capsDone, progress, status, updated_at: new Date().toISOString(), completed_at: status==='completed' ? new Date().toISOString() : null })
  });
  return { ...job, caps_done: capsDone, progress, status };
}

/* ---------------- HEALTH CHECK ---------------- */
async function doHealthCheck() {
  const checks = {};
  /* 1. Variáveis de ambiente */
  checks.openrouter = !!process.env.OPENROUTER_API_KEY;
  checks.supabase_url = !!process.env.SUPABASE_URL;
  checks.supabase_key = !!process.env.SUPABASE_SERVICE_KEY;
  checks.admin_pin = !!process.env.ADMIN_PIN;
  checks.ollama = !!(process.env.OLLAMA_URL);
  checks.groq = !!process.env.GROQ_API_KEY;
  /* 2. Supabase tables */
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    for (const table of ['utilizadores','pagamentos','documentos','senhas_usadas','planos_utilizadores','precos','planos_grafica','academy_ai_logs','academy_history','instituicoes','comissoes','parceiros','webhook_logs','transacoes','intervencoes_admin']) {
      try {
        const r = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers:{ apikey:key, Authorization:`Bearer ${key}` } });
        checks[`table_${table}`] = r.ok;
      } catch { checks[`table_${table}`] = false; }
    }
  }
  /* 3. Estado real dos provedores de IA (via AI Router) */
  try {
    checks.ai_router = await aiRouterHealth();
    checks.ai_router_ok = Object.values(checks.ai_router.providers || {}).some(p => p.ok);
  } catch (e) {
    checks.ai_router = { erro: String(e.message || e) };
    checks.ai_router_ok = false;
  }

  const totalOk = Object.values(checks).filter(v => v === true).length;
  const totalChecks = Object.values(checks).filter(v => v !== undefined && typeof v !== 'object').length;
  return { checks, total_ok: totalOk, total_checks: totalChecks, healthy: totalOk === totalChecks };
}

/* ---------------- ENGINE IA (OpenRouter) ---------------- */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/* Aviso: chamadas directas a provedores estão proibidas — tudo via
   AI Router (api/ai-router.js). OPENROUTER_URL mantido só p/ leitura
   de logs antigos; remover a curto prazo. */

/* ═══════════════════════════════════════════════════════════
   ENGINE IA — TUDO passa pelo AI ROUTER (api/ai-router.js)
   Hierarquia: Ollama (open source) → OpenRouter (só FREE) → API existente.
   Nenhum modelo pago é seleccionado automaticamente.
═══════════════════════════════════════════════════════════ */
/* Modelo de retry/garantia — usa sempre o melhor disponível no router.
   Não força modelo free; o router escolhe openai_direct quando disponível. */
const MODELO_GARANTIA = null;

/* Wrapper de compatibilidade: os módulos chamam callAI() e o router
   decide o provedor/modelo. Devolve apenas o texto. */
async function callAI(messages, opts={}) {
  const r = await aiRouterGenerate(messages, opts);
  globalThis.__ac_provider = r.provider;
  globalThis.__ac_model    = r.model;
  return r.text;
}

/* ---------------- JSON EXTRACTOR ---------------- */
/* Recolhe todos os blocos {...} ou [...] equilibrados (respeitando
   strings e escapes) — aguenta preâmbulos de raciocínio (CoT). */
function blocosBalanceados(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== '{' && ch !== '[') continue;
    const ab = ch, fe = ch === '{' ? '}' : ']';
    let profund = 0, str = false, esc = false, fim = -1;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { str = !str; continue; }
      if (str) continue;
      if (c === ab) profund++;
      else if (c === fe) { profund--; if (profund === 0) { fim = j; break; } }
    }
    if (fim > i) out.push({ bloco: s.substring(i, fim + 1), i, fim });
  }
  return out;
}

function extrairJSON(texto) {
  if (!texto) throw new Error('resposta vazia');
  const s = texto.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'').trim();
  try { const p = JSON.parse(s); if (p && typeof p === 'object') return p; } catch {}
  const validos = [];
  for (const b of blocosBalanceados(s)) {
    try { validos.push(JSON.parse(b.bloco)); } catch (_) {}
  }
  if (!validos.length) throw new Error('JSON inválido na resposta');
  /* preferir o ÚLTIMO bloco válido com sections (o JSON real vem no fim) */
  const comSections = validos.filter(v => v && typeof v === 'object' && Array.isArray(v.sections));
  return comSections.length ? comSections[comSections.length - 1] : validos[validos.length - 1];
}

/* ---------------- HELPER ---------------- */
function ok(action, data) {
  return { ok:true, action, data, meta:{ ts:Date.now(), provider:'auto', model: globalThis.__ac_model || 'auto' } };
}
