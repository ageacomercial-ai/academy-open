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
  const s=classifyVerification(ref);
  return s==='VERIFICADA' || (s==='PARCIALMENTE_VERIFICADA' && !!ref.doi);
}
