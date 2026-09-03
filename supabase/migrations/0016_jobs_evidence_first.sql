-- 0016_jobs_evidence_first — Ajusta jobs para Evidence-First + tokens/custo
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_chapter INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tokens_prompt INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tokens_completion INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tokens_total INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,6) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cost_status TEXT DEFAULT 'UNKNOWN';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS claims_total INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sources_verified INT DEFAULT 0;

-- Garante status com CANCELLED
DO $$ BEGIN
  ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
  ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('pending','processing','completed','failed','cancelled'));
EXCEPTION WHEN OTHERS THEN null; END $$;

-- Índice para retomada
CREATE INDEX IF NOT EXISTS idx_jobs_document ON jobs(document_id);
