/* academic/engines/claims.js
   Extração de claims antes da redação — EVIDENCE-FIRST
============================================================================= */

import { determinarEscopo } from '../policies/scope.js';

const CLAIM_TYPES = ['STATISTICAL','CAUSAL','EMPIRICAL','HISTORICAL','DEFINITIONAL','COMPARATIVE','THEORETICAL','PREDICTIVE','GENERAL'];

function classificarTipo(text) {
  const t = text.toLowerCase();
  if (/\d+(?:[.,]\d+)?\s*%|\b\d+\s*(toneladas|habitantes|pessoas)\b/.test(t)) return 'STATISTICAL';
  if (/\b(causa|causado|leva a|resulta em|impacto|efeito)\b/.test(t)) return 'CAUSAL';
  if (/\b(entrevistados|amostra|questionário|entrevista|observados|medidos)\b/.test(t)) return 'EMPIRICAL';
  if (/\b(em \d{4}|desde \d{4}|história|evolução)\b/.test(t)) return 'HISTORICAL';
  if (/\b(define-se|é definido|conceito de)\b/.test(t)) return 'DEFINITIONAL';
  if (/\b(comparado|versus|maior que|menor que|diferença)\b/.test(t)) return 'COMPARATIVE';
  if (/\b(teoria|modelo|framework|abordagem)\b/.test(t)) return 'THEORETICAL';
  if (/\b(previsão|tendência|futuro|projeção)\b/.test(t)) return 'PREDICTIVE';
  return 'GENERAL';
}

export function extrairClaims(tema, objetivos = [], problema = '') {
  const escopo = determinarEscopo({ tema, objetivos, problema });
  const base = [tema, problema, ...objetivos].join(' | ');
  // Claims a partir do plano: cada objetivo + problema gera um claim
  const claims = [];
  let id = 0;
  const add = (text, priority = 1) => {
    const tipo = classificarTipo(text);
    const requires_source = !['DEFINITIONAL','GENERAL'].includes(tipo);
    const requires_numeric = tipo === 'STATISTICAL' || tipo === 'EMPIRICAL';
    claims.push({
      id: `claim_${++id}`,
      text: text.trim(),
      claim_type: tipo,
      requires_source,
      requires_numeric_evidence: requires_numeric,
      geographic_scope: escopo.geographic_scope,
      temporal_scope: [],
      priority,
      escopo,
    });
  };
  if (problema) add(problema, 3);
  objetivos.forEach(o => add(o, 2));
  // Claim implícito do tema
  add(`O tema "${tema}" requer fundamentação`, 1);
  return claims;
}

export function gerarQueries(claim) {
  // Gera 2-3 queries por claim
  const base = claim.text.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 6).join(' ');
  const queries = [base];
  if (claim.geographic_scope.length) {
    const geo = claim.geographic_scope[0];
    queries.push(`${base} ${geo}`);
  }
  if (claim.claim_type === 'STATISTICAL') queries.push(`${base} statistics`);
  return queries.slice(0, 3).filter(Boolean);
}

export function deveExigirFonte(claim) {
  return claim.requires_source;
}
