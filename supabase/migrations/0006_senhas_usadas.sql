-- ═══════════════════════════════════════════════════════════
-- 0006 — SENHAS_USADAS (DDL versionado)
-- Controlo de uso único de senhas (sbVerificarSenhaUsada/sbMarcarSenhaUsada).
-- Já existia na DB mas sem schema versionado no repositório.
-- Mantém o acesso anon actual (SELECT/INSERT via anon key) para não
-- quebrar o fluxo; bloqueia apenas operações de escrita não usadas
-- (DELETE/UPDATE) porque não existem políticas para elas.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS senhas_usadas (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  senha      TEXT NOT NULL,
  uid        TEXT DEFAULT '',
  usado_em   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (senha)
);

CREATE INDEX IF NOT EXISTS idx_senhas_usadas_senha ON senhas_usadas(senha);

/* RLS: SELECT + INSERT anon (fluxo actual); sem DELETE/UPDATE. */
ALTER TABLE senhas_usadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_senhas_usadas" ON senhas_usadas;
CREATE POLICY "anon_select_senhas_usadas" ON senhas_usadas
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_senhas_usadas" ON senhas_usadas;
CREATE POLICY "anon_insert_senhas_usadas" ON senhas_usadas
  FOR INSERT TO anon WITH CHECK (true);