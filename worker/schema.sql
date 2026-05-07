-- =============================================================
-- Schema D1 — Nexus Worker Tracking System
-- =============================================================

-- user_store: Persistent identity of the visitor (first-touch wins via COALESCE)
CREATE TABLE IF NOT EXISTS user_store (
  nx_user          TEXT PRIMARY KEY,
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Account isolation (multi-tenant)
  account_id       TEXT,
  -- Browser fingerprint
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
  -- Identity (PII)
  email            TEXT,
  phone            TEXT,
  fullname         TEXT,
  -- Location
  city             TEXT,
  state            TEXT,
  country          TEXT,
  zip              TEXT,
  -- E-commerce (cart_token for Tier-3 webhook attribution)
  cart_token       TEXT,
  -- First-touch UTM attribution (immutable once set)
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  utm_content      TEXT,
  utm_term         TEXT,
  utm_id           TEXT,
  utm_platform     TEXT,
  utm_network      TEXT,
  ad_id            TEXT,
  adset_id         TEXT,
  campaign_id      TEXT,
  placement        TEXT,
  creative_format  TEXT,
  conversion_type  TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_store_cart_token ON user_store (cart_token) WHERE cart_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_store_account    ON user_store (account_id)  WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_store_email      ON user_store (email)       WHERE email IS NOT NULL;

-- user_attribution: Last-touch click IDs per user per project (30-day recovery window)
-- Separate from user_store because user_store is first-touch (COALESCE).
-- user_attribution is last-touch: each new non-empty click ID overwrites the previous.
CREATE TABLE IF NOT EXISTS user_attribution (
  nx_user    TEXT NOT NULL,
  pixel_id   TEXT NOT NULL,
  -- Last-touch click IDs
  fbclid     TEXT NOT NULL DEFAULT '',
  fbc        TEXT NOT NULL DEFAULT '',
  gclid      TEXT NOT NULL DEFAULT '',
  gbraid     TEXT NOT NULL DEFAULT '',
  wbraid     TEXT NOT NULL DEFAULT '',
  ttclid     TEXT NOT NULL DEFAULT '',
  msclkid    TEXT NOT NULL DEFAULT '',
  twclid     TEXT NOT NULL DEFAULT '',
  -- Timestamp (Unix ms) used for 30-day window check
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (nx_user, pixel_id)
);

CREATE INDEX IF NOT EXISTS idx_attribution_lookup ON user_attribution (nx_user, pixel_id, updated_at);

-- events: CAPI dispatch audit log (30-day retention)
CREATE TABLE IF NOT EXISTS events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  site_id          TEXT    NOT NULL,
  event_name       TEXT    NOT NULL,
  event_id         TEXT,
  platform         TEXT    NOT NULL, -- meta_ads, tiktok_ads, google_analytics_4, google_ads, nexus
  channel          TEXT    NOT NULL, -- web, webhook, server
  source           TEXT    NOT NULL, -- collect, shopify, cartpanda, hotmart, etc.
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
CREATE INDEX IF NOT EXISTS idx_events_nx_user   ON events (nx_user);
CREATE INDEX IF NOT EXISTS idx_events_site      ON events (site_id, timestamp DESC);

-- webhook_raw: Atomic deduplication store for gateway webhooks
CREATE TABLE IF NOT EXISTS webhook_raw (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  site_id    TEXT    NOT NULL,
  webhook_id TEXT,                  -- ?wid= endpoint ID (nullable for legacy ?pid= route)
  gateway    TEXT    NOT NULL,
  order_id   TEXT,
  payload    TEXT    NOT NULL,
  processed  INTEGER NOT NULL DEFAULT 0,
  error      TEXT,
  UNIQUE(site_id, gateway, order_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_raw_wid ON webhook_raw (webhook_id, order_id) WHERE webhook_id IS NOT NULL;

-- orders_dispatched: cross-endpoint dedup per project.
-- Prevents the same order from being dispatched twice when two ?wid= endpoints
-- share the same site_id (e.g. two integrations pointing to the same project).
CREATE TABLE IF NOT EXISTS orders_dispatched (
  site_id   TEXT NOT NULL,
  gateway   TEXT NOT NULL,
  order_id  TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (site_id, gateway, order_id)
);

-- checkout_sessions: snapshot de sinais no momento do checkout (atribuição resiliente)
CREATE TABLE IF NOT EXISTS checkout_sessions (
  token       TEXT    NOT NULL,
  pixel_id    TEXT    NOT NULL,
  nx_user     TEXT    NOT NULL,
  account_id  TEXT,
  status      TEXT    NOT NULL DEFAULT 'cart',
  order_id    TEXT    NOT NULL DEFAULT '',
  value       REAL    NOT NULL DEFAULT 0,
  currency    TEXT    NOT NULL DEFAULT '',
  items       TEXT    NOT NULL DEFAULT '[]',
  email       TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  firstname   TEXT    NOT NULL DEFAULT '',
  lastname    TEXT    NOT NULL DEFAULT '',
  city        TEXT    NOT NULL DEFAULT '',
  zip         TEXT    NOT NULL DEFAULT '',
  country     TEXT    NOT NULL DEFAULT '',
  ip          TEXT    NOT NULL DEFAULT '',
  user_agent  TEXT    NOT NULL DEFAULT '',
  fbp         TEXT    NOT NULL DEFAULT '',
  fbc         TEXT    NOT NULL DEFAULT '',
  fbclid      TEXT    NOT NULL DEFAULT '',
  gclid       TEXT    NOT NULL DEFAULT '',
  ttclid      TEXT    NOT NULL DEFAULT '',
  ttp         TEXT    NOT NULL DEFAULT '',
  utm_source  TEXT    NOT NULL DEFAULT '',
  utm_medium  TEXT    NOT NULL DEFAULT '',
  utm_campaign TEXT   NOT NULL DEFAULT '',
  utm_content  TEXT   NOT NULL DEFAULT '',
  utm_term     TEXT   NOT NULL DEFAULT '',
  channel      TEXT   NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  PRIMARY KEY (token, pixel_id)
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_nx_user ON checkout_sessions (nx_user, pixel_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order   ON checkout_sessions (order_id, pixel_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status  ON checkout_sessions (nx_user, pixel_id, status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_account ON checkout_sessions (account_id);

-- cart_links: ponte token → nx_user para resolução cross-gateway
CREATE TABLE IF NOT EXISTS cart_links (
  token       TEXT    NOT NULL,
  token_type  TEXT    NOT NULL,
  pixel_id    TEXT    NOT NULL,
  nx_user     TEXT    NOT NULL,
  account_id  TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (token, token_type, pixel_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_links_nx_user ON cart_links (nx_user, pixel_id);
CREATE INDEX IF NOT EXISTS idx_cart_links_account ON cart_links (account_id);

-- capi_log: auditoria de despacho CAPI por plataforma (-1=n/a, 0=falhou, 1=ok)
CREATE TABLE IF NOT EXISTS capi_log (
  pixel_id    TEXT    NOT NULL,
  event_id    TEXT    NOT NULL,
  event_name  TEXT    NOT NULL,
  nx_user     TEXT    NOT NULL DEFAULT '',
  capi_meta     INTEGER NOT NULL DEFAULT -1,
  capi_tiktok   INTEGER NOT NULL DEFAULT -1,
  capi_ga4      INTEGER NOT NULL DEFAULT -1,
  capi_gads     INTEGER NOT NULL DEFAULT -1,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (pixel_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_capi_log_user  ON capi_log (nx_user, pixel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capi_log_event ON capi_log (event_name, created_at DESC);
