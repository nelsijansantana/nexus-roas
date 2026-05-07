-- License system tables for Nexus ROAS self-hosted distribution

CREATE TABLE IF NOT EXISTS licenses (
  id          TEXT PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  tier        TEXT NOT NULL DEFAULT 'starter',
  status      TEXT NOT NULL DEFAULT 'active',
  max_projects      INTEGER NOT NULL DEFAULT 1,
  max_sales_month   INTEGER NOT NULL DEFAULT 500,
  max_seats         INTEGER NOT NULL DEFAULT 1,
  data_retention_days INTEGER NOT NULL DEFAULT 60,
  domain      TEXT DEFAULT '',
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS license_usage (
  license_key TEXT NOT NULL,
  month       TEXT NOT NULL,
  domain      TEXT DEFAULT '',
  sales_count INTEGER DEFAULT 0,
  last_ping   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (license_key, month)
);

CREATE INDEX IF NOT EXISTS idx_licenses_key    ON licenses(key);
CREATE INDEX IF NOT EXISTS idx_licenses_email  ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- Owner license: never expires, unlimited everything
INSERT OR IGNORE INTO licenses (id, key, email, name, tier, status, max_projects, max_sales_month, max_seats, data_retention_days, expires_at)
VALUES (
  'nexus-owner-internal',
  'NEXUS-INTERNAL-OWNER',
  'nelsijansilva@gmail.com',
  'Nelsijan (Owner)',
  'agency',
  'active',
  -1, -1, -1, 365,
  NULL
);
