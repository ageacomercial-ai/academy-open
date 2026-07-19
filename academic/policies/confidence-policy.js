/* academic/policies/confidence-policy.js
   Matriz de decisão baseada em tipo de afirmação × nível de confiança
   Define o comportamento do sistema para cada combinação.
============================================================================= */

import { CONFIDENCE_LEVELS } from '../schemas/evidence.schema.js';
import { CLAIM_TYPES } from '../schemas/evidence.schema.js';

/* ── Decisões da matriz ── */
export const DECISIONS = {
  ACCEPT:                'accept',
  ACCEPT_WITH_ALERT:     'accept_with_alert',
  REVIEW_REQUIRED:       'review_required',
  BLOCKED:               'blocked',
  CAN_KEEP_IF_IDENTIFIED:'can_keep_if_identified',
  CAN_KEEP_AS_OPINION:   'can_keep_as_opinion',
  CAN_KEEP_AS_HYPOTHESIS:'can_keep_as_hypothesis',
  CAN_KEEP_AS_RECOMMENDATION: 'can_keep_as_recommendation',
};

/* ── Severidade ── */
export const SEVERITY = {
  LOW:      'low',
  MEDIUM:   'medium',
  HIGH:     'high',
  CRITICAL: 'critical',
};

/* ── Matriz de decisão: type × confidence → { decision, severity, message } ── */
const MATRIX = {
  [CLAIM_TYPES.FACT]: {
    [CONFIDENCE_LEVELS.VERIFIED]:           { decision: DECISIONS.ACCEPT,                 severity: SEVERITY.LOW,     message: 'Facto verificado — pode ser utilizado como evidência confirmada.' },
    [CONFIDENCE_LEVELS.PARTIALLY_VERIFIED]: { decision: DECISIONS.ACCEPT_WITH_ALERT,      severity: SEVERITY.MEDIUM,  message: 'Facto parcialmente verificado — requer confirmação adicional.' },
    [CONFIDENCE_LEVELS.UNVERIFIED]:         { decision: DECISIONS.REVIEW_REQUIRED,        severity: SEVERITY.HIGH,    message: 'Facto não verificado — revisão obrigatória antes de usar como evidência.' },
    [CONFIDENCE_LEVELS.USER_PROVIDED]:      { decision: DECISIONS.ACCEPT_WITH_ALERT,      severity: SEVERITY.MEDIUM,  message: 'Facto fornecido pelo utilizador — identificar como fonte não externa.' },
    [CONFIDENCE_LEVELS.NEEDS_REVIEW]:       { decision: DECISIONS.REVIEW_REQUIRED,        severity: SEVERITY.HIGH,    message: 'Facto necessita revisão — não pode ser usado sem aprovação.' },
  },
  [CLAIM_TYPES.INTERPRETATION]: {
    [CONFIDENCE_LEVELS.VERIFIED]:           { decision: DECISIONS.ACCEPT,                 severity: SEVERITY.LOW,     message: 'Interpretação baseada em fonte verificada.' },
    [CONFIDENCE_LEVELS.PARTIALLY_VERIFIED]: { decision: DECISIONS.ACCEPT_WITH_ALERT,      severity: SEVERITY.LOW,     message: 'Interpretação com verificação parcial.' },
    [CONFIDENCE_LEVELS.UNVERIFIED]:         { decision: DECISIONS.CAN_KEEP_IF_IDENTIFIED, severity: SEVERITY.MEDIUM,  message: 'Interpretação não verificada — pode ser mantida se identificada como tal.' },
    [CONFIDENCE_LEVELS.USER_PROVIDED]:      { decision: DECISIONS.ACCEPT_WITH_ALERT,      severity: SEVERITY.LOW,     message: 'Interpretação baseada em dados do utilizador.' },
    [CONFIDENCE_LEVELS.NEEDS_REVIEW]:       { decision: DECISIONS.REVIEW_REQUIRED,        severity: SEVERITY.MEDIUM,  message: 'Interpretação pendente de revisão.' },
  },
  [CLAIM_TYPES.OPINION]: {
    [CONFIDENCE_LEVELS.VERIFIED]:           { decision: DECISIONS.CAN_KEEP_AS_OPINION,    severity: SEVERITY.LOW,     message: 'Opinião explícita — pode ser mantida como tal.' },
    [CONFIDENCE_LEVELS.PARTIALLY_VERIFIED]: { decision: DECISIONS.CAN_KEEP_AS_OPINION,    severity: SEVERITY.LOW,     message: 'Opinião com suporte parcial.' },
    [CONFIDENCE_LEVELS.UNVERIFIED]:         { decision: DECISIONS.CAN_KEEP_AS_OPINION,    severity: SEVERITY.LOW,     message: 'Opinião não verificada — aceite como posição do autor.' },
    [CONFIDENCE_LEVELS.USER_PROVIDED]:      { decision: DECISIONS.CAN_KEEP_AS_OPINION,    severity: SEVERITY.LOW,     message: 'Opinião do utilizador.' },
    [CONFIDENCE_LEVELS.NEEDS_REVIEW]:       { decision: DECISIONS.CAN_KEEP_AS_OPINION,    severity: SEVERITY.LOW,     message: 'Opinião pendente de revisão.' },
  },
  [CLAIM_TYPES.HYPOTHESIS]: {
    [CONFIDENCE_LEVELS.VERIFIED]:           { decision: DECISIONS.CAN_KEEP_AS_HYPOTHESIS, severity: SEVERITY.LOW,     message: 'Hipótese verificada — pode ser apresentada como confirmada.' },
    [CONFIDENCE_LEVELS.PARTIALLY_VERIFIED]: { decision: DECISIONS.CAN_KEEP_AS_HYPOTHESIS, severity: SEVERITY.LOW,     message: 'Hipótese com suporte parcial.' },
    [CONFIDENCE_LEVELS.UNVERIFIED]:         { decision: DECISIONS.CAN_KEEP_AS_HYPOTHESIS, severity: SEVERITY.LOW,     message: 'Hipótese não verificada — aceite como tal, não como facto.' },
    [CONFIDENCE_LEVELS.USER_PROVIDED]:      { decision: DECISIONS.CAN_KEEP_AS_HYPOTHESIS, severity: SEVERITY.LOW,     message: 'Hipótese fornecida pelo utilizador.' },
    [CONFIDENCE_LEVELS.NEEDS_REVIEW]:       { decision: DECISIONS.CAN_KEEP_AS_HYPOTHESIS, severity: SEVERITY.LOW,     message: 'Hipótese pendente de revisão.' },
  },
  [CLAIM_TYPES.RECOMMENDATION]: {
    [CONFIDENCE_LEVELS.VERIFIED]:           { decision: DECISIONS.CAN_KEEP_AS_RECOMMENDATION, severity: SEVERITY.LOW,    message: 'Recomendação baseada em evidência verificada.' },
    [CONFIDENCE_LEVELS.PARTIALLY_VERIFIED]: { decision: DECISIONS.CAN_KEEP_AS_RECOMMENDATION, severity: SEVERITY.LOW,    message: 'Recomendação com suporte parcial.' },
    [CONFIDENCE_LEVELS.UNVERIFIED]:         { decision: DECISIONS.CAN_KEEP_AS_RECOMMENDATION, severity: SEVERITY.LOW,    message: 'Recomendação não verificada — aceite como proposta.' },
    [CONFIDENCE_LEVELS.USER_PROVIDED]:      { decision: DECISIONS.CAN_KEEP_AS_RECOMMENDATION, severity: SEVERITY.LOW,    message: 'Recomendação do utilizador.' },
    [CONFIDENCE_LEVELS.NEEDS_REVIEW]:       { decision: DECISIONS.CAN_KEEP_AS_RECOMMENDATION, severity: SEVERITY.LOW,    message: 'Recomendação pendente de revisão.' },
  },
};

