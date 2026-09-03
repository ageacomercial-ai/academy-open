/* cache academic_references secção 14-15 — Supabase + memória */
const mem=new Map();
export async function getCached(query){
  const k=query.toLowerCase().trim();
  const e=mem.get(k);
  if(e && Date.now()-e.ts < 6*3600*1000) return e.data;
  // Supabase: tenta se SUPABASE_URL existir, senão skip
  const url=process.env.SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_KEY;
  if(!url||!key) return null;
  try{
    const r=await fetch(`${url}/rest/v1/academic_references?title=ilike.%${encodeURIComponent(query.slice(0,20))}%&limit=5`, {headers:{apikey:key, Authorization:`Bearer ${key}`}});
    if(r.ok){ const d=await r.json(); if(d.length) return d; }
  }catch{}
  return null;
}
export async function setCached(query, refs){
  mem.set(query.toLowerCase().trim(), {ts:Date.now(), data:refs});
  const url=process.env.SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_KEY;
  if(!url||!key) return;
  try{ for(const r of refs.slice(0,5)){
    await fetch(`${url}/rest/v1/academic_references`, {method:'POST', headers:{'Content-Type':'application/json', apikey:key, Authorization:`Bearer ${key}`, Prefer:'return=minimal'}, body:JSON.stringify({external_id:r.doi||r.id, title:r.title, authors:r.authors, publication_year:r.publicationYear, doi:r.doi, url:r.url, verification_status:r.verificationStatus})}).catch(()=>{});
  }}catch{}
}
