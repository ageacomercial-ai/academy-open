-- ═══════════════════════════════════════════════════════════
-- 0007 — PAGAMENTOS: ligação Vanqir (order_id/order_number)
-- Permite ao backend associar de forma EXPLÍCITA o pagamento
-- interno ao order_id da Vanqir (sem depender de nome/telefone).
-- ═══════════════════════════════════════════════════════════

ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS vanqir_order_id     TEXT;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS vanqir_order_number TEXT;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS vanqir_delivery_id  TEXT;

CREATE INDEX IF NOT EXISTS idx_pagamentos_vanqir_order ON pagamentos(vanqir_order_id);

-- Identificadores oficiais da oferta Vanqir (Parte 2, §5):
-- o pacote é identificado por product_id/offer_id/offer_name oficiais
-- e NUNCA inferido apenas pelo valor pago.
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS offer_id   TEXT;
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS offer_name TEXT;