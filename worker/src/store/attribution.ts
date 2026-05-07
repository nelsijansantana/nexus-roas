/**
 * Attribution Service — last-touch click ID recovery (30-day window).
 *
 * Unlike user_store (first-touch / COALESCE), this table stores the LAST
 * non-empty click ID per type so webhook handlers can recover click IDs
 * even when the gateway payload doesn't include them.
 *
 * Low Cloudflare cost: 1 write per browser event with click IDs,
 * 1 read per webhook to recover attribution. No KV involved.
 */

export interface AttributionRecord {
  nx_user:    string;
  pixel_id:   string;
  fbclid:     string;
  fbc:        string;
  gclid:      string;
  gbraid:     string;
  wbraid:     string;
  ttclid:     string;
  msclkid:    string;
  twclid:     string;
  updated_at: number; // Unix ms
}

/** Returns last-touch click IDs for a user if updated within windowDays. */
export async function getLastClickIds(
  db: D1Database,
  nxUser: string,
  pixelId: string,
  windowDays = 30
): Promise<Pick<AttributionRecord, 'fbclid'|'fbc'|'gclid'|'gbraid'|'wbraid'|'ttclid'|'msclkid'|'twclid'> | null> {
  const cutoff = Date.now() - windowDays * 86_400_000;
  return db.prepare(
    `SELECT fbclid, fbc, gclid, gbraid, wbraid, ttclid, msclkid, twclid
     FROM user_attribution
     WHERE nx_user = ? AND pixel_id = ? AND updated_at > ?`
  ).bind(nxUser, pixelId, cutoff)
   .first<Pick<AttributionRecord, 'fbclid'|'fbc'|'gclid'|'gbraid'|'wbraid'|'ttclid'|'msclkid'|'twclid'>>();
}

/**
 * Upsert attribution — last non-empty wins per click ID field.
 * If a field is empty in the new record, the existing value is preserved.
 * Only writes when at least one click ID is non-empty.
 */
export async function upsertAttribution(
  db: D1Database,
  data: AttributionRecord
): Promise<void> {
  const hasAny =
    data.fbclid || data.fbc || data.gclid || data.gbraid ||
    data.wbraid  || data.ttclid || data.msclkid || data.twclid;
  if (!hasAny) return;

  await db.prepare(`
    INSERT INTO user_attribution
      (nx_user, pixel_id, fbclid, fbc, gclid, gbraid, wbraid, ttclid, msclkid, twclid, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(nx_user, pixel_id) DO UPDATE SET
      updated_at = excluded.updated_at,
      fbclid  = CASE WHEN excluded.fbclid  != '' THEN excluded.fbclid  ELSE user_attribution.fbclid  END,
      fbc     = CASE WHEN excluded.fbc     != '' THEN excluded.fbc     ELSE user_attribution.fbc     END,
      gclid   = CASE WHEN excluded.gclid   != '' THEN excluded.gclid   ELSE user_attribution.gclid   END,
      gbraid  = CASE WHEN excluded.gbraid  != '' THEN excluded.gbraid  ELSE user_attribution.gbraid  END,
      wbraid  = CASE WHEN excluded.wbraid  != '' THEN excluded.wbraid  ELSE user_attribution.wbraid  END,
      ttclid  = CASE WHEN excluded.ttclid  != '' THEN excluded.ttclid  ELSE user_attribution.ttclid  END,
      msclkid = CASE WHEN excluded.msclkid != '' THEN excluded.msclkid ELSE user_attribution.msclkid END,
      twclid  = CASE WHEN excluded.twclid  != '' THEN excluded.twclid  ELSE user_attribution.twclid  END
  `).bind(
    data.nx_user, data.pixel_id,
    data.fbclid  || '',
    data.fbc     || '',
    data.gclid   || '',
    data.gbraid  || '',
    data.wbraid  || '',
    data.ttclid  || '',
    data.msclkid || '',
    data.twclid  || '',
    data.updated_at
  ).run();
}
