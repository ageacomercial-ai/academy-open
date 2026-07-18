-- ═══════════════════════════════════════════════════════════
-- ACADEMY — Supabase Schema
-- Executar no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════

-- 1. UTILIZADORES
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
CREATE POLICY "anon_insert_utilizadores" ON utilizadores
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_utilizadores" ON utilizadores
  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_utilizadores" ON utilizadores
  FOR UPDATE TO anon USING (true);

-- 2. PAGAMENTOS
CREATE TABLE IF NOT EXISTS pagamentos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  utilizador_id TEXT NOT NULL DEFAULT '',
  user_id       TEXT,
  tipo          TEXT NOT NULL DEFAULT 'avulso',
  plano         TEXT,
  meses         INTEGER DEFAULT 1,
  num_pags      INTEGER DEFAULT 15,
  valor         NUMERIC(10,2) DEFAULT 0,
  moeda         TEXT DEFAULT 'AOA',
  metodo        TEXT DEFAULT 'whatsapp',
  estado        TEXT DEFAULT 'pendente',
  comprovativo  TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  processado_em TIMESTAMPTZ
);
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_pagamentos" ON pagamentos
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_pagamentos" ON pagamentos
  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_pagamentos" ON pagamentos
  FOR UPDATE TO anon USING (true);

-- 3. DOCUMENTOS
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
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_documentos" ON documentos
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_documentos" ON documentos
  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_documentos" ON documentos
  FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_documentos" ON documentos
  FOR DELETE TO anon USING (true);

-- 4. ACADEMY_AI_LOGS (telemetria do backend)
CREATE TABLE IF NOT EXISTS academy_ai_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action          TEXT,
  model           TEXT,
  tokens_in       INTEGER DEFAULT 0,
  tokens_out      INTEGER DEFAULT 0,
  duration_ms     INTEGER DEFAULT 0,
  success         BOOLEAN DEFAULT true,
  error_message   TEXT,
  user_id         TEXT,
  session_id      TEXT,
  pages_requested INTEGER DEFAULT 0,
  word_count      INTEGER DEFAULT 0,
  model_used      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE academy_ai_logs ENABLE ROW LEVEL SECURITY;

-- 5. ACADEMY_HISTORY (histórico do utilizador no backend)
CREATE TABLE IF NOT EXISTS academy_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT NOT NULL DEFAULT '',
  tipo        TEXT,
  tema        TEXT,
  pags        INTEGER DEFAULT 0,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE academy_history ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_pagamentos_utilizador ON pagamentos(utilizador_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_estado ON pagamentos(estado);
CREATE INDEX IF NOT EXISTS idx_documentos_uid ON documentos(uid);
CREATE INDEX IF NOT EXISTS idx_academy_history_user ON academy_history(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_ai_logs_created ON academy_ai_logs(created_at);
