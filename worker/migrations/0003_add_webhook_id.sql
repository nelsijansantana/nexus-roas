-- =============================================================
-- Migration 0003: webhook_id para deduplicação por endpoint configurável
-- Cada webhook endpoint tem seu próprio ID (?wid=) e sua própria
-- deduplicação — uma venda não pode ser processada duas vezes
-- pelo mesmo endpoint, independente de qual projeto está associado.
-- =============================================================

-- webhook_raw: adiciona coluna para o endpoint que recebeu a requisição
ALTER TABLE webhook_raw ADD COLUMN webhook_id TEXT;

-- Dedup por endpoint: (webhook_id, order_id) é único
-- WHERE garante que registros legados (?pid=) não colidam aqui
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_raw_wid_dedup
  ON webhook_raw (webhook_id, order_id)
  WHERE webhook_id IS NOT NULL AND order_id IS NOT NULL;
