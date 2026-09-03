/* academic/engines/search.js
   EVIDENCE-FIRST SEARCH — 5 providers gratuitos, paralelos, normalizados
   PLATFORM_SCOPE=GLOBAL — geografia vem do claim, não da plataforma
============================================================================= */

const TIMEOUT = 8000;
const CONCURRENCY_LIMIT = 4;

/* ── Normalizado ── */
function norm({ provider, title, authors, year, doi, isbn, url, publisher, journal, abstract, source_type, is_open_access, full_text_url, raw }) {
  return {
    source_id: doi || isbn || url || `${provider}:${title}:${year}`,
    provider,
    title: (title || '').trim(),
    authors: Array.isArray(authors) ? authors : (authors ? [authors] : []),
    year: year ? parseInt(year) : null,
    doi: doi || null,
    isbn: isbn || null,
    url: url || null,
    publisher: publisher || null,
    journal: journal || null,
    abstract: abstract || null,
    source_type: source_type || 'JOURNAL_ARTICLE',
    is_open_access: !!is_open_access,
    full_text_url: full_text_url || null,
    raw_metadata: raw || {},
  };
}

/* ── Helpers ── */
async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ACADEMY/1.0 (mailto:academy@agea.ao)', ...opts.headers } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* ── OpenAlex ── */
export async function searchOpenAlex(query, limit = 5) {
  const q = encodeURIComponent(query);
  const url = `https://api.openalex.org/works?filter=title.search:${q}&per-page=${limit}&select=id,display_name,authorships,publication_year,doi,primary_location,open_access,abstract_inverted_index`;
  const j = await fetchJson(url);
  const results = j.results || j || [];
  return (Array.isArray(results) ? results : []).slice(0, limit).map(w => {
    const authors = (w.authorships || []).map(a => a.author?.display_name).filter(Boolean);
    const doi = w.doi ? w.doi.replace('https://doi.org/', '') : null;
    // abstract_inverted_index → texto
    let abstract = null;
    if (w.abstract_inverted_index) {
      const entries = Object.entries(w.abstract_inverted_index);
      const arr = [];
      for (const [word, pos] of entries) for (const p of pos) arr[p] = word;
      abstract = arr.join(' ').substring(0, 800);
    }
    return norm({
      provider: 'openalex',
      title: w.display_name,
      authors,
      year: w.publication_year,
      doi,
      url: w.id,
      publisher: w.primary_location?.source?.display_name || null,
      journal: w.primary_location?.source?.display_name || null,
      abstract,
      source_type: 'JOURNAL_ARTICLE',
      is_open_access: !!w.open_access?.is_oa,
      full_text_url: w.open_access?.oa_url || null,
      raw: w,
    });
  });
}

/* ── Crossref ── */
export async function searchCrossref(query, limit = 5) {
  const q = encodeURIComponent(query);
  const url = `https://api.crossref.org/works?query=${q}&rows=${limit}&select=title,author,issued,DOI,container-title,publisher,URL,abstract`;
  const j = await fetchJson(url);
  const items = j.message?.items || [];
  return items.slice(0, limit).map(it => {
    const title = Array.isArray(it.title) ? it.title[0] : it.title;
    const authors = (it.author || []).map(a => `${a.family || ''} ${a.given || ''}`.trim()).filter(Boolean);
    const year = it.issued?.['date-parts']?.[0]?.[0] || null;
    return norm({
      provider: 'crossref',
      title,
      authors,
      year,
      doi: it.DOI || null,
      url: it.URL || (it.DOI ? `https://doi.org/${it.DOI}` : null),
      publisher: it.publisher || null,
      journal: Array.isArray(it['container-title']) ? it['container-title'][0] : it['container-title'],
      abstract: it.abstract ? it.abstract.replace(/<[^>]+>/g, '').substring(0, 800) : null,
      source_type: 'JOURNAL_ARTICLE',
      is_open_access: false,
      raw: it,
    });
  });
}

/* ── Semantic Scholar ── */
export async function searchSemanticScholar(query, limit = 5) {
  const q = encodeURIComponent(query);
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=${limit}&fields=title,authors,year,externalIds,url,abstract,venue,publicationTypes,isOpenAccess,openAccessPdf`;
  const j = await fetchJson(url);
  const data = j.data || [];
  return data.slice(0, limit).map(p => {
    const doi = p.externalIds?.DOI || null;
    return norm({
      provider: 'semantic_scholar',
      title: p.title,
      authors: (p.authors || []).map(a => a.name).filter(Boolean),
      year: p.year,
      doi,
      url: p.url || (doi ? `https://doi.org/${doi}` : null),
      publisher: p.venue || null,
      journal: p.venue || null,
      abstract: p.abstract || null,
      source_type: 'JOURNAL_ARTICLE',
      is_open_access: !!p.isOpenAccess,
      full_text_url: p.openAccessPdf?.url || null,
      raw: p,
    });
  });
}

