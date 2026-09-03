/* academic/engines/verification.js
   Verificação de referências contra fontes externas
   CrossRef DOI, OpenLibrary ISBN, título/autor search
============================================================================= */

const CROSSREF_API  = 'https://api.crossref.org/works';
const OPENLIBRARY_API = 'https://openlibrary.org/api/books';
const TIMEOUT_MS    = 8000;

/* ── Verificar uma única referência ── */
export async function verificarReferenciaOnline(ref, opts = {}) {
  const resultado = {
    raw:        ref.raw || ref,
    confidence: 'unverified',
    matched:    false,
    attempts:   [],
    metadata:   null,
    error:      null,
  };

  const auth = ref.author || '';
  const year = ref.year || '';
  const title = ref.title || extrairTitulo(ref.raw || '');
  const doi = ref.doi || extrairDoi(ref.raw || '');

  /* 1. CrossRef por DOI (mais preciso) */
  if (doi) {
    try {
      const resp = await fetchWithRetry(`${CROSSREF_API}/${encodeURIComponent(doi)}`, TIMEOUT_MS);
      if (resp.ok) {
        const data = await resp.json();
        resultado.attempts.push('doi_crossref');
        resultado.matched = true;
        resultado.confidence = 'verified';
        resultado.metadata = extrairMetadataCrossRef(data);
        return resultado;
      }
    } catch (e) {
      resultado.attempts.push('doi_crossref_error');
    }
  }

  /* 2. CrossRef por título + autor */
  if (title && title.length > 10) {
    try {
      const query = encodeURIComponent(`${title} ${auth}`);
      const resp = await fetchWithRetry(`${CROSSREF_API}?query=${query}&rows=3`, TIMEOUT_MS);
      if (resp.ok) {
        const data = await resp.json();
        const items = data.message?.items || [];
        if (items.length > 0) {
          const best = encontrarMelhorMatch(items, title, auth, year);
          if (best.score >= 0.4) {
            resultado.attempts.push('crossref_query');
            resultado.matched = true;
            resultado.confidence = best.score >= 0.7 ? 'verified' : 'partially_verified';
            resultado.metadata = extrairMetadataCrossRef({ message: best.item });
            return resultado;
          }
        }
      }
    } catch (e) {
      resultado.attempts.push('crossref_query_error');
    }
  }

  /* 3. OpenLibrary por ISBN */
  const isbn = ref.isbn || extrairIsbn(ref.raw || '');
  if (isbn) {
    try {
      const resp = await fetchWithTimeout(`${OPENLIBRARY_API}?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, TIMEOUT_MS);
      if (resp.ok) {
        const data = await resp.json();
        const key = `ISBN:${isbn}`;
        if (data[key]) {
          resultado.attempts.push('isbn_openlibrary');
          resultado.matched = true;
          resultado.confidence = 'partially_verified';
          resultado.metadata = {
            title: data[key].title,
            authors: (data[key].authors || []).map(a => a.name),
            publisher: data[key].publishers?.[0]?.name,
            year: data[key].publish_date,
          };
          return resultado;
        }
      }
    } catch (e) {
      resultado.attempts.push('isbn_openlibrary_error');
    }
  }

  /* 4. Fallback — NUNCA promover a partially_verified/verified apenas por a
     referência "ter forma" (título+autor+ano). Isso permitia que qualquer
     referência inventada com formato plausível passasse como verificada
     (BUG-007 / BUG_MAP P0-3). A presença de erros de rede/timeout nas
     tentativas anteriores indica que NÃO sabemos se a fonte existe — nesse
     caso o estado correto é 'unverified' (não confundir com 'confirmámos que
     não existe'). Se as tentativas correram sem erro mas simplesmente não
     encontraram nada, o estado é 'needs_review' (revisão humana). Em nenhum
     caso o fallback estrutural sozinho pode gerar 'verified' ou
     'partially_verified'. */
  resultado.attempts.push('structural_only');
  const houveErroRede = resultado.attempts.some(a => /_error$/.test(a));
  resultado.confidence = houveErroRede ? 'unverified' : 'needs_review';

  return resultado;
}

/* ── Verificar lista de referências ── */
export async function verificarListaReferencias(lista, opts = {}) {
  const resultados = await Promise.allSettled(
    lista.map(ref => verificarReferenciaOnline(ref, opts))
  );

  const verified = resultados.filter(r => r.status === 'fulfilled' && r.value.confidence === 'verified');
  const partial = resultados.filter(r => r.status === 'fulfilled' && r.value.confidence === 'partially_verified');
  const unreviewed = resultados.filter(r => r.status === 'fulfilled' && r.value.confidence === 'needs_review');
  const unverified = resultados.filter(r => r.status === 'fulfilled' && r.value.confidence === 'unverified');

  return {
    total:          lista.length,
    verified:       verified.length,
    partiallyVerified: partial.length,
    needsReview:    unreviewed.length,
    unverified:     unverified.length,
    taxaVerificacao: verified.length / Math.max(1, lista.length),
    resultados:     resultados.map((r, i) => ({
      idx: i,
      ref: lista[i]?.raw || lista[i]?.title || `#${i}`,
      ...(r.status === 'fulfilled' ? r.value : { confidence: 'unverified', error: r.reason?.message }),
    })),
  };
}

/* ── Helpers ── */

