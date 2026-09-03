-- ═══════════════════════════════════════════════════════════
-- 0009 — FUNDAÇÃO DE PRODUÇÃO (Academy)
-- Completa o schema: tabelas sem migration formal + auditoria
-- administrativa + preparação financeira (comissões históricas) +
-- índices de relatório.
--
-- PRESSUPOSTOS: migrations 0001–0008 aplicadas antes.
-- SEM ROW SECURITY POR TABELA SEM POLICY → só service role acede.
-- ═══════════════════════════════════════════════════════════

/* ── 1. PAGAMENTOS (DDL formal — a 0001 pressupõe a tabela existente) ──
   Colunas reais usadas pelo frontend/backend. Em DBs antigas o
   CREATE IF NOT EXISTS não altera nada (a 0001 já adiciona as que faltem). */
CREATE TABLE IF NOT EXISTS pagamentos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ref           TEXT,
  uid           TEXT,
  utilizador_id TEXT,
  user_id       TEXT,
  nome          TEXT DEFAULT 'Desconhecido',
  whatsapp      TEXT,
  tipo          TEXT DEFAULT 'avulso',
  num_pags      INTEGER DEFAULT 15,
  valor         NUMERIC(12,2) DEFAULT 0,
  plano         TEXT,
  meses         INTEGER DEFAULT 1,
  estado        TEXT DEFAULT 'pendente',
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  processado_em TIMESTAMPTZ,
  aprovado_em   TIMESTAMPTZ
);
-- RLS ativo (as policies são da migration 0001 — sem ENABLE, ficam inertes)
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

/* ── 2. UTILIZADORES (DDL formal — comportamento preservado) ── */
CREATE TABLE IF NOT EXISTS utilizadores (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL DEFAULT '',
  email       TEXT,
  whatsapp    TEXT,
  nivel       TEXT DEFAULT 'medio',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE utilizadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_utilizadores" ON utilizadores;
CREATE POLICY "anon_insert_utilizadores" ON utilizadores
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_select_utilizadores" ON utilizadores;
CREATE POLICY "anon_select_utilizadores" ON utilizadores
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_update_utilizadores" ON utilizadores;
CREATE POLICY "anon_update_utilizadores" ON utilizadores
  FOR UPDATE TO anon USING (true);

/* ── 3. DOCUMENTOS (DDL formal — comportamento preservado) ── */
CREATE TABLE IF NOT EXISTS documentos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uid         TEXT NOT NULL DEFAULT '',
  doc_id      TEXT NOT NULL DEFAULT '',
  titulo      TEXT DEFAULT 'Sem título',
  tipo        TEXT,
  pags        INTEGER DEFAULT 0,
  plano       TEXT,
  dados       JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(uid, doc_id)
);
CREATE INDEX IF NOT EXISTS idx_documentos_uid ON documentos(uid);
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_documentos" ON documentos;
CREATE POLICY "anon_insert_documentos" ON documentos
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_select_documentos" ON documentos;
CREATE POLICY "anon_select_documentos" ON documentos
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_update_documentos" ON documentos;
CREATE POLICY "anon_update_documentos" ON documentos
  FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "anon_delete_documentos" ON documentos;
CREATE POLICY "anon_delete_documentos" ON documentos
  FOR DELETE TO anon USING (true);

