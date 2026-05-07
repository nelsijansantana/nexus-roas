-- CreateTable: billing_config (key-value store for billing platform settings)
CREATE TABLE IF NOT EXISTS billing_config (
  id           TEXT         NOT NULL,
  key          TEXT         NOT NULL,
  value        TEXT         NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_config_key_idx ON billing_config(key);

-- AlterTable: add stripe_customer_id to users (nullable, no default needed)
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
