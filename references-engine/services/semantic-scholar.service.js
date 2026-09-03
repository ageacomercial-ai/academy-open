/* semantic-scholar.service — RELEVÂNCIA */
import { createReference } from '../types/reference.types.js';
const S2='https://api.semanticscholar.org/graph/v1/paper/search';
export async function searchSemanticScholar(query, {limit=20}={}){
  const url=`${S2}?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,citationCount,externalIds,url,abstract,venue`;
  const r=await fetch(url, {headers:{'User-Agent':'ACADEMY/1.0'}});
  if(!r.ok) throw new Error(`S2 ${r.status}`);
  const d=await r.json();
  return (d.data||[]).map(it=> createReference({
    title: it.title, authors:(it.authors||[]).map(a=>({name:a.name})),
    publicationYear: it.year, abstract: it.abstract, doi: it.externalIds?.DOI||null,
    url: it.url, journal: it.venue||null, citationCount: it.citationCount||0,
    source:'semantic_scholar', verificationStatus:'PARCIALMENTE_VERIFICADA'
  }));
}
