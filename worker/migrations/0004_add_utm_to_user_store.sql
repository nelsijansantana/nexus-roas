-- =============================================================
-- Migration 0004: Add UTM / attribution columns to user_store
-- Allows webhook handlers to recover browser-session UTMs for
-- gateways that don't carry UTM data in their webhook payload
-- (e.g. CartPanda, Hotmart, etc.)
-- =============================================================

ALTER TABLE user_store ADD COLUMN utm_source      TEXT;
ALTER TABLE user_store ADD COLUMN utm_medium      TEXT;
ALTER TABLE user_store ADD COLUMN utm_campaign    TEXT;
ALTER TABLE user_store ADD COLUMN utm_content     TEXT;
ALTER TABLE user_store ADD COLUMN utm_term        TEXT;
ALTER TABLE user_store ADD COLUMN utm_id          TEXT;
ALTER TABLE user_store ADD COLUMN utm_platform    TEXT;
ALTER TABLE user_store ADD COLUMN utm_network     TEXT;
ALTER TABLE user_store ADD COLUMN ad_id           TEXT;
ALTER TABLE user_store ADD COLUMN adset_id        TEXT;
ALTER TABLE user_store ADD COLUMN campaign_id     TEXT;
ALTER TABLE user_store ADD COLUMN placement       TEXT;
ALTER TABLE user_store ADD COLUMN creative_format TEXT;
ALTER TABLE user_store ADD COLUMN conversion_type TEXT;
