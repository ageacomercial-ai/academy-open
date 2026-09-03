/* reference-usage — ReferenceUsage {referenceId, chapter, section, paragraph, citationType} secção 16 */
const usages=[];
export function registerUsage({referenceId, chapter, section, paragraph, citationType='indireta'}){
  usages.push({referenceId, chapter, section, paragraph, citationType, ts:Date.now()});
}
export function getUsages(){ return [...usages]; }
export function clearUsages(){ usages.length=0; }
export function auditUsages(references, citations){
  // citations: array de strings "[R1]" encontradas no texto
  const usedIds=new Set(usages.map(u=>u.referenceId));
  const citedIds=new Set(citations.map(c=>c.replace(/[\[\]]/g,'')));
  return {
    referenciasUtilizadas: [...usedIds].length,
    citacoesSemRef: [...citedIds].filter(id=> !references.some(r=>r.id===id)).length,
    refsNaoUsadas: references.filter(r=> !usedIds.has(r.id)).length,
  };
}
