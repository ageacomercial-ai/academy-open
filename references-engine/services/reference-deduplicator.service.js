/* deduplicator — prioridade DOI>ISBN>título>titulo+autor+ano secção 9 */
import { normalizeDoi, normalizeIsbn, normalizeTitle, normalizeTitleAuthorYear } from '../utils/normalization.utils.js';
export function deduplicate(references){
  const map=new Map();
  for(const r of references){
    const doi=normalizeDoi(r.doi);
    const isbn=normalizeIsbn(r.isbn);
    let key=null;
    if(doi) key=`doi:${doi}`;
    else if(isbn) key=`isbn:${isbn}`;
    else {
      const t=normalizeTitle(r.title);
      if(t) key=`t:${t.slice(0,60)}`;
      else key=`ta:${normalizeTitleAuthorYear(r.title, r.authors, r.publicationYear).slice(0,80)}`;
    }
    const exist=map.get(key);
    if(!exist) map.set(key,{...r, origins:[r.source]});
    else {
      // manter mais completa (com doi/abstract/citationCount)
      const score = (x)=> (x.doi?2:0)+(x.abstract?1:0)+(x.citationCount||0)/100;
      const keep = score(r) > score(exist) ? {...r, origins:[...new Set([...exist.origins, r.source])]} : {...exist, origins:[...new Set([...exist.origins, r.source])]};
      map.set(key, keep);
    }
  }
  return [...map.values()];
}