/* ── Estado actual de todas as decisões —─ */
export function getPolicies() {
  return MATRIX;
}

/* ── Avaliar uma afirmação contra a matriz ── */
export function avaliarAfirmacao(claim) {
  const type       = claim.classifiedAs || claim.type || CLAIM_TYPES.INTERPRETATION;
  const confidence = claim.confidence || CONFIDENCE_LEVELS.UNVERIFIED;
  const hasExplicitSeverity = claim.severity && claim.severity !== SEVERITY.HIGH;
  const severity   = hasExplicitSeverity ? claim.severity : null;

  const row = MATRIX[type];
  if (!row) {
    return {
      decision:   DECISIONS.REVIEW_REQUIRED,
      severity:   SEVERITY.HIGH,
      message:    `Tipo de afirmação desconhecido: "${type}". Revisão obrigatória.`,
      type,
      confidence,
    };
  }

  const policy = row[confidence];
  if (!policy) {
    return {
      decision:   DECISIONS.REVIEW_REQUIRED,
      severity:   SEVERITY.HIGH,
      message:    `Combinação não prevista: ${type} + ${confidence}. Revisão obrigatória.`,
      type,
      confidence,
    };
  }

  /* A severidade final é a MAIOR entre política e claim (se claim a tiver explicitamente definida) */
  const finalSeverity = (severity && severityRank(severity) > severityRank(policy.severity))
    ? severity
    : policy.severity;

  return {
    decision:   policy.decision,
    severity:   finalSeverity,
    message:    policy.message,
    type,
    confidence,
  };
}

