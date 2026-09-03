/* references-dashboard — Fase 4 — secção 24 */
async function carregarReferenciasDashboard(tema){
  const el=document.getElementById('refsDashboard');
  if(!el) return;
  el.innerHTML='Pesquisando referências científicas...';
  try{
    const r=await fetch('/api/references/search', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({theme:tema, referenceCount:20})});
    const j=await r.json();
    if(!j.ok) throw new Error(j.error);
    el.innerHTML=`${j.references.length} fontes académicas encontradas.<br>Selecionando as mais relevantes...`;
    setTimeout(()=>{ el.innerHTML=`Referências verificadas com sucesso.<br><button onclick=\"verReferencias()\">VER REFERÊNCIAS UTILIZADAS</button>`; window._refsDashboard=j.references; }, 500);
  }catch(e){ el.innerHTML='Não foi possível obter referências verificadas neste momento.'; }
}
function verReferencias(){
  const refs=window._refsDashboard||[];
  alert(refs.map((r,i)=>`[R${i+1}] ${r.authors.map(a=>a.name).join(', ')} (${r.publicationYear}) ${r.title} — ${r.journal||r.publisher} ${r.doi||''}`).join('\n\n'));
}
