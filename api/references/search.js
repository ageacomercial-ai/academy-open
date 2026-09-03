/* POST /api/references/search — secção 27 */
import { searchOpenAlex } from '../../references-engine/services/openalex.service.js';
import { searchCrossref } from '../../references-engine/services/crossref.service.js';
import { searchSemanticScholar } from '../../references-engine/services/semantic-scholar.service.js';
import { searchGoogleBooks } from '../../references-engine/services/google-books.service.js';
import { deduplicate } from '../../references-engine/services/reference-deduplicator.service.js';
import { rank } from '../../references-engine/services/reference-ranking.service.js';
import { isUsable } from '../../references-engine/services/reference-validator.service.js';
import { getCached, setCached } from '../../references-engine/services/reference-cache.service.js';

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS') return res.status(204).end();
  const { theme, language, academicLevel, documentType, referenceCount=20 } = req.body||{};
  if(!theme) return res.status(400).json({ok:false, error:'theme obrigatório'});
  const start=Date.now();
  const cached=await getCached(theme);
  if(cached){ return res.json({ok:true, references:cached.slice(0,referenceCount), statistics:{fromCache:true, total:cached.length}, status:'CACHE'}); }
  let refs=[]; const logs=[];
  try{ const a=await searchOpenAlex(theme, {limit:30}); refs.push(...a); logs.push(`[OPENALEX] ${a.length}`);}catch(e){ logs.push(`[OPENALEX] erro ${e.message}`); }
  try{ const b=await searchCrossref(theme, {limit:20}); refs.push(...b); logs.push(`[CROSSREF] ${b.length}`);}catch(e){ logs.push(`[CROSSREF] erro`); }
  if(refs.length<10){ try{ const c=await searchSemanticScholar(theme, {limit:20}); refs.push(...c); logs.push(`[S2] ${c.length}`);}catch(e){ logs.push(`[S2] erro`); } }
  if(refs.length<10){ try{ const d=await searchGoogleBooks(theme, {limit:10}); refs.push(...d); logs.push(`[GB] ${d.length}`);}catch(e){ logs.push(`[GB] erro`); } }
  console.log(logs.join(' | '));
  refs = deduplicate(refs).filter(isUsable);
  // Seleção final por tipo: 5-40 conforme documentType (secção 12)
  const countMap={ pequeno:8, medio:15, monografia:30, dissertacao:45 };
  const alvo = referenceCount || (documentType==='dissertacao'?35: documentType==='monografia'?25:15);
  refs = rank(refs, {tema:theme}).slice(0, alvo);
  // Diversidade: garante pelo menos 1 livro se houver
  const hasBook=refs.some(r=>r.documentType==='book');
  if(!hasBook && refs.length>5){
    const books=refs.filter(r=>r.documentType==='book');
    if(books.length) refs[refs.length-1]=books[0];
  }
  await setCached(theme, refs);
  const stats={ total:refs.length, timeMs: Date.now()-start, sources: [...new Set(refs.map(r=>r.source))] };
  return res.json({ok:true, references:refs, statistics:stats, status:'OK'});
}
