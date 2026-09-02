/* academic/engines/integrity-pipeline.js
   ACADEMIC_VALIDATION_PIPELINE — 15 etapas
   STRICT: prefere admitir falta a inventar
============================================================================= */

import { extrairAfirmacoes, validarAfirmacoes } from './evidence.js';
import { verificarListaReferencias } from './verification.js';
import { parseReferencias } from './references.js';
import { gerarRelatorioIntegridade } from '../policies/confidence-policy.js';
import { isStrict } from '../policies/integrity.js';

/* ── Regex para números suspeitos ── */
const NUM_SUSPEITO = /(\d{1,3}(?:[.\s]\d{3})*(?:[,\.]\d+)?)\s*(%|por cento|toneladas|t\/dia|habitantes|pessoas|entrevistados|amostra|Kz|USD|AOA|média|desvio)/gi;
const PERCENT = /(\d+(?:[,\.]\d+)?)\s*%/g;

/* ── Classificar claims por tipo (simplificado) ── */
export function classificarClaim(text) {
  const t = text.toLowerCase();
  if (/\b(entrevistados|amostra|questionário|inquiridos|participantes)\b/.test(t) && /\b\d+\b/.test(t)) return 'PRIMARY_DATA';
  if (/\b(INE|Banco Mundial|OMS|UNESCO|MINSA|INEA)\b/.test(text) && /\d/.test(text)) return 'OFFICIAL_STATISTIC';
  if (/\(.*\d{4}\)/.test(text)) return 'ACADEMIC_SOURCE';
  if (/\b(teoria|conceito|define-se|entende-se)\b/.test(t)) return 'THEORETICAL_STATEMENT';
  if (text.length < 80) return 'COMMON_KNOWLEDGE';
  return 'MODEL_GENERATED';
}

export function detectarNumerosSuspeitos(text) {
  const nums = [];
  let m;
  while ((m = NUM_SUSPEITO.exec(text)) !== null) nums.push({ raw: m[0], value: m[1], unit: m[2], index: m.index });
  // também percentagens soltas
  PERCENT.lastIndex = 0;
  while ((m = PERCENT.exec(text)) !== null) {
    if (!nums.find(n => n.index === m.index)) nums.push({ raw: m[0], value: m[1], unit: '%', index: m.index });
  }
  return nums;
}

