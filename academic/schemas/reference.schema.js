/* academic/schemas/reference.schema.js
   Schema e validação de referências bibliográficas
============================================================================= */

import { CONFIDENCE_LEVELS } from './evidence.schema.js';

/* ── Estrutura de uma referência ── */
export function createReference(raw) {
  const ref = {
    raw:          String(raw || '').trim(),
    confidence:   CONFIDENCE_LEVELS.UNVERIFIED,
    author:       null,
    year:         null,
    title:        null,
    publisher:    null,
    doi:          null,
    isbn:         null,
    url:          null,
    accessedAt:   null,
    issues:       [],
  };

  if (!ref.raw) return ref;

  const anoMatch = ref.raw.match(/\((\d{4})\)/);
  ref.year = anoMatch ? parseInt(anoMatch[1]) : null;

  const autorMatch = ref.raw.match(/^([A-ZÀ-Ü][^,]+,\s*[A-Z\.]+\s*(?:&amp;\s*[A-ZÀ-Ü][^,]+,\s*[A-Z\.]+\s*)*)/);
  ref.author = autorMatch ? autorMatch[1].trim() : null;

  if (!ref.year) ref.issues.push('Ano ausente ou inválido');
  if (!ref.author) ref.issues.push('Autor ausente ou formato inválido');
  if (ref.raw.length < 30) ref.issues.push('Referência demasiado curta');

  return ref;
}

export function validarReferencia(ref) {
  const issues = [...(ref.issues || [])];
  if (ref.year && (ref.year < 1900 || ref.year > new Date().getFullYear() + 1)) {
    issues.push(`Ano fora do intervalo esperado: ${ref.year}`);
  }
  return {
    valida: issues.length === 0,
    issues,
    confidence: ref.confidence,
    ref,
  };
}

export function marcarConfianca(ref, nivel) {
  ref.confidence = nivel;
  return ref;
}
