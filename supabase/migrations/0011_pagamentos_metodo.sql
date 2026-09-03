-- ═══════════════════════════════════════════════════════════
-- 0011 — PAGAMENTOS: moeda + metodo (webhook Vanqir)
-- O processarOrderPaid do webhook grava moeda/metodo no pagamento
-- interno (metodo='vanqir', moeda='AOA') — colunas em falta na DDL.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS moeda   TEXT DEFAULT 'AOA';
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS metodo  TEXT;

CREATE INDEX IF NOT EXISTS idx_pagamentos_estado ON pagamentos(estado);