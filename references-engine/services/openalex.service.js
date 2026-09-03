/* references-engine/services/openalex.service.js — FONTE PRINCIPAL */
import { createReference } from '../types/reference.types.js';
const OPENALEX = 'https://api.openalex.org/works';
export async function searchOpenAlex(query, {limit=20}={}) {
  const url=`${OPENALEX}?search=${encodeURIComponent(query)}&per-page=${limit}&filter=has_doi:true`;
  const r=await fetch(url, {headers:{'User-Agent':'ACADEMY/1.0'}});
  if(!r.ok) throw new Error(`OpenAlex ${r.status}`);
  const d=await r.json();
  return (d.results||d.data||[]).map(raw=>{
    const doi=raw.doi?.replace('https://doi.org/','')||null;
    return createReference({
      title: raw.display_name||raw.title,
      authors: (raw.authorships||[]).map(a=>({name: a.author?.display_name||a.author?.name})),
      publicationYear: raw.publication_year||raw.publication_date?.slice(0,4),
      abstract: raw.abstract? Object.values(raw.abstract_inverted_index||{}).flat().join(' ') : null,
      doi, url: doi? `https://doi.org/${doi}`: raw.id,
      journal: raw.primary_location?.source?.display_name||null,
      publisher: raw.primary_location?.source?.publisher||null,
      citationCount: raw.cited_by_count||0,
      source:'openalex', verified:false, verificationStatus:'NAO_VERIFICADA',
    });
  });
}
