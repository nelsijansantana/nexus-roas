-- =============================================================
-- Migration 0005: Add user_attribution table
-- Stores last-touch click IDs per (nx_user, pixel_id) with a
-- 30-day recovery window for webhook attribution enrichment.
-- =============================================================

CREATE TABLE IF NOT EXISTS user_attribution (
  nx_user    TEXT NOT NULL,
  pixel_id   TEXT NOT NULL,
  fbclid     TEXT NOT NULL DEFAULT '',
  fbc        TEXT NOT NULL DEFAULT '',
  gclid      TEXT NOT NULL DEFAULT '',
  gbraid     TEXT NOT NULL DEFAULT '',
  wbraid     TEXT NOT NULL DEFAULT '',
  ttclid     TEXT NOT NULL DEFAULT '',
  msclkid    TEXT NOT NULL DEFAULT '',
  twclid     TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (nx_user, pixel_id)
);

CREATE INDEX IF NOT EXISTS idx_attribution_lookup ON user_attribution (nx_user, pixel_id, updated_at);
