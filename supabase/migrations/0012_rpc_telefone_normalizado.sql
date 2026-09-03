-- ═══════════════════════════════════════════════════════════
-- 0012 — RPC: associação por telefone NORMALIZADO (§3)
-- A busca ilike sobre o valor cru não casa '+244 900 000 003'
-- com o sufixo '900000003' (espaços/separadores) — a normalização
-- é feita AQUI no servidor (regexp), nunca no frontend.
-- Execução: só service_role (sem GRANT ao anon).
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.utilizadores_por_telefone(p_sufixo TEXT)
RETURNS TABLE (id TEXT, nome TEXT, whatsapp TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, nome, whatsapp
  FROM utilizadores
  WHERE whatsapp IS NOT NULL
    AND regexp_replace(whatsapp, '\D', '', 'g') LIKE '%' || p_sufixo
$$;

GRANT EXECUTE ON FUNCTION public.utilizadores_por_telefone(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.utilizadores_por_telefone(TEXT) FROM anon, authenticated;