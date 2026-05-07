-- capi_log: auditoria de despacho CAPI separada do webhook_raw.
-- Permite consultar cobertura por plataforma e depurar falhas sem
-- misturar com o log bruto de webhooks.
-- Status: -1=não configurado, 0=falhou, 1=ok
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
