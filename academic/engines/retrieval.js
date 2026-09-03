/* academic/engines/retrieval.js
   RETRIEVE → EVIDENCE EXTRACTION (sem burlar paywall)
============================================================================= */

const TIMEOUT = 8000;

async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ACADEMY/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* ── Unpaywall (gratuito, precisa email) ── */
export async function retrieveUnpaywall(doi) {
  if (!doi) return null;
  const email = process.env.UNPAYWALL_EMAIL || 'academy@agea.ao';
  const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
  try {
    const j = await fetchJson(url);
    if (j.is_oa && j.best_oa_location?.url) {
      return { url: j.best_oa_location.url, is_oa: true, raw: j };
    }
  } catch {}
  return null;
}

/* ── Europe PMC full text ── */
export async function retrieveEuropePMC(source) {
  if (!source.doi && !source.title) return null;
  // Europe PMC já retorna isOpenAccess e fullTextUrlList, mas podemos tentar fetch
  if (source.full_text_url) return { url: source.full_text_url, is_oa: true };
  return null;
}

/* ── Ordem de tentativa: OA → Unpaywall → Europe PMC → abstract ── */
export async function retrieveSource(source) {
  // 1. Já tem OA
  if (source.is_open_access && source.full_text_url) {
    return { evidence_available: true, url: source.full_text_url, type: 'open_access' };
  }
  // 2. Unpaywall
  if (source.doi) {
    const u = await retrieveUnpaywall(source.doi);
    if (u) return { evidence_available: true, url: u.url, type: 'unpaywall' };
  }
  // 3. Europe PMC
  const e = await retrieveEuropePMC(source);
  if (e) return { evidence_available: true, url: e.url, type: 'europe_pmc' };
  // 4. abstract
  if (source.abstract) {
    return { evidence_available: true, url: null, type: 'abstract', evidence_text: source.abstract };
  }
  return { evidence_available: false, type: 'metadata_only' };
}

/* ── Extração de evidência (nunca inventar page) ── */
export function extractEvidence(source, claim) {
  const retrieval = source._retrieval || {};
  let evidence_text = source.abstract || null;
  // Se tem full text URL, não fazemos scraping completo aqui (evita paywall), só abstract
  if (!evidence_text) {
    return { evidence_text: null, page: null, section: null, source_location: null, confidence: 0, evidence_available: false };
  }
  // Simples: se claim keywords estão no abstract, confiança alta
  const claimLow = claim.text.toLowerCase();
  const evLow = evidence_text.toLowerCase();
  const kws = claimLow.split(/\s+/).filter(w => w.length > 5).slice(0, 4);
  let matches = 0;
  for (const kw of kws) if (evLow.includes(kw)) matches++;
  const confidence = kws.length ? matches / kws.length : 0.5;

  return {
    evidence_text: evidence_text.substring(0, 400),
    page: null, // nunca inventar
    section: null,
    source_location: retrieval.url || source.url || null,
    confidence,
    evidence_available: true,
  };
}

/* ── Verificação de suporte claim vs evidência ── */
export function verifyClaimSupport(claim, evidence) {
  if (!evidence || !evidence.evidence_available || !evidence.evidence_text) {
    return { support_status: 'NOT_VERIFIED', confidence: 0, reason: 'Evidência indisponível' };
  }
  const claimNum = claim.text.match(/\d+(?:[.,]\d+)?\s*%|\b\d+\b/g);
  const evNum = evidence.evidence_text.match(/\d+(?:[.,]\d+)?\s*%|\b\d+\b/g);
  // Se claim tem número e evidência não tem número similar → NOT_VERIFIED
  if (claim.requires_numeric_evidence && claimNum) {
    const hasNum = evNum && claimNum.some(n => evNum.includes(n));
    if (!hasNum) return { support_status: 'NOT_VERIFIED', confidence: 0.2, reason: 'Número do claim não encontrado na evidência' };
  }
  // Comparação simples: se evidência contém palavras-chave do claim
  const c = claim.text.toLowerCase();
  const e = evidence.evidence_text.toLowerCase();
  const overlap = c.split(/\s+/).filter(w => w.length > 4 && e.includes(w)).length;
  const total = c.split(/\s+/).filter(w => w.length > 4).length;
  const ratio = total ? overlap / total : 0;

  if (ratio > 0.6) return { support_status: 'DIRECTLY_SUPPORTS', confidence: 0.9 };
  if (ratio > 0.35) return { support_status: 'PARTIALLY_SUPPORTS', confidence: 0.6 };
  if (ratio < 0.15) return { support_status: 'DOES_NOT_SUPPORT', confidence: 0.8 };
  return { support_status: 'NOT_VERIFIED', confidence: 0.4 };
}
