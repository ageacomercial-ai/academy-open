-- ═══════════════════════════════════════════════════════════
-- 0005 — PLANOS_UTILIZADORES (DDL versionado)
-- Backup remoto do plano do utilizador (sbGuardarPlano/sbRestaurarPlano).
-- Já existia na DB mas sem schema versionado no repositório.
-- Nota: funcional (sem RLS anon novo) — o acesso mantém o anterior:
--   o cliente grava o próprio backup (INSERT/SELECT via anon key).
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS planos_utilizadores (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uid        TEXT NOT NULL DEFAULT '',
  plano      TEXT DEFAULT 'gratuito',
  expiry     TEXT,                          -- ISO string (expiryMs)
  updated    TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planos_utilizadores_uid ON planos_utilizadores(uid);

/* RLS: sem políticas anon — acesso apenas via service role (backend).
   O client-side sbRestaurarPlano usa a anon key; se o RLS for ativado
   por esta migration, o fluxo actual de restauro pode ficar bloqueado.
   Para não quebrar o sistema existente, NÃO ativamos RLS aqui — a
   migração fica apenas com o DDL (decisão documentada no relatório). */