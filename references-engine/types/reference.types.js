/* references-engine/types/reference.types.js
   Estrutura interna única Reference — secção 8 da missão
============================================================================= */

/**
 * @typedef {Object} Reference
 * @property {string} id - UUID interno
 * @property {string} title
 * @property {{name:string}[]} authors
 * @property {number|null} publicationYear
 * @property {string|null} abstract
 * @property {string|null} doi
 * @property {string|null} url
 * @property {string} source - ex: openalex|crossref|semantic_scholar|google_books
 * @property {string|null} journal
 * @property {string|null} publisher
 * @property {string|null} volume
 * @property {string|null} issue
 * @property {string|null} pages
 * @property {string|null} isbn
 * @property {number} citationCount
 * @property {string|null} language
 * @property {string} documentType - article|book|book_chapter|report|thesis
 * @property {boolean} verified
 * @property {string} verificationStatus - VERIFICADA|PARCIALMENTE_VERIFICADA|NAO_VERIFICADA
 * @property {number} relevanceScore - 0-100
 * @property {string[]} origins - fontes que forneceram esta ref (para dedup)
 */

export function createReference(data={}) {
  return {
    id: data.id || `ref_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    title: (data.title||'').trim().slice(0,500),
    authors: Array.isArray(data.authors) ? data.authors.slice(0,8).map(a=> typeof a==='string'? {name:a}: a) : [],
    publicationYear: data.publicationYear || data.year || null,
    abstract: data.abstract || null,
    doi: data.doi || null,
    url: data.url || null,
    source: data.source || 'unknown',
    journal: data.journal || null,
    publisher: data.publisher || null,
    volume: data.volume || null,
    issue: data.issue || null,
    pages: data.pages || null,
    isbn: data.isbn || null,
    citationCount: data.citationCount||0,
    language: data.language||null,
    documentType: data.documentType||'article',
    verified: !!data.verified,
    verificationStatus: data.verificationStatus||'NAO_VERIFICADA',
    relevanceScore: data.relevanceScore||0,
    origins: data.origins||[data.source||'unknown'],
    created_at: data.created_at||new Date().toISOString(),
  };
}
