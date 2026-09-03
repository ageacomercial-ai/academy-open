/* reference-validator.service — NÍVEIS 1-3 secção 10 */
export function validateBasic(ref){
  return !!(ref.title && ref.authors?.length && ref.publicationYear && ref.source);
}
export function classifyVerification(ref){
  if(!validateBasic(ref)) return 'NAO_VERIFICADA';
  if(ref.verificationStatus==='VERIFICADA') return 'VERIFICADA';
  if(ref.doi && ref.verificationStatus==='PARCIALMENTE_VERIFICADA') return 'PARCIALMENTE_VERIFICADA';
  return 'NAO_VERIFICADA';
}
export function isUsable(ref){
  // Fase 1: mantém todas com validação básica; descarte de NAO_VERIFICADA é feito no ranking/auditoria, não na coleta
  return validateBasic(ref);
}
