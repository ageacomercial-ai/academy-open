/* academic/policies/integrity.js
   Estados de integridade do documento e transições
   DRAFT → REVIEW_REQUIRED → ACADEMICALLY_READY | BLOCKED
============================================================================= */

import { gerarRelatorioIntegridade } from './confidence-policy.js';

/* ── Estados ── */
export const INTEGRITY_STATE = {
  DRAFT:              'draft',
  REVIEW_REQUIRED:    'review_required',
  ACADEMICALLY_READY: 'academically_ready',
  BLOCKED:            'blocked',
};

/* ── Determinar estado de integridade a partir das afirmações ── */
export function determinarEstadoDocumento(claims) {
  const relatorio = gerarRelatorioIntegridade(claims);

  if (relatorio.estado === 'blocked') {
    return {
      state:  INTEGRITY_STATE.BLOCKED,
      label:  'Bloqueado',
      reason: `${relatorio.blocked} afirmação(ões) bloqueada(s) — requer acção imediata.`,
      relatorio,
    };
  }

  if (relatorio.estado === 'review_required') {
    return {
      state:  INTEGRITY_STATE.REVIEW_REQUIRED,
      label:  'Revisão Necessária',
      reason: `${relatorio.reviewRequired} afirmação(ões) requer(em) revisão obrigatória, ${relatorio.highCritical} de alta/crítica severidade.`,
      relatorio,
    };
  }

  if (relatorio.estado === 'accept' && relatorio.total > 0) {
    return {
      state:  INTEGRITY_STATE.ACADEMICALLY_READY,
      label:  'Academicamente Pronto',
      reason: 'Todas as afirmações estão verificadas ou aceites conforme a política.',
      relatorio,
    };
  }

  /* Sem afirmações → DRAFT */
  return {
    state:  INTEGRITY_STATE.DRAFT,
    label:  'Rascunho',
    reason: 'Documento sem afirmações analisadas.',
    relatorio: { integro: true, alerts: 0, blocked: 0, reviewRequired: 0, total: 0, resultados: [] },
  };
}

/* ── Verificar se o documento pode ser entregue ── */
export function isProntoParaEntrega(integrityResult) {
  return integrityResult.state === INTEGRITY_STATE.ACADEMICALLY_READY;
}

/* ── Obter lista de acções correctivas necessárias ── */
export function getAcoesCorretivas(integrityResult) {
  if (!integrityResult.relatorio || !integrityResult.relatorio.resultados) return [];

  return integrityResult.relatorio.resultados
    .filter(r => r.avaliacao.decision !== 'accept')
    .map(r => ({
      claimIdx: r.claim.index,
      claimText: (r.claim.statement || '').substring(0, 100),
      type:      r.claim.classifiedAs || r.claim.type,
      confidence: r.claim.confidence,
      severity:  r.avaliacao.severity,
      decision:  r.avaliacao.decision,
    }));
}
