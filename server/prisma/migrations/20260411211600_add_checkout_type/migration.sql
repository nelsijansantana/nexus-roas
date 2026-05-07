-- Safe migration: adds checkoutType column and integrations table.
-- Does NOT drop any existing columns — old columns (pixelFacebookId, tokenFacebookApi, etc.)
-- are kept for backward compatibility while the integrations refactor is completed.

-- Add checkoutType to projects (default 'shopify' covers all existing rows)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "checkoutType" TEXT NOT NULL DEFAULT 'shopify';

-- Create integrations table (new generic platform config table)
CREATE TABLE IF NOT EXISTS "integrations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- Indexes for integrations
CREATE INDEX IF NOT EXISTS "integrations_projectId_idx" ON "integrations"("projectId");
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_projectId_type_key" ON "integrations"("projectId", "type");

-- Foreign key (only add if integrations table was just created)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'integrations_projectId_fkey'
      AND table_name = 'integrations'
  ) THEN
    ALTER TABLE "integrations"
      ADD CONSTRAINT "integrations_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