function extrairTitulo(raw) {
  const match = raw.match(/\(\d{4}\)\.\s*(.+?)(?:\.\s+(?:Editora|Universidade|Tese|Dissertação|Relatório|Working Paper)|\.\s*$|$)/);
  return match ? match[1].trim() : '';
}

function extrairDoi(raw) {
  const match = raw.match(/(?:doi|DOI)[:\s]*([^.\s]+)/);
  if (match) return match[1].trim();
  const urlMatch = raw.match(/doi\.org\/([^\s.]+)/);
  return urlMatch ? urlMatch[1].trim() : null;
}

function extrairIsbn(raw) {
  const cleaned = raw.replace(/[-\s]/g, '');
  const match = cleaned.match(/(?:ISBN|isbn)[:\s]*((?:97[89])?\d{9}[\dX])/);
  return match ? match[1] : null;
}

function encontrarMelhorMatch(items, title, author, year) {
  let best = { score: 0, item: null };
  const titleNormalized = title.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  for (const item of items) {
    let score = 0;
    const itemTitle = ((item.title?.[0] || item.title || '')).toLowerCase().replace(/[^a-z0-9\s]/g, '');

    /* Similaridade de título (Jaccard-like) */
    const titleWords = new Set(titleNormalized.split(/\s+/).filter(w => w.length > 3));
    const itemWords = new Set(itemTitle.split(/\s+/).filter(w => w.length > 3));
    let common = 0;
    for (const w of titleWords) { if (itemWords.has(w)) common++; }
    const union = new Set([...titleWords, ...itemWords]).size;
    if (union > 0) score += (common / union) * 0.6;

    /* Autor */
    if (author && item.author) {
      const auths = Array.isArray(item.author) ? item.author.map(a => (a.family || a.name || '').toLowerCase()) : [];
      const authParts = author.toLowerCase().split(/[,;]/).map(a => a.trim());
      const matchAuth = authParts.some(pa => auths.some(au => au.includes(pa) || pa.includes(au)));
      if (matchAuth) score += 0.25;
    }

    /* Ano */
    if (year && item['published-print']?.date?.parts?.[0]) {
      if (item['published-print'].date.parts[0] === year) score += 0.15;
    } else if (year && item['published-online']?.date?.parts?.[0]) {
      if (item['published-online'].date.parts[0] === year) score += 0.15;
    }

    if (score > best.score) { best = { score, item }; }
  }

  return best;
}

function extrairMetadataCrossRef(data) {
  const msg = data.message || data || {};
  return {
    doi:       msg.DOI,
    title:     msg.title?.[0] || msg.title,
    authors:   (msg.author || []).map(a => `${a.family || ''}, ${a.given || ''}`.trim(', ')),
    year:      msg['published-print']?.date?.parts?.[0] || msg['published-online']?.date?.parts?.[0] || msg.created?.date?.parts?.[0],
    publisher: msg.publisher,
    type:      msg.type,
    url:       msg.URL,
  };
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

/* Retry com backoff apenas para falhas transitórias (429/502/503/504/timeout).
   Erros definitivos (404, etc.) não são reintentados — significam "não encontrado",
   não "não sabemos". Usado pelas chamadas CrossRef para evitar que um 429
   momentâneo degrade uma referência real para 'needs_review'/'unverified'. */
async function fetchWithRetry(url, ms, maxRetries = 2) {
  let lastResp = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetchWithTimeout(url, ms);
      lastResp = resp;
      if (resp.ok) return resp;
      const transiente = resp.status === 429 || (resp.status >= 500 && resp.status < 600);
      if (!transiente || attempt === maxRetries) return resp;
    } catch (e) {
      if (attempt === maxRetries) throw e;
    }
    await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
  }
  return lastResp;
}

/* ── Verificação de suporte claim vs evidência (EVIDENCE-FIRST) ── */
export function verificarSuporteClaim(claimText, evidenceText) {
  if (!evidenceText || evidenceText.length < 20) return { support_status: 'NOT_VERIFIED', confidence: 0 };
  const c = claimText.toLowerCase();
  const e = evidenceText.toLowerCase();
  // Números: claim tem número que evidência não tem → NOT_VERIFIED
  const cNums = claimText.match(/\d+(?:[.,]\d+)?\s*%/g) || [];
  const eNums = evidenceText.match(/\d+(?:[.,]\d+)?\s*%/g) || [];
  if (cNums.length && !cNums.some(n => eNums.includes(n))) {
    return { support_status: 'DOES_NOT_SUPPORT', confidence: 0.85, reason: 'Número do claim ausente na evidência' };
  }
  const cWords = new Set(c.split(/\s+/).filter(w => w.length > 4));
  const eWords = new Set(e.split(/\s+/).filter(w => w.length > 4));
  let common = 0; for (const w of cWords) if (eWords.has(w)) common++;
  const ratio = cWords.size ? common / cWords.size : 0;
  if (ratio > 0.55) return { support_status: 'DIRECTLY_SUPPORTS', confidence: 0.9 };
  if (ratio > 0.35) return { support_status: 'PARTIALLY_SUPPORTS', confidence: 0.65 };
  if (ratio < 0.12) return { support_status: 'DOES_NOT_SUPPORT', confidence: 0.75 };
  return { support_status: 'NOT_VERIFIED', confidence: 0.4 };
}
