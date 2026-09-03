/* references-engine/utils/normalization.utils.js
   Normalização DOI/ISBN/título normalizado — secção 8-9
============================================================================= */

export function normalizeDoi(doi) {
  if (!doi) return null;
  return doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//,'').trim();
}
export function normalizeIsbn(isbn) {
  if (!isbn) return null;
  return isbn.replace(/[-\s]/g,'').toUpperCase();
}
export function normalizeTitle(title) {
  if (!title) return '';
  return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
export function normalizeTitleAuthorYear(title, authors, year) {
  const t=normalizeTitle(title);
  const a=(authors||[]).map(x=> (x.name||x).toLowerCase()).join('|');
  return `${t}::${a}::${year||''}`;
}
