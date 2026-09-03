/* references-engine/utils/similarity.utils.js
   Jaccard para dedup e repetição
============================================================================= */
export function jaccard(a,b){
  const sa=new Set(a.toLowerCase().split(/\s+/).filter(w=>w.length>3));
  const sb=new Set(b.toLowerCase().split(/\s+/).filter(w=>w.length>3));
  const inter=[...sa].filter(x=>sb.has(x)).length;
  const uni=new Set([...sa,...sb]).size;
  return uni? inter/uni:0;
}