/* ── Europe PMC ── */
export async function searchEuropePMC(query, limit = 5) {
  const q = encodeURIComponent(query);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=${limit}&resultType=core`;
  const j = await fetchJson(url);
  const list = j.resultList?.result || [];
  return list.slice(0, limit).map(r => norm({
    provider: 'europe_pmc',
    title: r.title,
    authors: r.authorString ? r.authorString.split(',').map(s => s.trim()) : [],
    year: r.pubYear ? parseInt(r.pubYear) : null,
    doi: r.doi || null,
    url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
    publisher: r.journalTitle || null,
    journal: r.journalTitle || null,
    abstract: r.abstractText || null,
    source_type: 'JOURNAL_ARTICLE',
    is_open_access: r.isOpenAccess === 'Y',
    full_text_url: r.fullTextUrlList?.fullTextUrl?.[0]?.url || null,
    raw: r,
  }));
}

/* ── Open Library ── */
export async function searchOpenLibrary(query, limit = 5) {
  const q = encodeURIComponent(query);
  const url = `https://openlibrary.org/search.json?q=${q}&limit=${limit}&fields=title,author_name,first_publish_year,isbn,publisher,key`;
  const j = await fetchJson(url);
  const docs = j.docs || [];
  return docs.slice(0, limit).map(d => norm({
    provider: 'open_library',
    title: d.title,
    authors: d.author_name || [],
    year: d.first_publish_year || null,
    isbn: d.isbn?.[0] || null,
    url: d.key ? `https://openlibrary.org${d.key}` : null,
    publisher: d.publisher?.[0] || null,
    abstract: null,
    source_type: 'BOOK',
    is_open_access: false,
    raw: d,
  }));
}

/* ── Deduplicação ── */
function dedup(sources) {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    const key = (s.doi?.toLowerCase() || s.isbn || s.url || `${s.title.toLowerCase()}:${(s.authors[0]||'').toLowerCase()}:${s.year}`).trim();
    if (!key || seen.has(key)) continue;
    // similaridade título >0.85
    const dup = out.find(o => {
      if (!o.title || !s.title) return false;
      const a = o.title.toLowerCase().split(/\s+/);
      const b = s.title.toLowerCase().split(/\s+/);
      const inter = a.filter(w => b.includes(w)).length;
      return inter / Math.max(a.length, b.length) > 0.85;
    });
    if (dup) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/* ── Ranking L1→L4 + relevância ── */
const TIPO_PESO = { JOURNAL_ARTICLE: 10, BOOK: 8, CONFERENCE: 7, THESIS: 6, REPORT: 5, WEBSITE: 2 };
export function rankSources(sources, claim) {
  const claimGeo = (claim?.geographic_scope || []).join(' ').toLowerCase();
  const claimText = (claim?.text || '').toLowerCase();
  return sources.map(s => {
    let score = 0;
    score += TIPO_PESO[s.source_type] || 3;
    if (s.is_open_access) score += 2;
    if (s.abstract) score += 2;
    if (s.doi) score += 1;
    if (s.year && s.year >= 2015) score += 1;
    // geographic_match
    if (claimGeo && s.title.toLowerCase().includes(claimGeo)) score += 2;
    // recency
    if (s.year && s.year >= 2020) score += 1;
    // authority: publisher/journal contains known
    if (/nature|science|lancet|elsevier|springer|wiley|ieee|acm/i.test(s.publisher || '')) score += 2;
    // relevance: claim keywords in title/abstract
    const kws = claimText.split(/\s+/).filter(w => w.length > 5).slice(0, 5);
    for (const kw of kws) if (s.title.toLowerCase().includes(kw) || s.abstract?.toLowerCase().includes(kw)) score += 1;
    return { ...s, _rank: score };
  }).sort((a,b) => b._rank - a._rank);
}

/* ── Pesquisa paralela com limite ── */
export async function searchAll(query, opts = {}) {
  const limit = opts.limit || 5;
  const providers = opts.providers || ['openalex','crossref','semantic_scholar','europe_pmc','open_library'];
  const map = {
    openalex: () => searchOpenAlex(query, limit),
    crossref: () => searchCrossref(query, limit),
    semantic_scholar: () => searchSemanticScholar(query, limit),
    europe_pmc: () => searchEuropePMC(query, limit),
    open_library: () => searchOpenLibrary(query, limit),
  };
  const tasks = providers.filter(p => map[p]).map(p => map[p]().catch(e => { console.warn(`[SEARCH] ${p} falhou:`, e.message); return []; }));
  // concorrência limitada via allSettled já é paralela, mas respeita timeout 8s cada
  const results = await Promise.allSettled(tasks);
  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const uniq = dedup(all);
  return uniq.slice(0, limit * 2);
}

/* ── Cache Supabase (opcional, se env) ── */
export async function cachedSearch(query, claim) {
  // tenta cache por query_hash
  // se Supabase não configurado, vai direto para searchAll
  return searchAll(query, { limit: 5 });
}
