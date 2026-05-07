import { LeadRecord } from '../types';

/**
 * Returns true when the record carries at least one identity field worth
 * persisting. Prevents a D1 write on every PageView / _update beacon that
 * carries no new data beyond page_url, ip or session counters.
 */
export function hasIdentityData(data: LeadRecord): boolean {
  return !!(
    data.email        ||
    data.phone        ||
    data.fullname     ||
    data.fbp          ||
    data.fbc          ||
    data.ttp          ||
    data.ttclid       ||
    data.ga_client_id ||
    data.ga_session_id ||
    data.cart_token
  );
}

export async function upsertUserStore(db: D1Database, data: LeadRecord): Promise<void> {
  const stmt = db.prepare(`
    INSERT INTO user_store (nx_user, ip, user_agent, fbp, fbc, ttp, ttclid,
      ga_client_id, ga_session_id, ga_session_count, ga_timestamp,
      page_url, email, phone, fullname, city, state, country, zip, cart_token,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id,
      utm_platform, utm_network, ad_id, adset_id, campaign_id,
      placement, creative_format, conversion_type)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20,
            ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34)
    ON CONFLICT(nx_user) DO UPDATE SET
      updated_at       = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      -- IMMUTABLE once set: browser fingerprint + attribution (first-touch wins)
      ip               = COALESCE(NULLIF(user_store.ip, ''),               excluded.ip),
      user_agent       = COALESCE(NULLIF(user_store.user_agent, ''),       excluded.user_agent),
      fbp              = COALESCE(NULLIF(user_store.fbp, ''),              excluded.fbp),
      fbc              = COALESCE(NULLIF(user_store.fbc, ''),              excluded.fbc),
      ttp              = COALESCE(NULLIF(user_store.ttp, ''),              excluded.ttp),
      ttclid           = COALESCE(NULLIF(user_store.ttclid, ''),           excluded.ttclid),
      ga_client_id     = COALESCE(NULLIF(user_store.ga_client_id, ''),     excluded.ga_client_id),
      -- IMMUTABLE once set: PII (gateway data is less reliable than first beacon)
      email            = COALESCE(NULLIF(user_store.email, ''),            excluded.email),
      phone            = COALESCE(NULLIF(user_store.phone, ''),            excluded.phone),
      fullname         = COALESCE(NULLIF(user_store.fullname, ''),         excluded.fullname),
      city             = COALESCE(NULLIF(user_store.city, ''),             excluded.city),
      state            = COALESCE(NULLIF(user_store.state, ''),            excluded.state),
      country          = COALESCE(NULLIF(user_store.country, ''),          excluded.country),
      zip              = COALESCE(NULLIF(user_store.zip, ''),              excluded.zip),
      -- IMMUTABLE once set: first-touch UTM attribution
      utm_source       = COALESCE(NULLIF(user_store.utm_source, ''),       excluded.utm_source),
      utm_medium       = COALESCE(NULLIF(user_store.utm_medium, ''),       excluded.utm_medium),
      utm_campaign     = COALESCE(NULLIF(user_store.utm_campaign, ''),     excluded.utm_campaign),
      utm_content      = COALESCE(NULLIF(user_store.utm_content, ''),      excluded.utm_content),
      utm_term         = COALESCE(NULLIF(user_store.utm_term, ''),         excluded.utm_term),
      utm_id           = COALESCE(NULLIF(user_store.utm_id, ''),           excluded.utm_id),
      utm_platform     = COALESCE(NULLIF(user_store.utm_platform, ''),     excluded.utm_platform),
      utm_network      = COALESCE(NULLIF(user_store.utm_network, ''),      excluded.utm_network),
      ad_id            = COALESCE(NULLIF(user_store.ad_id, ''),            excluded.ad_id),
      adset_id         = COALESCE(NULLIF(user_store.adset_id, ''),         excluded.adset_id),
      campaign_id      = COALESCE(NULLIF(user_store.campaign_id, ''),      excluded.campaign_id),
      placement        = COALESCE(NULLIF(user_store.placement, ''),        excluded.placement),
      creative_format  = COALESCE(NULLIF(user_store.creative_format, ''),  excluded.creative_format),
      conversion_type  = COALESCE(NULLIF(user_store.conversion_type, ''),  excluded.conversion_type),
      -- MUTABLE: session data always reflects the latest active session
      ga_session_id    = CASE WHEN excluded.ga_session_id    != '' THEN excluded.ga_session_id    ELSE user_store.ga_session_id    END,
      ga_session_count = CASE WHEN excluded.ga_session_count != '' THEN excluded.ga_session_count ELSE user_store.ga_session_count END,
      ga_timestamp     = CASE WHEN excluded.ga_timestamp     != '' THEN excluded.ga_timestamp     ELSE user_store.ga_timestamp     END,
      page_url         = CASE WHEN excluded.page_url         != '' THEN excluded.page_url         ELSE user_store.page_url         END,
      -- MUTABLE: latest cart token (needed for tier-3 attribution of the current order)
      cart_token       = CASE WHEN excluded.cart_token       != '' THEN excluded.cart_token       ELSE user_store.cart_token       END
  `);

  await stmt.bind(
    data.nx_user,
    data.ip ?? '',
    data.user_agent ?? '',
    data.fbp ?? '',
    data.fbc ?? '',
    data.ttp ?? '',
    data.ttclid ?? '',
    data.ga_client_id ?? '',
    data.ga_session_id ?? '',
    data.ga_session_count ?? '',
    data.ga_timestamp ?? '',
    data.page_url ?? '',
    data.email ?? '',
    data.phone ?? '',
    data.fullname ?? '',
    data.city ?? '',
    data.state ?? '',
    data.country ?? '',
    data.zip ?? '',
    data.cart_token ?? '',
    data.utm_source      ?? '',
    data.utm_medium      ?? '',
    data.utm_campaign    ?? '',
    data.utm_content     ?? '',
    data.utm_term        ?? '',
    data.utm_id          ?? '',
    data.utm_platform    ?? '',
    data.utm_network     ?? '',
    data.ad_id           ?? '',
    data.adset_id        ?? '',
    data.campaign_id     ?? '',
    data.placement       ?? '',
    data.creative_format ?? '',
    data.conversion_type ?? '',
  ).run();
}

