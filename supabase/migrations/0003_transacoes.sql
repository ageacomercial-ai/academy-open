-- ═══════════════════════════════════════════════════════════
-- 0003 — TRANSACOES (histórico financeiro Vanqir)
-- Regista cada ordem paga/reembolsada com valores históricos.
-- O preço fica gravado na própria transacção (total_amount) —
-- NÃO depende do preço actual em `precos` (imutável no tempo).
-- Idempotência: UNIQUE(order_id, event) → uma ordem+evento só entra uma vez.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transacoes (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id        TEXT,                    -- X-Vanqir-Delivery
  order_id           TEXT NOT NULL,           -- order.id (Vanqir)
  order_number       TEXT,                    -- VP-2026-0001
  product_id         TEXT,                    -- product_id (Vanqir)
  event              TEXT NOT NULL DEFAULT 'order.paid',
  total_amount       NUMERIC(12,2) DEFAULT 0,       -- preço histórico
  seller_net_amount  NUMERIC(12,2) DEFAULT 0,
  commission_amount  NUMERIC(12,2) DEFAULT 0,
  payment_method     TEXT,
  buyer_name         TEXT,
  buyer_email        TEXT,
  buyer_phone        TEXT,
  paid_at            TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'paid',  -- paid / refunded
  moeda              TEXT DEFAULT 'AOA',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (order_id, event)
);

CREATE INDEX IF NOT EXISTS idx_transacoes_order_id    ON transacoes(order_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_product_id  ON transacoes(product_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_created     ON transacoes(created_at);

/* RLS: sem políticas anon — só o backend (service role) acede. */
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;