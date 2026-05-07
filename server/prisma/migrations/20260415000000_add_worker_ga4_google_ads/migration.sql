-- Safe migration: adds Cloudflare Worker fields, GA4, Google Ads and custom domain
-- All statements use IF NOT EXISTS / column existence checks to be idempotent.

-- ── Cloudflare Worker multi-tenant fields ────────────────────────────────────
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "ingest_api_key" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "worker_mode"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "worker_url"     TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "custom_domain"  TEXT;

-- ── Google Analytics 4 — Measurement Protocol ───────────────────────────────
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "ga4_measurement_id" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "ga4_api_secret"     TEXT;

-- ── Google Ads — Enhanced Conversions ───────────────────────────────────────
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "google_ads_conversion_id"    TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "google_ads_label_contact"    TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "google_ads_label_lead"       TEXT;
