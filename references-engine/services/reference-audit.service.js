/* audit — secção 22-23 */
import { deduplicate } from './reference-deduplicator.service.js';
export function audit(references, citations, usages){
  const duplicadas = references.length - deduplicate(references).length;
  const semRef = citations.filter(c=> !references.some(r=> r.id===c || r.doi===c)).length;
  const naoUsadas = references.filter(r=> !usages.some(u=>u.referenceId===r.id)).length;
  return {
    referenciasEncontradas: references.length,
    duplicadasRemovidas: duplicadas,
    referenciasValidadas: references.filter(r=>r.verificationStatus!=='NAO_VERIFICADA').length,
    referenciasDescartadas: references.filter(r=>r.verificationStatus==='NAO_VERIFICADA').length,
    referenciasUtilizadas: usages.length,
    citacoesNoDocumento: citations.length,
    citacoesSemRef: semRef,
    referenciasNaoUtilizadas: naoUsadas,
    status: (semRef===0 && duplicadas===0) ? 'APROVADO PARA ENTREGA' : 'REVISAO NECESSARIA',
  };
}
