-- =============================================================
-- Migration 0002: account_id para isolamento multi-tenant
-- Permite lookup de user_store e deduplicação de webhook_raw
-- filtrado por conta (aid) em vez de apenas por projeto (pid).
-- =============================================================

-- user_store: adiciona account_id para lookup isolado por conta
ALTER TABLE user_store ADD COLUMN account_id TEXT NOT NULL DEFAULT '';

-- Índice composto para lookup eficiente: account_id + nx_user
CREATE INDEX IF NOT EXISTS idx_user_store_account_nx_user
  ON user_store (account_id, nx_user)
  WHERE account_id != '';

-- Índice composto para fallback Tier-3: account_id + cart_token
CREATE INDEX IF NOT EXISTS idx_user_store_account_cart_token
  ON user_store (account_id, cart_token)
  WHERE account_id != '' AND cart_token IS NOT NULL;

-- webhook_raw: adiciona account_id para deduplicação cross-projeto por conta
ALTER TABLE webhook_raw ADD COLUMN account_id TEXT NOT NULL DEFAULT '';

-- Novo índice de dedup por conta: uma venda = um evento, independente de quantos projetos a conta tenha
-- O WHERE garante que registros legados (account_id='') não colidam neste índice
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_raw_account_dedup
  ON webhook_raw (account_id, gateway, order_id)
  WHERE account_id != '' AND order_id IS NOT NULL;
