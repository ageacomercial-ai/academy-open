/* POST /api/references/search — secção 27 */
import { searchOpenAlex } from '../../references-engine/services/openalex.service.js';
import { searchCrossref } from '../../references-engine/services/crossref.service.js';
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
  let refs=[];
  try{ refs.push(...await searchOpenAlex(theme, {limit:30})); }catch(e){ console.warn('[search] openalex',e.message); }
  try{ refs.push(...await searchCrossref(theme, {limit:20})); }catch(e){}
  // fallback: se poucas, tenta inglês
  refs = deduplicate(refs).filter(isUsable);
  refs = rank(refs, {tema:theme}).slice(0, referenceCount);
  await setCached(theme, refs);
  const stats={ total:refs.length, timeMs: Date.now()-start, sources: [...new Set(refs.map(r=>r.source))] };
  return res.json({ok:true, references:refs, statistics:stats, status:'OK'});
}
