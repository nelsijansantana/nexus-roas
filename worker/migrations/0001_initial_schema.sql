-- =============================================================
-- Migration 0001: Schema inicial
-- Tabelas base do sistema de rastreamento Nexus Worker.
-- =============================================================

CREATE TABLE IF NOT EXISTS user_store (
  nx_user          TEXT PRIMARY KEY,
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ip               TEXT,
  user_agent       TEXT,
  fbp              TEXT,
  fbc              TEXT,
  ttp              TEXT,
  ttclid           TEXT,
  ga_client_id     TEXT,
  ga_session_id    TEXT,
  ga_session_count TEXT,
  ga_timestamp     TEXT,
  page_url         TEXT,
  email            TEXT,
  phone            TEXT,
  fullname         TEXT,
  city             TEXT,
  state            TEXT,
  country          TEXT,
  zip              TEXT,
  cart_token       TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_store_cart_token ON user_store (cart_token) WHERE cart_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  site_id          TEXT    NOT NULL,
  event_name       TEXT    NOT NULL,
  event_id         TEXT,
  platform         TEXT    NOT NULL,
  channel          TEXT    NOT NULL,
  source           TEXT    NOT NULL,
  status_code      INTEGER,
  request_ms       INTEGER,
  sent_payload     TEXT,
  error_message    TEXT,
  response_payload TEXT,
  nx_user          TEXT,
  source_ip        TEXT,
  user_agent       TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_nx_user    ON events (nx_user);

CREATE TABLE IF NOT EXISTS webhook_raw (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  site_id   TEXT    NOT NULL,
  gateway   TEXT    NOT NULL,
  order_id  TEXT,
  payload   TEXT    NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  error     TEXT,
  UNIQUE(site_id, gateway, order_id)
);
