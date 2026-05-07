-- Safe migration: adds plan and planStartDate columns to users.
-- Existing users default to 'free' plan with no planStartDate.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "planStartDate" TIMESTAMP(3);
