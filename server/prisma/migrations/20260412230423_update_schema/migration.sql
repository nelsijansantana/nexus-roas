/*
  Warnings:

  - You are about to drop the column `project_type` on the `projects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pixel_events" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "project_type",
ADD COLUMN     "projectType" TEXT NOT NULL DEFAULT 'ecommerce';
