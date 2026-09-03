/* formatter ABNT + APA secção 20-21 */
export function formatAPA(r){
  const authors=(r.authors||[]).map(a=>a.name).join(', ')||'Autor';
  const year=r.publicationYear||'s.d.';
  const title=r.title||'Sem título';
  const journal=r.journal? ` ${r.journal}`:'';
  const vol=r.volume? `, ${r.volume}`:'';
  const pages=r.pages? `, ${r.pages}`:'';
  const doi=r.doi? ` https://doi.org/${r.doi}`: r.url? ` ${r.url}`:'';
  return `${authors} (${year}). ${title}.${journal}${vol}${pages}.${doi}`.trim();
}
export function formatABNT(r){
  const authors=(r.authors||[]).map(a=>a.name?.toUpperCase()).join('; ')||'AUTOR';
  const title=(r.title||'').toUpperCase();
  const ed=r.publisher? ` ${r.publisher},`:''; const ano=r.publicationYear||'s.d.';
  return `${authors}. ${title}.${ed} ${ano}.`.trim();
}
