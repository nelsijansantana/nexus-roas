-- cart_links: ponte entre token de carrinho e nx_user.
-- Resolve identidade cross-gateway e cross-domínio (ex: checkout.shopify.com).
-- (token, token_type, pixel_id) como PK suporta qualquer plataforma de checkout.
CREATE TABLE IF NOT EXISTS cart_links (
  token       TEXT    NOT NULL,               -- valor do token (cart_token, checkout_token, etc.)
  token_type  TEXT    NOT NULL,               -- 'shopify' | 'cartpanda' | 'checkout'
  pixel_id    TEXT    NOT NULL,
  nx_user     TEXT    NOT NULL,
  account_id  TEXT,
  created_at  INTEGER NOT NULL,

  PRIMARY KEY (token, token_type, pixel_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_links_nx_user  ON cart_links (nx_user, pixel_id);
CREATE INDEX IF NOT EXISTS idx_cart_links_account  ON cart_links (account_id);