/* ── Pipeline principal ── */
export async function runAcademicValidationPipeline({ secs, claims: claimsIn, datasets = [], metodologia = '' }) {
  const report = {
    startedAt: new Date().toISOString(),
    steps: {},
    critical: 0,
    warnings: 0,
    fabricatedData: 0,
    score: 0,
    blocked: false,
    details: {}
  };

  const textoCompleto = secs.map(s => s.c || s.conteudo || '').join('\n\n');
  const claims = claimsIn || validarAfirmacoes(extrairAfirmacoes(textoCompleto, 0));

  // 1. Validate citations — suporta (Autor, Ano) e Autor (Ano)
  const citacoesParen = (textoCompleto.match(/\([A-Z][^)]*\d{4}[^)]*\)/g) || []).length;
  const citacoesAutorAno = (textoCompleto.match(/[A-ZÁÉÍÓÚÀ][a-zà-ÿ]+\s*\(\d{4}\)/g) || []).length;
  const citacoes = citacoesParen + citacoesAutorAno;
  const refsSec = secs.find(s => /refer[eê]ncias|bibliograf/i.test(s.titulo || ''));
  const refsTexto = refsSec ? (refsSec.c || refsSec.conteudo || '') : '';
  const refsList = parseReferencias(refsTexto);
  report.steps.citations = { citacoes, refs: refsList.validas?.length || 0 };
  report.details.citations = refsList;

  // 2. Validate references (forma)
  report.steps.references = { validas: refsList.validas?.length || 0, invalidas: refsList.invalidas || 0 };

  // 3. Claims
  report.steps.claims = { total: claims.length, byType: {} };
  claims.forEach(c => { const k = classificarClaim(c.statement || c.text || ''); report.steps.claims.byType[k] = (report.steps.claims.byType[k]||0)+1; });

  // 4. Statistics — números sem fonte
  const nums = detectarNumerosSuspeitos(textoCompleto);
  const numsSemFonte = nums.filter(n => {
    const ctx = textoCompleto.substring(Math.max(0, n.index - 120), n.index + 120);
    return !/\(.*\d{4}\)|\[.*\]|Fonte:|INE|OMS|Banco Mundial/.test(ctx);
  });
  report.steps.statistics = { total: nums.length, semFonte: numsSemFonte.length, exemplos: numsSemFonte.slice(0,3).map(n=>n.raw) };
  if (numsSemFonte.length > 0 && isStrict()) { report.warnings += numsSemFonte.length; }
  if (numsSemFonte.length > 3) report.critical++;

  // 5. Datasets
  report.steps.datasets = { provided: datasets.length, totalRows: datasets.reduce((a,d)=>a+(d.row_count||0),0) };
  // 6. Methodology vs results — ignora negações ("não houve", "sem coleta")
  const m = metodologia.toLowerCase();
  const temMetodologiaQuant = /quantitativa|amostra|entrevist|questionário|n\s*=\s*\d+/.test(m);
  const textoSemNegacao = textoCompleto.replace(/não[^.]{0,40}(entrevistados|participantes|amostra|coleta)/gi, '');
  const temResultadosEmpiricos = /(\d+%)|entrevistados|participantes|amostra de \d+/i.test(textoSemNegacao);
  report.steps.methodology = { temMetodologiaQuant, temResultadosEmpiricos, metodologia };
  if (temResultadosEmpiricos && datasets.length === 0 && /n\s*=\s*\d+/.test(m)) {
    report.critical++;
    report.fabricatedData++;
    report.details.methodologyError = 'Metodologia promete n participantes mas nenhum dataset fornecido';
  }
  if (!temMetodologiaQuant && temResultadosEmpiricos) {
    report.warnings++;
    report.details.empiricalWithoutMethod = true;
  }

  // 7-8. Tables/Figures — exigem source_id/dataset_id
  const temTabela = /<table|Tabela \d+|Gráfico \d+/i.test(textoCompleto);
  report.steps.tables = { temTabela, rastreavel: datasets.length > 0 ? 1 : 0 };
  if (temTabela && datasets.length === 0) report.warnings++;

  // 9-11. Fabricação
  const temFabricacaoEmpirica = temResultadosEmpiricos && datasets.length === 0 && isStrict();
  if (temFabricacaoEmpirica) { report.fabricatedData++; report.critical++; }

  // 12-14. Consistency: objetivos → resultados → conclusão
  const temObjetivos = /objetivo|objectivo/i.test(textoCompleto);
  const temConclusao = /conclus[aã]o/i.test(textoCompleto);
  report.steps.consistency = { temObjetivos, temConclusao };

  // 15. Integrity report via policy
  const integrity = gerarRelatorioIntegridade(claims);
  report.details.integrity = integrity;

  // Score 0-100 (não mede beleza, mede verificabilidade)
  const fontesVerificadas = 0; // TODO: picks após verificação real CrossRef
  const claimsSustentados = Math.max(0, claims.length - report.warnings - report.critical);
  const rastreaveis = datasets.length > 0 ? 1 : 0;
  const metodologiaCoerente = report.details.methodologyError ? 0 : 1;
  const semFabricados = report.fabricatedData === 0 ? 1 : 0;
  const transparencia = 1; // TODO: contar [CITAÇÃO A VERIFICAR]
  report.score = Math.round(
    (fontesVerificadas*0.2 + (claimsSustentados/Math.max(1,claims.length))*30 + rastreaveis*20 + metodologiaCoerente*10 + semFabricados*20)
  );
  // clamp e mapear: se crítico >0, max 59
  if (report.critical > 0) report.score = Math.min(report.score, 59);
  if (report.fabricatedData > 0) report.score = Math.min(report.score, 39);

  report.blocked = report.critical > 0 && isStrict();
  report.label = report.score >=90 ? 'EXCELENTE' : report.score >=75 ? 'BOM' : report.score >=60 ? 'REVISAR' : report.score >=40 ? 'RISCO ALTO' : 'NÃO PUBLICÁVEL';

  // ── GATE UNIFICADO (fonte única de verdade para UI + export) ──
  // Computa canExportFinal considerando TODAS as regras de bloqueio FINAL,
  // não apenas critical>0. Anexado ao report para consumo idêntico por UI e exportador.
  const gate = computeFinalGate(report, { _internal: true });
  report.canExportFinal = gate.canExportFinal;
  report.finalBlocked = gate.blocked;
  report.finalReasons = gate.reasons;
  // publishedGate: API pública única — UI e export DEVEM consumir este campo, não recomputar regra local.

  return report;
}

export function deveBloquearExport(report) {
  if (!report) return true;
  // Fonte única: se report já traz gate unificado, usar ele (evita divergência UI vs export)
  if (typeof report.canExportFinal === 'boolean') return !report.canExportFinal;
  if (typeof report.finalBlocked === 'boolean') return report.finalBlocked;
  return isStrict() && (report.blocked || report.fabricatedData > 0 || report.score < 40);
}

