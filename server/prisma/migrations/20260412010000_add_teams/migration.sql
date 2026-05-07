-- Safe migration: adds team_memberships and project_access tables.
-- No existing columns are dropped or modified.

CREATE TABLE IF NOT EXISTS "team_memberships" (
    "id"        TEXT        NOT NULL,
    "ownerId"   TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "role"      TEXT        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_memberships_ownerId_userId_key" ON "team_memberships"("ownerId", "userId");
CREATE INDEX IF NOT EXISTS "team_memberships_ownerId_idx" ON "team_memberships"("ownerId");
CREATE INDEX IF NOT EXISTS "team_memberships_userId_idx"  ON "team_memberships"("userId");

CREATE TABLE IF NOT EXISTS "project_access" (
    "id"           TEXT        NOT NULL,
    "membershipId" TEXT        NOT NULL,
    "projectId"    TEXT        NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_access_membershipId_projectId_key" ON "project_access"("membershipId", "projectId");
CREATE INDEX IF NOT EXISTS "project_access_membershipId_idx" ON "project_access"("membershipId");

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'team_memberships_ownerId_fkey' AND table_name = 'team_memberships'
  ) THEN
    ALTER TABLE "team_memberships"
      ADD CONSTRAINT "team_memberships_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'team_memberships_userId_fkey' AND table_name = 'team_memberships'
  ) THEN
    ALTER TABLE "team_memberships"
      ADD CONSTRAINT "team_memberships_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'project_access_membershipId_fkey' AND table_name = 'project_access'
  ) THEN
    ALTER TABLE "project_access"
      ADD CONSTRAINT "project_access_membershipId_fkey"
      FOREIGN KEY ("membershipId") REFERENCES "team_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'project_access_projectId_fkey' AND table_name = 'project_access'
  ) THEN
    ALTER TABLE "project_access"
      ADD CONSTRAINT "project_access_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