export async function getUserStore(db: D1Database, nxUser: string): Promise<LeadRecord | null> {
  return await db.prepare('SELECT * FROM user_store WHERE nx_user = ?').bind(nxUser).first<LeadRecord>();
}

/** Tier-3 fallback: look up user by cart_token (CartPanda attribution window ~48h). */
export async function getUserStoreByCartToken(db: D1Database, cartToken: string): Promise<LeadRecord | null> {
  return await db.prepare(
    'SELECT * FROM user_store WHERE cart_token = ? ORDER BY updated_at DESC LIMIT 1'
  ).bind(cartToken).first<LeadRecord>();
}

// ─── Account-scoped lookups (rota ?aid= — isolamento multi-tenant) ────────────

/**
 * Lookup de identidade filtrado por conta.
 * Garante que dados de uma conta nunca cruzam com outra.
 */
export async function getUserStoreByAccount(
  db: D1Database,
  accountId: string,
  nxUser: string
): Promise<LeadRecord | null> {
  return await db.prepare(
    'SELECT * FROM user_store WHERE account_id = ? AND nx_user = ?'
  ).bind(accountId, nxUser).first<LeadRecord>();
}

/**
 * Tier-3 fallback por cart_token, filtrado por conta.
 */
export async function getUserStoreByCartTokenAndAccount(
  db: D1Database,
  accountId: string,
  cartToken: string
): Promise<LeadRecord | null> {
  return await db.prepare(
    'SELECT * FROM user_store WHERE account_id = ? AND cart_token = ? ORDER BY updated_at DESC LIMIT 1'
  ).bind(accountId, cartToken).first<LeadRecord>();
}

/**
 * Upsert com account_id explícito.
 * Idêntico ao upsertUserStore mas inclui account_id na gravação,
 * permitindo lookups isolados por conta futuramente.
 */
