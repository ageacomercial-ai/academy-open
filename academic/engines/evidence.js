/* academic/engines/evidence.js
   Etapa 3: Gestão de Evidências
   Cria, valida e classifica afirmações com níveis de confiança
============================================================================= */

import { createClaim, validarClaim, CLAIM_TYPES, CONFIDENCE_LEVELS } from '../schemas/index.js';

export function extrairAfirmacoes(texto, chapterIdx) {
  const frases = texto
    .split(/[.!?]\s+/)
    .filter(f => f.trim().length > 30);

  return frases.map((frase, i) => {
    const claim = createClaim({
      statement:  frase.trim(),
      source:     extrairFonte(frase),
      sourceType: 'extracted',
      confidence: CONFIDENCE_LEVELS.UNVERIFIED,
      citation:   extrairCitacao(frase),
    });
    claim.chapterIdx = chapterIdx;
    claim.index = i;
    return claim;
  });
}

export function extrairFonte(texto) {
  const match = texto.match(/\((?:[^)]*?\b(?:citado|apud|apud)\b[^)]*?)\)/i) ||
                texto.match(/\(([^)]{5,200})\)/);
  return match ? match[1] : null;
}

export function extrairCitacao(texto) {
  /* (Autor, Ano) ou (ORG, Ano) — uppercase orgs como INE, OMS.
     Também aceita 19xx completo (não só 1900-1999 truncado) e anos com
     sufixo de letra (2020a, 2020b) — BUG-006. */
  const match = texto.match(/\(([A-ZÀ-Ü][A-ZÀ-Üa-zãçáàâéêíóôúõü,.&;\s]+(?:19|20)\d{2}[a-z]?[^)]*)\)/);
  if (match) return match[1];

  /* Autor (Ano) afirma — inclui SIGLAS maiúsculas (INE, OMS, ONU) que antes
     falhavam por a regex só aceitar minúsculas após a inicial (BUG-006). */
  const match2 = texto.match(/([A-ZÀ-Ü][A-Za-zà-ÿ]*(?:\s+(?:et\s+al\.|&\s*[A-ZÀ-Ü][A-Za-zà-ÿ]*))?)\s*\((19|20)(\d{2}[a-z]?)\)/);
  if (match2) return `${match2[1]}, ${match2[2]}${match2[3]}`;

  return null;
}

export function classificarAfirmacao(texto) {
  const lower = texto.toLowerCase().trim();

  if (/^recomenda[^-]/i.test(texto) || /^sugere[-se]/i.test(texto) || /^prop[ôo]e[-se]/i.test(texto) || /^recomenda-se/i.test(texto) || /^aconselha-se/i.test(texto)) {
    return CLAIM_TYPES.RECOMMENDATION;
  }
  if (/^hip[óo]tese/i.test(texto) || /^sup[oó]e-se/i.test(texto) || /^admite-se/i.test(texto) || /\bhipoteticamente\b/i.test(texto)) {
    return CLAIM_TYPES.HYPOTHESIS;
  }
  // BUG-011: taxonomia de 9 tipos (claims.js, pré-geração) marca qualquer
  // percentagem/estatística como STATISTICAL (requires_numeric_evidence=true),
  // mas esta taxonomia de 5 tipos (pós-geração) só apanhava números com 3+
  // dígitos (\d{3,}) — "15%"/"37%" (2 dígitos) escapavam para INTERPRETATION,
  // que na matriz de decisão tem severidade muito mais branda (MEDIUM,
  // CAN_KEEP_IF_IDENTIFIED) do que FACT (HIGH, REVIEW_REQUIRED). Mapeado aqui
  // para que qualquer claim com número/percentagem/unidade quantitativa seja
  // sempre tratado como FACT, alinhado com a taxonomia pré-geração.
  if (/\d+(?:[.,]\d+)?\s*%|\b\d{3,}\b|\b\d+(?:[.,]\d+)?\s*(toneladas|habitantes|pessoas|entrevistados|amostra|kz|usd|aoa)\b/i.test(texto)) {
    return CLAIM_TYPES.FACT;
  }
  if (/^segundo\s+(o\s+)?(dados|estat[ií]sticas|estudos)/i.test(texto)) {
    return CLAIM_TYPES.FACT;
  }
  if (/^na\s+minha\s+opini[ãa]o|^ao\s+meu\s+ver|^eu\s+(acho|penso|acredito|considero)/i.test(texto)) {
    return CLAIM_TYPES.OPINION;
  }

  if (lower.includes('isto significa que') || lower.includes('isso implica que') || lower.includes('interpreta-se')) {
    return CLAIM_TYPES.INTERPRETATION;
  }

  return CLAIM_TYPES.INTERPRETATION;
}

export function validarAfirmacoes(claims) {
  return claims.map(c => ({
    ...c,
    validation: validarClaim(c),
    classifiedAs: classificarAfirmacao(c.statement),
  }));
}
