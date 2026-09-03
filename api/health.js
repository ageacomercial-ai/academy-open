/* ═══════════════════════════════════════════════════════════
   ACADEMY — /api/health (GET)
   Monitorização simples (missão §16):
     - API                     → ok
     - Supabase (ping REST)    → ok/indisponível
     - tabelas essenciais      → presentes/em falta
   NUNCA expõe secrets nem credenciais.
   ═══════════════════════════════════════════════════════════ */

const TABELAS_ESSENCIAIS = ['utilizadores', 'pagamentos', 'webhook_logs', 'transacoes', 'intervencoes_admin'];

async function handler(_req, res) {
  const resposta = {
    ok: true,
    service: 'academy',
    ts: Date.now(),
    api: 'ok',
    supabase: 'indisponivel',
    tabelas: {},
  };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (url && key) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      resposta.supabase = r.ok || r.status === 401 ? 'ok' : 'indisponivel';

      if (resposta.supabase === 'ok') {
        for (const tabela of TABELAS_ESSENCIAIS) {
          try {
            const c = new AbortController();
            const tt = setTimeout(() => c.abort(), 8000);
            const tr = await fetch(`${url}/rest/v1/${tabela}?select=id&limit=1`, {
              headers: { apikey: key, Authorization: `Bearer ${key}` },
              signal: c.signal,
            });
            clearTimeout(tt);
            resposta.tabelas[tabela] = tr.ok;
          } catch { resposta.tabelas[tabela] = false; }
        }
        const emFalta = Object.values(resposta.tabelas).some(v => !v);
        resposta.ok = !emFalta;
      } else {
        resposta.ok = false;
      }
    } catch {
      resposta.supabase = 'indisponivel';
      resposta.ok = false;
    }
  } else {
    resposta.ok = false;
  }

  res.status(resposta.ok ? 200 : 503).json(resposta);
}

export default handler;
export { handler };