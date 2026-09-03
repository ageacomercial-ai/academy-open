-- ═══════════════════════════════════════════════════════════
-- 0004 — PRECOS + PLANOS_GRAFICA (DDL versionado + product_id)
-- Estas tabelas já existiam na DB mas sem schema versionado.
-- Adiciona product_id para o futuro mapeamento:
--   Vanqir Product → Produto/Plano interno (Parte 2).
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS precos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faixa_inicio  INTEGER NOT NULL,
  faixa_fim     INTEGER NOT NULL,
  preco         NUMERIC(10,2) DEFAULT 0,
  label         TEXT,
  ativo         BOOLEAN DEFAULT true,
  product_id    TEXT,                     -- product_id Vanqir (parte 2)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (faixa_inicio, faixa_fim)
);

ALTER TABLE precos ADD COLUMN IF NOT EXISTS product_id TEXT;

CREATE TABLE IF NOT EXISTS planos_grafica (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  paginas    INTEGER DEFAULT 0,
  preco      NUMERIC(10,2) DEFAULT 0,
  ativo      BOOLEAN DEFAULT true,
  product_id TEXT,                     -- product_id Vanqir (parte 2)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (nome)
);

ALTER TABLE planos_grafica ADD COLUMN IF NOT EXISTS product_id TEXT;

/* RLS: leitura pública mantida (frontend carrega preços com anon key). */
ALTER TABLE precos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_precos" ON precos;
CREATE POLICY "anon_select_precos" ON precos
  FOR SELECT TO anon USING (true);

ALTER TABLE planos_grafica ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_planos_grafica" ON planos_grafica;
CREATE POLICY "anon_select_planos_grafica" ON planos_grafica
  FOR SELECT TO anon USING (true);