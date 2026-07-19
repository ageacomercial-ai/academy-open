/* academic/schemas/evidence.schema.js
   Níveis de confiança para afirmações e fontes no documento
============================================================================= */

/* ── Níveis de verificação ── */
export const CONFIDENCE_LEVELS = {
  VERIFIED:          'verified',           /* Fonte confirmada externamente */
  PARTIALLY_VERIFIED:'partially_verified', /* Alguns metadados confirmados */
  UNVERIFIED:        'unverified',         /* Não confirmada */
  USER_PROVIDED:     'user_provided',      /* Fornecida pelo utilizador */
  NEEDS_REVIEW:      'needs_review',       /* Precisa de revisão manual */
};

/* ── Estrutura de uma afirmação com evidência ── */
export function createClaim({ statement, source, sourceType, date, location, confidence, citation }) {
  return {
    statement:    String(statement || '').substring(0, 1000),
    source:       String(source || '').substring(0, 500),
    sourceType:   sourceType || 'unknown',
    date:         date || null,
    location:     location || null,
    confidence:   confidence || CONFIDENCE_LEVELS.NEEDS_REVIEW,
    citation:     citation || null,
    validatedAt:  null,
    validatedBy:  null,
  };
}

/* ── Tipos de afirmação ── */
export const CLAIM_TYPES = {
  FACT:           'fact',
  INTERPRETATION: 'interpretation',
  OPINION:        'opinion',
  HYPOTHESIS:     'hypothesis',
  RECOMMENDATION: 'recommendation',
};

/* ── Validar coerência de uma afirmação ── */
export function validarClaim(claim) {
  const issues = [];
  if (!claim.statement || claim.statement.length < 10) {
    issues.push('Afirmação demasiado curta ou vazia');
  }
  if (claim.source && claim.source.length < 3) {
    issues.push('Fonte parece incompleta');
  }
  if (claim.confidence === CONFIDENCE_LEVELS.NEEDS_REVIEW && claim.statement.length > 50) {
    issues.push('Afirmação longa sem fonte verificada');
  }
  return {
    valido: issues.length === 0,
    issues,
    confidence: claim.confidence,
  };
}

/* ── Schema de Diagnóstico Académico ── */
export function createDiagnosticSchema({
  title, topic, context, researchProblem, researchQuestion,
  generalObjective, specificObjectives, methodology, scope,
}) {
  return {
    title:              String(title || '').substring(0, 300),
    topic:              String(topic || '').substring(0, 300),
    context:            String(context || '').substring(0, 1000),
    researchProblem:    String(researchProblem || '').substring(0, 500),
    researchQuestion:   String(researchQuestion || '').substring(0, 500),
    generalObjective:   String(generalObjective || '').substring(0, 500),
    specificObjectives: (specificObjectives || []).slice(0, 8).map(s => String(s).substring(0, 300)),
    methodology: {
      approach:   String(methodology?.approach || '').substring(0, 200),
      type:       String(methodology?.type || '').substring(0, 200),
      methods:    (methodology?.methods || []).slice(0, 6).map(s => String(s).substring(0, 200)),
      limitations: (methodology?.limitations || []).slice(0, 4).map(s => String(s).substring(0, 300)),
    },
    scope: {
      geographic: String(scope?.geographic || '').substring(0, 200),
      temporal:   String(scope?.temporal || '').substring(0, 200),
      thematic:   String(scope?.thematic || '').substring(0, 200),
    },
    createdAt: new Date().toISOString(),
    version: 1,
  };
}
