/* academic/engines/topic-cache.js
   Cache reutilizável de fontes por tema — topic_sources
   Best-effort: falha de Supabase nunca bloqueia geração
============================================================================= */

export function normalizarTopicKey(tema) {
  if (!tema) return '';
  return tema.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim().replace(/\s+/g, '-')
    .slice(0, 80);
}

export async function lerCacheTopic(topicKey) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !topicKey) return [];
  try {
    const ctrl = new AbortController(); const t=setTimeout(()=>ctrl.abort(), 4000);
    // 90 dias
    const since = new Date(Date.now() - 90*24*3600*1000).toISOString();
    const q = `${url}/rest/v1/topic_sources?topic_key=eq.${encodeURIComponent(topicKey)}&created_at=gte.${encodeURIComponent(since)}&select=source_id,relevance_score,created_at,sources(*)`;
    const r = await fetch(q, { signal: ctrl.signal, headers: { apikey: key, Authorization: `Bearer ${key}` } });
    clearTimeout(t);
    if (!r.ok) return [];
    const rows = await r.json();
    // rows[].sources contém a fonte completa via FK
    return (rows||[]).map(row => row.sources).filter(Boolean);
  } catch { return []; }
}

export async function gravarCacheTopic(topicKey, sources) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !topicKey || !sources?.length) return;
  try {
    for (const s of sources.slice(0, 12)) {
      const ctrl = new AbortController(); const t=setTimeout(()=>ctrl.abort(), 4000);
      await fetch(`${url}/rest/v1/topic_sources`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type':'application/json', apikey:key, Authorization:`Bearer ${key}`, Prefer:'return=minimal' },
        body: JSON.stringify({ topic_key: topicKey, source_id: s.id || s.source_id, relevance_score: s.relevance_score || 0.7 }),
      }).catch(()=>{});
      clearTimeout(t);
    }
  } catch {}
}