/* ═══════════════════════════════════════════════════════════
   GATE UNIFICADO — REGRA DESEJADA (ESPECIFICAÇÃO DO UTILIZADOR)
   Se existir QUALQUER:
   • citação sem source_id
   • source_id não verificado
   • citação sem evidência
   • claim factual sem DIRECTLY/PARTIALLY_SUPPORTS
   • número factual sem evidência numérica
   • referência bibliográfica sem source real
   • problema severidade CRITICAL/HIGH obrigatório
   ENTÃO: FINAL = BLOQUEADO (🚫 NÃO PRONTO PARA FINAL)
   ═══════════════════════════════════════════════════════════ */
export function computeFinalGate(report, ctx = {}) {
  const reasons = [];
  if (!report) return { blocked: true, canExportFinal: false, reasons: ['Report ausente'] };

  // 1) Gate clássico (critical/fabricated/score<40)
  if (report.blocked) reasons.push(`critical=${report.critical} (blocked=true)`);
  if (report.fabricatedData > 0) reasons.push(`fabricatedData=${report.fabricatedData}`);
  if (report.score < 40) reasons.push(`score ${report.score}<40`);

  // 2) Citações ↔ Referências — deteta órfãs / sem source_id
  const cits = report.steps?.citations?.citacoes || 0;
  const refs = report.steps?.citations?.refs || 0;
  const orfas = Math.max(0, cits - refs);
  if (ctx.orphanCitations !== undefined) {
    if (ctx.orphanCitations > 0) reasons.push(`${ctx.orphanCitations} citação(ões) órfã(s) sem source_id`);
  } else if (cits > 0 && orfas > 0) {
    reasons.push(`${cits} citações → ${refs} refs — ${orfas} órfã(s)/sem source_id`);
  }
  if (ctx.hasUnverifiedCitations) reasons.push('citação(ões) com source_id não verificado');
  if (ctx.citationWithoutEvidence) reasons.push('citação(ões) sem evidência');

  // 3) Claims factuais sem suporte DIRECTLY/PARTIALLY
  //    details.integrity vem de gerarRelatorioIntegridade (FACT+UNVERIFIED => HIGH/REVIEW_REQUIRED)
  const integ = report.details?.integrity;
  if (integ) {
    if (integ.reviewRequired > 0) reasons.push(`${integ.reviewRequired} afirmação(ões) requer(em) revisão obrigatória (FACT sem DIRECTLY/PARTIALLY)`);
    if (integ.highCritical > 0) reasons.push(`${integ.highCritical} de severidade CRITICAL/HIGH`);
    if (integ.blocked > 0) reasons.push(`${integ.blocked} bloqueada(s)`);
  }
  // ctx overrides from doAnalisarDocumento (fonte externa quando pipeline unificado)
  if (ctx.reviewRequired > 0) reasons.push(`${ctx.reviewRequired} afirmação(ões) requer(em) revisão (ctx)`);
  if (ctx.highCritical > 0) reasons.push(`${ctx.highCritical} CRITICAL/HIGH (ctx)`);
  if (ctx.fabricatedCount > 0) reasons.push(`Fabricados: ${ctx.fabricatedCount}`);

  // 4) Números factuais sem evidência numérica
  const semFonte = report.steps?.statistics?.semFonte || 0;
  if (semFonte > 0) reasons.push(`${semFonte} número(s) factual(is) sem evidência numérica`);

  // 5) Referência bibliográfica sem source real (quando refs existem mas nenhuma verificada)
  //    Heurística: se cits>0 e refs<=2 mas cits=11 → quase tudo órfão → já capturado acima.
  //    Se ctx.verifyRate disponível:
  if (ctx.verifyRate !== undefined && ctx.verifyTotal > 0 && ctx.verifyRate < 50) {
    reasons.push(`taxa verificação ${ctx.verifyRate}% <50% (refs sem source real)`);
  }
  if (ctx.referenceWithoutSource) reasons.push('referência(s) bibliográfica(s) sem source real');

  // 6) Cobertura no_objectives / problemas argumentação
  if (ctx.coverageEstado === 'no_objectives') reasons.push('Cobertura: no_objectives (sem objetivos definidos)');
  if (ctx.coverageOrfaos > 0) reasons.push(`${ctx.coverageOrfaos} objetivo(s) órfão(s)`);
  if (ctx.argumentIssuesHigh > 0) reasons.push(`${ctx.argumentIssuesHigh} problema(s) de argumentação HIGH`);

  // 7) Scorecard qualidade insuficiente (34% -> F) — quando_ctx disponível
  if (ctx.qualityOverall !== undefined && ctx.qualityOverall < 50) reasons.push(`Qualidade académica ${ctx.qualityOverall}% — Insuficiente`);

  const blocked = reasons.length > 0;
  return { blocked, canExportFinal: !blocked, reasons };
}

// Helper público para audit: retorna lista de citações órfãs estimada
export function getOrphanCitations(report) {
  const cits = report?.steps?.citations?.citacoes || 0;
  const refs = report?.steps?.citations?.refs || 0;
  return Math.max(0, cits - refs);
}
