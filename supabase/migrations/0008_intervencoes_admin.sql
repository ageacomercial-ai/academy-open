-- ═══════════════════════════════════════════════════════════
-- 0008 — INTERVENCOES_ADMIN (fila de resolução manual)
-- Casos que NUNCA são resolvidos automaticamente:
--   • PACOTE_NAO_MAPEADO        → pagamento válido sem oferta mapeada
--   • UTILIZADOR_AMBIGUO        → 2+ utilizadores casam (email/telefone)
--   • UTILIZADOR_NAO_ENCONTRADO → comprador sem conta Academy
--   • REVOGACAO_ACESSO_PENDENTE → refund de acesso já libertado
-- Regra (§3): num caso ambíguo NUNCA liberar automaticamente.
-- Acesso: só backend (service role) — anon NÃO lê nem escreve.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intervencoes_admin (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo          TEXT NOT NULL,
  ref           TEXT,
  contexto      JSONB DEFAULT '{}',
  estado        TEXT NOT NULL DEFAULT 'pendente',
  nota          TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  resolvido_em  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_intervencoes_estado  ON intervencoes_admin(estado);
CREATE INDEX IF NOT EXISTS idx_intervencoes_tipo    ON intervencoes_admin(tipo);
CREATE INDEX IF NOT EXISTS idx_intervencoes_criado  ON intervencoes_admin(criado_em);

ALTER TABLE intervencoes_admin ENABLE ROW LEVEL SECURITY;