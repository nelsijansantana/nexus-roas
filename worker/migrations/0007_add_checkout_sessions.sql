-- checkout_sessions: snapshot completo de sinais no momento do checkout.
-- Garante que fbp, fbc, click IDs e UTMs sejam preservados mesmo quando
-- o webhook chegar incompleto (ex: Shopify sem metadata de atribuição).
CREATE TABLE IF NOT EXISTS checkout_sessions (
  token       TEXT    NOT NULL,
  pixel_id    TEXT    NOT NULL,
  nx_user     TEXT    NOT NULL,
  account_id  TEXT,

  status      TEXT    NOT NULL DEFAULT 'cart',   -- cart | checkout | completed | abandoned
  order_id    TEXT    NOT NULL DEFAULT '',

  -- Valor do carrinho
  value       REAL    NOT NULL DEFAULT 0,
  currency    TEXT    NOT NULL DEFAULT '',
  items       TEXT    NOT NULL DEFAULT '[]',

  -- PII no momento do checkout
  email       TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  firstname   TEXT    NOT NULL DEFAULT '',
  lastname    TEXT    NOT NULL DEFAULT '',
  city        TEXT    NOT NULL DEFAULT '',
  zip         TEXT    NOT NULL DEFAULT '',
  country     TEXT    NOT NULL DEFAULT '',

  -- Device
  ip          TEXT    NOT NULL DEFAULT '',
  user_agent  TEXT    NOT NULL DEFAULT '',

  -- Sinais de atribuição congelados no checkout
  fbp         TEXT    NOT NULL DEFAULT '',
  fbc         TEXT    NOT NULL DEFAULT '',
  fbclid      TEXT    NOT NULL DEFAULT '',
  gclid       TEXT    NOT NULL DEFAULT '',
  ttclid      TEXT    NOT NULL DEFAULT '',
  ttp         TEXT    NOT NULL DEFAULT '',

  -- UTMs last-touch no checkout
  utm_source   TEXT   NOT NULL DEFAULT '',
  utm_medium   TEXT   NOT NULL DEFAULT '',
  utm_campaign TEXT   NOT NULL DEFAULT '',
  utm_content  TEXT   NOT NULL DEFAULT '',
  utm_term     TEXT   NOT NULL DEFAULT '',
  channel      TEXT   NOT NULL DEFAULT '',

  -- Controle
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,  -- created_at + 604800 (7 dias em segundos)

  PRIMARY KEY (token, pixel_id)
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_nx_user   ON checkout_sessions (nx_user, pixel_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order     ON checkout_sessions (order_id, pixel_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status    ON checkout_sessions (nx_user, pixel_id, status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_account   ON checkout_sessions (account_id);