/* ── Ranking de severidade para comparação ── */
function severityRank(s) {
  const ranks = { low: 0, medium: 1, high: 2, critical: 3 };
  return ranks[s] ?? 1;
}

/* ── Gerar relatório de integridade para uma lista de afirmações ── */
export function gerarRelatorioIntegridade(claims) {
  if (!claims || claims.length === 0) {
    return { integro: true, alerts: [], blocked: 0, reviewRequired: 0, total: 0 };
  }

  const resultados = claims.map(c => ({
    claim:    c,
    avaliacao: avaliarAfirmacao(c),
  }));

  const alerts       = resultados.filter(r => r.avaliacao.decision !== DECISIONS.ACCEPT);
  const blocked      = resultados.filter(r => r.avaliacao.decision === DECISIONS.BLOCKED);
  const reviewRequired = resultados.filter(r => r.avaliacao.decision === DECISIONS.REVIEW_REQUIRED);
  const highCritical = resultados.filter(r =>
    r.avaliacao.severity === SEVERITY.HIGH || r.avaliacao.severity === SEVERITY.CRITICAL
  );

  /* Decisão final: blocked se houver BLOCKED, review se houver REVIEW_REQUIRED ou HIGH/CRITICAL */
  let estado = 'accept';
  if (blocked.length > 0) estado = 'blocked';
  else if (reviewRequired.length > 0 || highCritical.length > 0) estado = 'review_required';

  return {
    integro:        estado === 'accept',
    estado,
    total:          claims.length,
    alerts:         alerts.length,
    blocked:        blocked.length,
    reviewRequired: reviewRequired.length,
    highCritical:   highCritical.length,
    resultados,
  };
}

/* ── Verificar se uma afirmação pode ser usada como evidência confirmada ── */
export function isEvidenciaConfirmada(claim) {
  const a = avaliarAfirmacao(claim);
  return a.decision === DECISIONS.ACCEPT;
}

/* ── Gerar acção correctiva para afirmações problemáticas ── */
export function gerarAcorrecao(claim) {
  const a = avaliarAfirmacao(claim);
  switch (a.decision) {
    case DECISIONS.REVIEW_REQUIRED:
      if (claim.classifiedAs === CLAIM_TYPES.FACT) {
        return { acao: 'solicitar_fonte', mensagem: 'Requer fonte verificável para este dado.' };
      }
      return { acao: 'marcar_revisao', mensagem: 'Requere revisão manual.' };
    case DECISIONS.ACCEPT_WITH_ALERT:
      return { acao: 'adicionar_alerta', mensagem: a.message };
    case DECISIONS.CAN_KEEP_IF_IDENTIFIED:
      return { acao: 'reformular_como_interpretacao', mensagem: 'Reformular explicitamente como interpretação.' };
    default:
      return { acao: 'nenhuma', mensagem: '' };
  }
}
