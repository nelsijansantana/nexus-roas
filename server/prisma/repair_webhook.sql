-- Reparo idempotente: garante que webhook_account_id e account_webhooks existem.
-- Executado toda vez que o container sobe; seguro de re-executar.

DO $$
BEGIN
  -- 1. Coluna webhook_account_id em users
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'webhook_account_id'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "webhook_account_id" TEXT;
    UPDATE "users" SET "webhook_account_id" = gen_random_uuid()::TEXT WHERE "webhook_account_id" IS NULL;
    ALTER TABLE "users" ALTER COLUMN "webhook_account_id" SET NOT NULL;
  END IF;

  -- 2. Índice único
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'users_webhook_account_id_key'
  ) THEN
    CREATE UNIQUE INDEX "users_webhook_account_id_key" ON "users"("webhook_account_id");
  END IF;

  -- 3. Tabela account_webhooks
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'account_webhooks'
  ) THEN
    CREATE TABLE "account_webhooks" (
      "id"          TEXT        NOT NULL,
      "user_id"     TEXT        NOT NULL,
      "gateway"     TEXT        NOT NULL,
      "name"        TEXT        NOT NULL,
      "project_ids" TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
      "is_active"   BOOLEAN     NOT NULL DEFAULT true,
      "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at"  TIMESTAMP(3) NOT NULL,
      CONSTRAINT "account_webhooks_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "account_webhooks_user_id_idx" ON "account_webhooks"("user_id");
    ALTER TABLE "account_webhooks"
      ADD CONSTRAINT "account_webhooks_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