export async function upsertUserStoreWithAccount(
  db: D1Database,
  data: LeadRecord,
  accountId: string
): Promise<void> {
  const stmt = db.prepare(`
    INSERT INTO user_store (account_id, nx_user, ip, user_agent, fbp, fbc, ttp, ttclid,
      ga_client_id, ga_session_id, ga_session_count, ga_timestamp,
      page_url, email, phone, fullname, city, state, country, zip, cart_token,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id,
      utm_platform, utm_network, ad_id, adset_id, campaign_id,
      placement, creative_format, conversion_type)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21,
            ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35)
    ON CONFLICT(nx_user) DO UPDATE SET
      updated_at       = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      account_id       = CASE WHEN excluded.account_id != '' THEN excluded.account_id ELSE user_store.account_id END,
      -- IMMUTABLE once set: browser fingerprint + attribution (first-touch wins)
      ip               = COALESCE(NULLIF(user_store.ip, ''),               excluded.ip),
      user_agent       = COALESCE(NULLIF(user_store.user_agent, ''),       excluded.user_agent),
      fbp              = COALESCE(NULLIF(user_store.fbp, ''),              excluded.fbp),
      fbc              = COALESCE(NULLIF(user_store.fbc, ''),              excluded.fbc),
      ttp              = COALESCE(NULLIF(user_store.ttp, ''),              excluded.ttp),
      ttclid           = COALESCE(NULLIF(user_store.ttclid, ''),           excluded.ttclid),
      ga_client_id     = COALESCE(NULLIF(user_store.ga_client_id, ''),     excluded.ga_client_id),
      -- IMMUTABLE once set: PII (gateway data is less reliable than first beacon)
      email            = COALESCE(NULLIF(user_store.email, ''),            excluded.email),
      phone            = COALESCE(NULLIF(user_store.phone, ''),            excluded.phone),
      fullname         = COALESCE(NULLIF(user_store.fullname, ''),         excluded.fullname),
      city             = COALESCE(NULLIF(user_store.city, ''),             excluded.city),
      state            = COALESCE(NULLIF(user_store.state, ''),            excluded.state),
      country          = COALESCE(NULLIF(user_store.country, ''),          excluded.country),
      zip              = COALESCE(NULLIF(user_store.zip, ''),              excluded.zip),
      -- IMMUTABLE once set: first-touch UTM attribution
      utm_source       = COALESCE(NULLIF(user_store.utm_source, ''),       excluded.utm_source),
      utm_medium       = COALESCE(NULLIF(user_store.utm_medium, ''),       excluded.utm_medium),
      utm_campaign     = COALESCE(NULLIF(user_store.utm_campaign, ''),     excluded.utm_campaign),
      utm_content      = COALESCE(NULLIF(user_store.utm_content, ''),      excluded.utm_content),
      utm_term         = COALESCE(NULLIF(user_store.utm_term, ''),         excluded.utm_term),
      utm_id           = COALESCE(NULLIF(user_store.utm_id, ''),           excluded.utm_id),
      utm_platform     = COALESCE(NULLIF(user_store.utm_platform, ''),     excluded.utm_platform),
      utm_network      = COALESCE(NULLIF(user_store.utm_network, ''),      excluded.utm_network),
      ad_id            = COALESCE(NULLIF(user_store.ad_id, ''),            excluded.ad_id),
      adset_id         = COALESCE(NULLIF(user_store.adset_id, ''),         excluded.adset_id),
      campaign_id      = COALESCE(NULLIF(user_store.campaign_id, ''),      excluded.campaign_id),
      placement        = COALESCE(NULLIF(user_store.placement, ''),        excluded.placement),
      creative_format  = COALESCE(NULLIF(user_store.creative_format, ''),  excluded.creative_format),
      conversion_type  = COALESCE(NULLIF(user_store.conversion_type, ''),  excluded.conversion_type),
      -- MUTABLE: session data always reflects the latest active session
      ga_session_id    = CASE WHEN excluded.ga_session_id    != '' THEN excluded.ga_session_id    ELSE user_store.ga_session_id    END,
      ga_session_count = CASE WHEN excluded.ga_session_count != '' THEN excluded.ga_session_count ELSE user_store.ga_session_count END,
      ga_timestamp     = CASE WHEN excluded.ga_timestamp     != '' THEN excluded.ga_timestamp     ELSE user_store.ga_timestamp     END,
      page_url         = CASE WHEN excluded.page_url         != '' THEN excluded.page_url         ELSE user_store.page_url         END,
      -- MUTABLE: latest cart token (needed for tier-3 attribution of the current order)
      cart_token       = CASE WHEN excluded.cart_token       != '' THEN excluded.cart_token       ELSE user_store.cart_token       END
  `);

  await stmt.bind(
    accountId,
    data.nx_user,
    data.ip ?? '',
    data.user_agent ?? '',
    data.fbp ?? '',
    data.fbc ?? '',
    data.ttp ?? '',
    data.ttclid ?? '',
    data.ga_client_id ?? '',
    data.ga_session_id ?? '',
    data.ga_session_count ?? '',
    data.ga_timestamp ?? '',
    data.page_url ?? '',
    data.email ?? '',
    data.phone ?? '',
    data.fullname ?? '',
    data.city ?? '',
    data.state ?? '',
    data.country ?? '',
    data.zip ?? '',
    data.cart_token ?? '',
    data.utm_source      ?? '',
    data.utm_medium      ?? '',
    data.utm_campaign    ?? '',
    data.utm_content     ?? '',
    data.utm_term        ?? '',
    data.utm_id          ?? '',
    data.utm_platform    ?? '',
    data.utm_network     ?? '',
    data.ad_id           ?? '',
    data.adset_id        ?? '',
    data.campaign_id     ?? '',
    data.placement       ?? '',
    data.creative_format ?? '',
    data.conversion_type ?? '',
  ).run();
}
