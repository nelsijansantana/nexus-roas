-- Migration: webhook_account_id + account_webhooks
-- Adiciona UUID público estável por conta para URLs de webhook (?wid=)
-- e cria a tabela de endpoints de webhook configuráveis.

-- 1. Adiciona webhook_account_id na tabela users
ALTER TABLE "users" ADD COLUMN "webhook_account_id" TEXT;

-- Popula registros existentes com UUIDs únicos
UPDATE "users" SET "webhook_account_id" = gen_random_uuid()::TEXT WHERE "webhook_account_id" IS NULL;

-- Torna NOT NULL e único
ALTER TABLE "users" ALTER COLUMN "webhook_account_id" SET NOT NULL;
CREATE UNIQUE INDEX "users_webhook_account_id_key" ON "users"("webhook_account_id");

-- 2. Cria tabela de webhook endpoints configuráveis
CREATE TABLE "account_webhooks" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "gateway"     TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "project_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_webhooks_pkey" PRIMARY KEY ("id")
);

-- Índice para listagem por usuário
CREATE INDEX "account_webhooks_user_id_idx" ON "account_webhooks"("user_id");

-- FK para users
ALTER TABLE "account_webhooks"
    ADD CONSTRAINT "account_webhooks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
