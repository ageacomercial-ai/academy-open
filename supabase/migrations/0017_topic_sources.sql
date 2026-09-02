-- 0017_topic_sources.sql — cache reutilizável de fontes por tema
CREATE TABLE IF NOT EXISTS topic_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_key TEXT NOT NULL,
  source_id UUID REFERENCES sources(id),
  relevance_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_topic_sources_key ON topic_sources(topic_key);
ALTER TABLE topic_sources ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='anon_select_topic_sources') THEN
    CREATE POLICY "anon_select_topic_sources" ON topic_sources FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='anon_insert_topic_sources') THEN
    CREATE POLICY "anon_insert_topic_sources" ON topic_sources FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
