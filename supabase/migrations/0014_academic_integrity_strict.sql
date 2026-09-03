-- 0014_academic_integrity_strict.sql
-- Sistema de Investigação Verificável — STRICT mode
-- Tabelas: sources, claims, source_claims, datasets, dataset_rows, results, generation_logs

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE source_type AS ENUM ('JOURNAL_ARTICLE','BOOK','THESIS','DISSERTATION','CONFERENCE','OFFICIAL_GOVERNMENT','INTERNATIONAL_ORGANIZATION','STATISTICAL_DATABASE','WEBSITE','REPORT','USER_UPLOADED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('UNVERIFIED','PENDING','VERIFIED','REJECTED','PARTIALLY_VERIFIED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE claim_type AS ENUM ('PRIMARY_DATA','SECONDARY_DATA','OFFICIAL_STATISTIC','ACADEMIC_SOURCE','THEORETICAL_STATEMENT','COMMON_KNOWLEDGE','USER_PROVIDED','MODEL_GENERATED','INFERENCE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE support_status AS ENUM ('DIRECTLY_SUPPORTS','PARTIALLY_SUPPORTS','CONTRADICTS','DOES_NOT_SUPPORT','NOT_CHECKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE dataset_origin AS ENUM ('USER_UPLOAD','PLATFORM_COLLECTED','EXTERNAL_IMPORT','BIBLIOGRAPHIC');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. SOURCES — fontes verificáveis
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  authors TEXT[] DEFAULT '{}',
  publication_year INT CHECK (publication_year BETWEEN 1000 AND 2100),
  publisher TEXT,
  journal TEXT,
  volume TEXT,
  issue TEXT,
  pages TEXT,
  doi TEXT UNIQUE,
  url TEXT,
  source_type source_type NOT NULL DEFAULT 'WEBSITE',
  institution TEXT,
  country TEXT,
  language TEXT DEFAULT 'pt',
  retrieved_at TIMESTAMPTZ DEFAULT NOW(),
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  verification_score FLOAT CHECK (verification_score BETWEEN 0 AND 1),
  raw_metadata JSONB DEFAULT '{}',
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sources_doi ON sources(doi);
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(verification_status);
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_sources" ON sources;
CREATE POLICY "anon_select_sources" ON sources FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_sources" ON sources;
CREATE POLICY "anon_insert_sources" ON sources FOR INSERT TO anon WITH CHECK (true);

-- 3. CLAIMS — afirmações classificadas
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id TEXT NOT NULL,
  generation_id TEXT,
  text TEXT NOT NULL,
  claim_type claim_type NOT NULL DEFAULT 'MODEL_GENERATED',
  source_type TEXT,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  evidence TEXT,
  support_status support_status DEFAULT 'NOT_CHECKED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claims_doc ON claims(doc_id);
CREATE INDEX IF NOT EXISTS idx_claims_type ON claims(claim_type);
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_claims" ON claims;
CREATE POLICY "anon_select_claims" ON claims FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_claims" ON claims;
CREATE POLICY "anon_insert_claims" ON claims FOR INSERT TO anon WITH CHECK (true);

-- 4. SOURCE_CLAIMS — ligação N:N com evidência
CREATE TABLE IF NOT EXISTS source_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  support_status support_status NOT NULL DEFAULT 'NOT_CHECKED',
  evidence_text TEXT,
  page TEXT,
  section TEXT,
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, claim_id)
);
ALTER TABLE source_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_source_claims" ON source_claims;
CREATE POLICY "anon_select_source_claims" ON source_claims FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_source_claims" ON source_claims;
CREATE POLICY "anon_insert_source_claims" ON source_claims FOR INSERT TO anon WITH CHECK (true);

-- 5. DATASETS
CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  origin dataset_origin NOT NULL DEFAULT 'USER_UPLOAD',
  uploaded_by TEXT,
  doc_id TEXT,
  row_count INT DEFAULT 0,
  column_count INT DEFAULT 0,
  hash TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_datasets" ON datasets;
CREATE POLICY "anon_select_datasets" ON datasets FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_datasets" ON datasets;
CREATE POLICY "anon_insert_datasets" ON datasets FOR INSERT TO anon WITH CHECK (true);

CREATE TABLE IF NOT EXISTS dataset_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset ON dataset_rows(dataset_id);
ALTER TABLE dataset_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_dataset_rows" ON dataset_rows;
CREATE POLICY "anon_select_dataset_rows" ON dataset_rows FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_dataset_rows" ON dataset_rows;
CREATE POLICY "anon_insert_dataset_rows" ON dataset_rows FOR INSERT TO anon WITH CHECK (true);

-- 6. RESULTS — resultados rastreáveis
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id TEXT NOT NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'statistic',
  value TEXT NOT NULL,
  unit TEXT,
  calculation TEXT,
  generated_from TEXT,
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_results" ON results;
CREATE POLICY "anon_select_results" ON results FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_results" ON results;
CREATE POLICY "anon_insert_results" ON results FOR INSERT TO anon WITH CHECK (true);

-- 7. GENERATION_LOGS — auditoria
CREATE TABLE IF NOT EXISTS generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id TEXT NOT NULL,
  user_id TEXT,
  project_id TEXT,
  doc_id TEXT,
  source_ids UUID[] DEFAULT '{}',
  claim_ids UUID[] DEFAULT '{}',
  dataset_ids UUID[] DEFAULT '{}',
  model TEXT,
  prompt_version TEXT,
  validation_version TEXT,
  integrity_score INT CHECK (integrity_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_generation_logs" ON generation_logs;
CREATE POLICY "anon_insert_generation_logs" ON generation_logs FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_select_generation_logs" ON generation_logs;
CREATE POLICY "anon_select_generation_logs" ON generation_logs FOR SELECT TO anon USING (true);
