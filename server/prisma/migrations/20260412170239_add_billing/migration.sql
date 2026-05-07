-- AlterTable
ALTER TABLE "billing_config" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "team_memberships" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "billing_config_key_idx" RENAME TO "billing_config_key_key";
