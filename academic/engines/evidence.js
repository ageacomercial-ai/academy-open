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
  // BUG-006 FIX: regex unificada para (Autor, Ano) incluindo ORGs uppercase (INE, OMS, MINSA) e anos 1900-2099
  const match = texto.match(/\(([A-ZÀ-Ü]{2,}(?:\s*,\s*[A-ZÀ-Ü][^)]*)?|\s*[A-ZÀ-Ü][A-ZÀ-Üa-zãçáàâéêíóôúõü,.&\s]{2,80}?)\s*,?\s*\b(19|20)\d{2}[a-z]?\b[^)]*\)/);
  if (match) return match[0].slice(1,-1).trim();
  // Fallback: INE (2024) / OMS (2023)  — org 2-8 letras maiúsculas
  const mOrg = texto.match(/\b([A-Z]{2,8})\s*\((19|20)\d{2}[a-z]?\)/);
  if (mOrg) return `${mOrg[1]}, ${mOrg[0].match(/\b(19|20)\d{2}/)[0]}`;
  // Autor (Ano)
  const match2 = texto.match(/([A-ZÀ-Ü][a-zãçáàâéêíóôúõü]+(?:\s+(?:et\s+al\.|&\s*[A-ZÀ-Ü][a-zãçáàâéêíóôúõü]+))?)\s*\(((?:19|20)\d{2}[a-z]?)\)/);
  if (match2) return `${match2[1]}, ${match2[2]}`;
  return null;
}

export function classificarAfirmacao(texto) {
  const lower = texto.toLowerCase().trim();
  const hasNum = /\b\d+(?:[.,]\d+)?\s*(%|por cento|toneladas|habitantes|milhões)/i.test(texto);
  const hasYear = /\(\s*(19|20)\d{2}\s*\)/.test(texto) || /\b(19|20)\d{2}\b/.test(texto);
  if (/^recomenda[^-]/i.test(texto) || /^sugere[-se]/i.test(texto) || /^prop[ôo]e[-se]/i.test(texto) || /^recomenda-se/i.test(texto) || /^aconselha-se/i.test(texto)) return CLAIM_TYPES.RECOMMENDATION;
  if (/^hip[óo]tese/i.test(texto) || /^sup[oó]e-se/i.test(texto) || /^admite-se/i.test(texto) || /\bhipoteticamente\b/i.test(texto)) return CLAIM_TYPES.HYPOTHESIS;
  if (hasNum) return CLAIM_TYPES.FACT; // estatístico também é factual com fonte obrigatória
  if (/^segundo\s+(o\s+)?(dados|estat[ií]sticas|estudos)/i.test(texto) || /\b\d{3,}\b/.test(texto)) return CLAIM_TYPES.FACT;
  if (hasYear && /(história|histórico|em \d{4}|desde \d{4})/i.test(texto)) return CLAIM_TYPES.FACT; // histórico
  if (/^na\s+minha\s+opini[ãa]o|^ao\s+meu\s+ver|^eu\s+(acho|penso|acredito|considero)/i.test(texto)) return CLAIM_TYPES.OPINION;
  if (lower.includes('isto significa que') || lower.includes('isso implica que') || lower.includes('interpreta-se') || lower.includes('pode-se inferir')) return CLAIM_TYPES.INTERPRETATION;
  if (/em comparação|comparado a|versus|enquanto|ao passo que/i.test(texto)) return CLAIM_TYPES.INTERPRETATION; // comparação
  if (/define-se|entende-se por|conceito de/i.test(texto)) return CLAIM_TYPES.INTERPRETATION; // definição
  return CLAIM_TYPES.INTERPRETATION;
}

export function validarAfirmacoes(claims) {
  return claims.map(c => ({
    ...c,
    validation: validarClaim(c),
    classifiedAs: classificarAfirmacao(c.statement),
  }));
}
