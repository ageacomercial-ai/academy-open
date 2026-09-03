/* references-engine/services/crossref.service.js — VALIDAÇÃO */
import { createReference } from '../types/reference.types.js';
const CROSSREF='https://api.crossref.org/works';
export async function validateViaCrossref(ref){
  if(!ref.doi) return ref;
  try{
    const r=await fetch(`${CROSSREF}/${encodeURIComponent(ref.doi)}`);
    if(!r.ok) return {...ref, verificationStatus:'NAO_VERIFICADA'};
    const d=await r.json(); const m=d.message;
    const ok = m.title?.[0]?.toLowerCase().includes(ref.title?.toLowerCase().slice(0,20) || '');
    return {...ref, verificationStatus: ok?'VERIFICADA':'PARCIALMENTE_VERIFICADA', verified:ok, journal: m['container-title']?.[0]||ref.journal, publisher:m.publisher||ref.publisher };
  }catch{ return {...ref, verificationStatus:'NAO_VERIFICADA'}; }
}
export async function searchCrossref(query, {limit=20}={}){
  const r=await fetch(`${CROSSREF}?query=${encodeURIComponent(query)}&rows=${limit}`);
  if(!r.ok) throw new Error(`Crossref ${r.status}`);
  const d=await r.json();
  return (d.message?.items||[]).map(it=> createReference({
    title: it.title?.[0], authors:(it.author||[]).map(a=>({name:`${a.family}, ${a.given||''}`.trim()})),
    publicationYear: it['published-print']?.['date-parts']?.[0]?.[0]||it.created?.['date-parts']?.[0]?.[0],
    doi: it.DOI, url: it.URL, journal: it['container-title']?.[0], publisher: it.publisher,
    citationCount: it['is-referenced-by-count']||0, source:'crossref', verificationStatus:'PARCIALMENTE_VERIFICADA'
  }));
}
