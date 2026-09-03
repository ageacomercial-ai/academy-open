/* ranking 0-100 secção 11 — 40% relevância +20% qualidade+15% atualidade+15% impacto+10% geográfico */
export function scoreReference(ref, {tema='', geo='global'}={}){
  const temaLow=(tema||'').toLowerCase();
  const titleLow=(ref.title||'').toLowerCase();
  const kw=temaLow.split(/\s+/).filter(w=>w.length>3);
  const relevance = kw.length? kw.filter(k=> titleLow.includes(k)).length/kw.length : 0.5;
  const qualidade = ref.journal||ref.publisher? 0.8 : 0.5;
  const ano=ref.publicationYear||2000;
  const atualidade = Math.max(0, Math.min(1, (ano-2000)/24));
  const impacto = Math.min(1, (ref.citationCount||0)/100);
  const geoBonus = (ref.title||'').toLowerCase().includes(geo.toLowerCase()) ? 1 : (ref.title||'').toLowerCase().includes('africa')?0.7:0.4;
  const total = relevance*40 + qualidade*20 + atualidade*15 + impacto*15 + geoBonus*10;
  return Math.round(total);
}
export function rank(references, ctx){
  return [...references].map(r=>({...r, relevanceScore: scoreReference(r, ctx)})).sort((a,b)=> b.relevanceScore - a.relevanceScore);
}
