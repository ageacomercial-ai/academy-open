-- 0017_ebook_creator_foundation.sql — Ebook Creator foundation
-- Mantém tabelas existentes (documentos, utilizadores) para compatibilidade; cria novas

-- EBOOKS (projetos)
CREATE TABLE IF NOT EXISTS ebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  title TEXT DEFAULT 'Sem título',
  slug TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','planning','generating','reviewing','designing','ready','exporting','completed','failed')),
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  outline JSONB DEFAULT '{}',
  theme TEXT DEFAULT 'modern',
  cover JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_ebooks" ON ebooks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_ebooks" ON ebooks FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_ebooks" ON ebooks FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_ebooks" ON ebooks FOR DELETE TO anon USING (true);

-- CHAPTERS
CREATE TABLE IF NOT EXISTS chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ebook_id UUID NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  title TEXT,
  subs JSONB DEFAULT '[]',
  blocks JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','generating','ready','failed')),
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_chapters" ON chapters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_chapters_ebook ON chapters(ebook_id, order_index);

-- ASSETS (imagens, etc)
CREATE TABLE IF NOT EXISTS assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ebook_id UUID REFERENCES ebooks(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'image',
  url TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_assets" ON assets FOR ALL TO anon USING (true) WITH CHECK (true);

-- EXPORTS
CREATE TABLE IF NOT EXISTS exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ebook_id UUID REFERENCES ebooks(id) ON DELETE CASCADE,
  format TEXT DEFAULT 'pdf',
  url TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_exports" ON exports FOR ALL TO anon USING (true) WITH CHECK (true);

-- AI LOGS (por tarefa)
CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ebook_id UUID REFERENCES ebooks(id) ON DELETE SET NULL,
  task TEXT,
  model TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_estimated NUMERIC(10,6) DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_ai_logs" ON ai_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ai_logs_ebook ON ai_logs(ebook_id);
CREATE INDEX IF NOT EXISTS idx_ebooks_owner ON ebooks(owner_id);
CREATE INDEX IF NOT EXISTS idx_ebooks_status ON ebooks(status);
