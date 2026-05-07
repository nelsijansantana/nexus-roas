-- CreateTable: pixel_events
-- Stores event trigger rules for direct-response projects.
-- Rules are returned to direct-pixel.js on PageView and applied client-side.

CREATE TABLE IF NOT EXISTS "pixel_events" (
  "id"           TEXT NOT NULL,
  "project_id"   TEXT NOT NULL,
  "event_name"   TEXT NOT NULL,
  "trigger_type" TEXT NOT NULL,
  "selector"     TEXT,
  "button_text"  TEXT,
  "scroll_depth" INTEGER,
  "time_seconds" INTEGER,
  "custom_data"  JSONB NOT NULL DEFAULT '{}',
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pixel_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pixel_events"
  ADD CONSTRAINT "pixel_events_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pixel_events_project_id_idx"
  ON "pixel_events"("project_id");

CREATE INDEX IF NOT EXISTS "pixel_events_project_id_is_active_idx"
  ON "pixel_events"("project_id", "is_active");
