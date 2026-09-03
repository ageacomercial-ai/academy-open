-- ═══════════════════════════════════════════════════════════
-- 0002 — WEBHOOK_LOGS (integração Vanqir - Parte 2)
-- Registo de todas as entregas de webhook (Vanqir) e do seu estado.
-- Estados: RECEIVED · PROCESSING · PROCESSED · FAILED · IGNORED
-- Idempotência: UNIQUE(delivery_id, event) → a mesma entrega+evento
-- só pode ser processada uma vez.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webhook_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id   TEXT NOT NULL,                -- X-Vanqir-Delivery / body.id
  event         TEXT NOT NULL,                -- ordem/order.paid, order.refunded...
  status        TEXT NOT NULL DEFAULT 'RECEIVED',
  attempt       INTEGER DEFAULT 1,            -- X-Vanqir-Attempt
  received_at   TIMESTAMPTZ DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  error         TEXT,
  payload       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (delivery_id, event)
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_delivery ON webhook_logs(delivery_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status    ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created   ON webhook_logs(created_at);

/* RLS: sem políticas anon — só o backend (service role) acede. */
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;