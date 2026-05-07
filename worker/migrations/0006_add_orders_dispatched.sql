-- =============================================================
-- Migration 0006: Add orders_dispatched table
-- Cross-endpoint deduplication: prevents the same order from
-- being dispatched to CAPI twice when two ?wid= endpoints share
-- the same site_id.
-- =============================================================

CREATE TABLE IF NOT EXISTS orders_dispatched (
  site_id   TEXT NOT NULL,
  gateway   TEXT NOT NULL,
  order_id  TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (site_id, gateway, order_id)
);