/* ── 4. ACADEMY_AI_LOGS (colunas REAIS usadas pelo backend) ── */
CREATE TABLE IF NOT EXISTS academy_ai_logs (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ts                 TIMESTAMPTZ,
  tema               TEXT,
  nivel              TEXT,
  area               TEXT,
  tipo               TEXT,
  cap_num            INTEGER,
  ast_generated      BOOLEAN,
  ast_repaired       BOOLEAN DEFAULT false,
  repair_reason      TEXT,
  retry_count        INTEGER DEFAULT 0,
  health             NUMERIC(5,2),
  confidence         NUMERIC(5,2),
  ready              BOOLEAN DEFAULT false,
  generation_time_ms INTEGER DEFAULT 0,
  pages_requested    INTEGER,
  word_count         INTEGER DEFAULT 0,
  model_used         TEXT DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS idx_academy_ai_logs_created ON academy_ai_logs(ts);
ALTER TABLE academy_ai_logs ENABLE ROW LEVEL SECURITY;
-- sem políticas anon: telemetria só service role

/* ── 5. ACADEMY_HISTORY (histórico de trabalhos) ── */
CREATE TABLE IF NOT EXISTS academy_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT NOT NULL DEFAULT '',
  tipo        TEXT,
  tema        TEXT,
  pags        INTEGER DEFAULT 0,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_history_user ON academy_history(user_id);
ALTER TABLE academy_history ENABLE ROW LEVEL SECURITY;
-- sem políticas anon: só service role

/* ── 6. INSTITUIÇÕES (DDL formal — do seed original do engine) ──
   Identidade da INSTITUIÇÃO é obtida do trabalho do aluno (futuro).
   RLS: CRUD anon preservado (painel admin lê/grava com anon key);
   alterações ficam auditadas pelos triggers (audit_log). */
CREATE TABLE IF NOT EXISTS instituicoes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  sigla TEXT,
  desconto_porcentagem INTEGER DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE instituicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_instituicoes" ON instituicoes;
CREATE POLICY "anon_select_instituicoes" ON instituicoes
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_instituicoes" ON instituicoes;
CREATE POLICY "anon_insert_instituicoes" ON instituicoes
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_instituicoes" ON instituicoes;
CREATE POLICY "anon_update_instituicoes" ON instituicoes
  FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "anon_delete_instituicoes" ON instituicoes;
CREATE POLICY "anon_delete_instituicoes" ON instituicoes
  FOR DELETE TO anon USING (true);

/* ── 7. COMISSÕES (financeiro — registo por venda) ──
   Cada linha regista uma venda associada a um parceiro/instituição com o
   percentual PRATICADO NAQUELE MOMENTO (§12 — nunca recalcular histórico).
   RLS: CRUD anon preservado (painel admin — sbPagarComissao faz UPDATE). */
CREATE TABLE IF NOT EXISTS comissoes (
  id SERIAL PRIMARY KEY,
  parceiro_nome TEXT NOT NULL,
  parceiro_whatsapp TEXT,
  valor_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
  percentagem NUMERIC(5,2) NOT NULL DEFAULT 10,
  valor_comissao NUMERIC(12,2) NOT NULL DEFAULT 0,
  transacao_ref TEXT,                 -- order_id da Vanqir / ref do pagamento
  estado TEXT DEFAULT 'pendente',     -- pendente | paga | cancelada
  pagamento_ref TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  pago_em TIMESTAMPTZ
);
ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_comissoes" ON comissoes;
CREATE POLICY "anon_select_comissoes" ON comissoes
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_comissoes" ON comissoes;
CREATE POLICY "anon_insert_comissoes" ON comissoes
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_comissoes" ON comissoes;
CREATE POLICY "anon_update_comissoes" ON comissoes
  FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "anon_delete_comissoes" ON comissoes;
CREATE POLICY "anon_delete_comissoes" ON comissoes
  FOR DELETE TO anon USING (true);

/* ── 8. PARCEIROS ── */
CREATE TABLE IF NOT EXISTS parceiros (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  comissao_porcentagem NUMERIC(5,2) DEFAULT 10,
  codigo TEXT UNIQUE,
  activo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_parceiros" ON parceiros;
CREATE POLICY "anon_select_parceiros" ON parceiros
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_parceiros" ON parceiros;
CREATE POLICY "anon_insert_parceiros" ON parceiros
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_parceiros" ON parceiros;
CREATE POLICY "anon_update_parceiros" ON parceiros
  FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "anon_delete_parceiros" ON parceiros;
CREATE POLICY "anon_delete_parceiros" ON parceiros
  FOR DELETE TO anon USING (true);

/* ── 9. PLANOS_UTILIZADORES: UNIQUE(uid) para upsert real ──
   sbGuardarPlano usa on_conflict=uid + merge-duplicates. */
DELETE FROM planos_utilizadores
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY uid ORDER BY updated DESC NULLS LAST) AS rn
    FROM planos_utilizadores
  ) t WHERE rn > 1
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planos_utilizadores_uid_key'
  ) THEN
    ALTER TABLE planos_utilizadores ADD CONSTRAINT planos_utilizadores_uid_key UNIQUE (uid);
  END IF;
END $$;

/* ── 10. TRANSACOES: preparação para comissões históricas (§12) ──
   A percentagem aplicada no momento fica gravada com a venda,
   nunca é recalculada com o percentual actual do parceiro. */
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2);
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS parceiro_id TEXT;

/* ── 11. AUDIT_LOG — auditoria administrativa (§14) ──
   Regista QUEM (role do PostgREST) / QUANDO / AÇÃO / ANTES / DEPOIS.
   Sem secrets. Só service role (sem policies anon). */
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quem        TEXT DEFAULT 'sistema',
  quando      TIMESTAMPTZ DEFAULT NOW(),
  acao        TEXT NOT NULL,
  tabela      TEXT NOT NULL,
  registo_id  TEXT,
  antes       JSONB DEFAULT '{}',
  depois      JSONB DEFAULT '{}',
  contexto    JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_log_quando ON audit_log(quando);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela ON audit_log(tabela);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

/* ── 12. Trigger genérico de auditoria ── */
CREATE OR REPLACE FUNCTION registrar_auditoria() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (quem, quando, acao, tabela, registo_id, antes, depois)
  VALUES (
    current_user,
    NOW(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(
      (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::TEXT,
      (CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW::TEXT END)::TEXT
    ),
    COALESCE(to_jsonb(OLD), '{}'::jsonb),
    COALESCE(to_jsonb(NEW), '{}'::jsonb)
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

/* Alterações de PREÇO ficam auditadas (histórico de preços — §7) */
DROP TRIGGER IF EXISTS audit_precos ON precos;
CREATE TRIGGER audit_precos
  AFTER INSERT OR UPDATE OR DELETE ON precos
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS audit_planos_grafica ON planos_grafica;
CREATE TRIGGER audit_planos_grafica
  AFTER INSERT OR UPDATE OR DELETE ON planos_grafica
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

/* Alterações de comissão/parceiro/instituição ficam auditadas (§12/§14) */
DROP TRIGGER IF EXISTS audit_comissoes ON comissoes;
CREATE TRIGGER audit_comissoes
  AFTER INSERT OR UPDATE OR DELETE ON comissoes
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS audit_parceiros ON parceiros;
CREATE TRIGGER audit_parceiros
  AFTER INSERT OR UPDATE OR DELETE ON parceiros
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS audit_instituicoes ON instituicoes;
CREATE TRIGGER audit_instituicoes
  AFTER INSERT OR UPDATE OR DELETE ON instituicoes
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

/* ── 13. Índices de relatório ── */
CREATE INDEX IF NOT EXISTS idx_pagamentos_criado_em ON pagamentos(criado_em);
CREATE INDEX IF NOT EXISTS idx_transacoes_status    ON transacoes(status);
CREATE INDEX IF NOT EXISTS idx_comissoes_estado     ON comissoes(estado);
CREATE INDEX IF NOT EXISTS idx_utilizadores_email   ON utilizadores(email);