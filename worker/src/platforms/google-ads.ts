import { logEvent } from '../shared/logger';
import { Env } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GoogleAdsEventConfig {
  /** Browser gtag: AW-XXXXXXXXXX/{label} — used when channel is 'browser' */
  label?: string;
  /**
   * Server-side API: full resource name
   * Format: "customers/{customer_id}/conversionActions/{conversion_action_id}"
   * Get it from: Google Ads → Conversions → [action] → the numeric ID in the URL
   */
  action_resource?: string;
}

export interface GoogleAdsConfig {
  /** AW-XXXXXXXXXX — used in browser gtag send_to */
  conversion_id?: string;
  /** Google Ads customer ID — digits only (no dashes) */
  customer_id?: string;
  /** Developer token from Google Ads → Admin → API Center */
  developer_token?: string;
  /** OAuth2 credentials — obtained via Google Cloud Console */
  oauth_client_id?: string;
  oauth_client_secret?: string;
  refresh_token?: string;
  /**
   * Event name → conversion config.
   * Keys are the canonical event names sent by pixel/webhooks (e.g. "Purchase", "Lead", "Contact").
   * If a key is missing, the event is not sent to Google Ads.
   * Example:
   *   "Purchase": { "label": "AbCdEfGh", "action_resource": "customers/123/conversionActions/456" }
   *   "Lead":     { "label": "IjKlMnOp", "action_resource": "customers/123/conversionActions/789" }
   */
  events?: Record<string, GoogleAdsEventConfig>;
}

export interface GoogleAdsEventData {
  value?:      number | string;
  currency?:   string;
  order_id?:   string;
  event_time?: number;
  nx_user?:    string;
  ip?:         string;
  user_agent?: string;
  gateway?:    string;
  // Click IDs for conversion attribution
  gclid?:      string;
  gbraid?:     string;
  wbraid?:     string;
}

// ── Access token cache (per Worker instance — survives across requests) ────────

let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Resolves OAuth credentials with env-level fallback.
 * Priority: per-project KV config > platform-level Worker env vars.
 * This means developer_token and oauth client_id/secret only need to be
 * configured once as Worker secrets, not repeated in every project's KV entry.
 */
async function getAccessToken(config: GoogleAdsConfig, env: Env): Promise<string | null> {
  const clientId     = config.oauth_client_id     || env.GOOGLE_ADS_CLIENT_ID     || '';
  const clientSecret = config.oauth_client_secret  || env.GOOGLE_ADS_CLIENT_SECRET  || '';
  const refreshToken = config.refresh_token || '';

  if (!clientId || !clientSecret || !refreshToken) return null;

  // Return cached token if still fresh (60s safety buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });

    if (!res.ok) {
      console.error('[google-ads] token refresh failed:', res.status, await res.text());
      return null;
    }

    const data: any = await res.json();
    if (!data.access_token) return null;

    tokenCache = {
      token:     data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
    return tokenCache.token;
  } catch (e: any) {
    console.error('[google-ads] token refresh error:', e?.message);
    return null;
  }
}

// ── Main conversion sender ─────────────────────────────────────────────────────

/**
 * sendGoogleAdsConversion — sends a conversion to Google Ads.
 *
 * Works for both beacon events (from pixel) and webhook purchase events.
 *
 * Two modes:
 *   - Server mode: OAuth2 credentials present → Google Ads Conversions API v19
 *   - Browser mode: no credentials → logs "web-only" (gtag in browser handles it)
 *
 * The event must be present in config.events to be dispatched.
 * This allows per-project control over which events go to Google Ads.
 */
export async function sendGoogleAdsConversion(
  config: GoogleAdsConfig,
  eventName: string,
  hashed: {
    email?:       string;
    phone?:       string;
    first_name?:  string;
    last_name?:   string;
    zip?:         string;
    country?:     string;
    external_id?: string;
  },
  eventData: GoogleAdsEventData,
  env: Env,
  siteId: string,
): Promise<void> {
  const eventConfig = config.events?.[eventName];
  if (!eventConfig) return; // not configured for this event

  const source  = eventData.gateway || 'collect';
  // Resolve credentials — per-project config takes priority, env vars are fallback
  const clientId     = config.oauth_client_id     || env.GOOGLE_ADS_CLIENT_ID     || '';
  const clientSecret = config.oauth_client_secret  || env.GOOGLE_ADS_CLIENT_SECRET  || '';
  const devToken     = config.developer_token      || env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  const hasAuth = !!(clientId && clientSecret && config.refresh_token);

  // ── Browser-only mode ──────────────────────────────────────────────────────
  // No server credentials — browser gtag handles the conversion.
  // We still log so the dashboard shows the event.
  if (!hasAuth) {
    await logEvent(env.DB, {
      site_id:       siteId,
      event_name:    eventName,
      platform:      'google_ads',
      channel:       'web',
      source,
      status_code:   200,
      error_message: 'web-only: dispatched via gtag in browser',
      nx_user:       eventData.nx_user || '',
    });
    return;
  }

  // ── Server mode — requires action_resource + customer_id + developer_token ──
  if (!eventConfig.action_resource) {
    await logEvent(env.DB, {
      site_id:       siteId,
      event_name:    eventName,
      platform:      'google_ads',
      channel:       'server',
      source,
      status_code:   0,
      error_message: 'missing_action_resource: configure action_resource for this event',
      nx_user:       eventData.nx_user || '',
    });
    return;
  }

  if (!config.customer_id || !devToken) {
    await logEvent(env.DB, {
      site_id:       siteId,
      event_name:    eventName,
      platform:      'google_ads',
      channel:       'server',
      source,
      status_code:   0,
      error_message: 'missing_config: customer_id or developer_token not set',
      nx_user:       eventData.nx_user || '',
    });
    return;
  }

  const accessToken = await getAccessToken(config, env);
  if (!accessToken) {
    await logEvent(env.DB, {
      site_id:       siteId,
      event_name:    eventName,
      platform:      'google_ads',
      channel:       'server',
      source,
      status_code:   401,
      error_message: 'oauth_token_refresh_failed',
      nx_user:       eventData.nx_user || '',
    });
    return;
  }

  const customerId          = config.customer_id.replace(/-/g, '');
  const conversionDateTime  = formatConversionDateTime(eventData.event_time);
  const value               = parseFloat(String(eventData.value ?? 0)) || 0;

  const conversion: any = {
    conversionAction:  eventConfig.action_resource,
    conversionDateTime,
    ...(value > 0 ? { conversionValue: value, currencyCode: eventData.currency || 'BRL' } : {}),
    ...(eventData.order_id ? { orderId: String(eventData.order_id) } : {}),
    // Click IDs for cross-device attribution — let Google Ads match against ad clicks
    ...(eventData.gclid  ? { gclid:  eventData.gclid  } : {}),
    ...(eventData.gbraid ? { gbraid: eventData.gbraid } : {}),
    ...(eventData.wbraid ? { wbraid: eventData.wbraid } : {}),
  };

  // Enhanced conversions — hashed user identifiers for server-to-ad matching.
  // Google Ads matches these against the original ad click for attribution.
  const userIdentifiers: any[] = [];
  if (hashed.email) {
    userIdentifiers.push({ hashedEmail: hashed.email });
  }
  if (hashed.phone) {
    userIdentifiers.push({ hashedPhoneNumber: hashed.phone });
  }
  // Address info — improves match rate for users without click IDs
  if (hashed.first_name || hashed.last_name || hashed.zip || hashed.country) {
    const addressInfo: any = {};
    if (hashed.first_name) addressInfo.hashedFirstName = hashed.first_name;
    if (hashed.last_name)  addressInfo.hashedLastName  = hashed.last_name;
    if (hashed.zip)        addressInfo.postalCode      = hashed.zip;
    if (hashed.country)    addressInfo.countryCode     = hashed.country.toUpperCase().substring(0, 2);
    userIdentifiers.push({ addressInfo });
  }
  if (userIdentifiers.length > 0) {
    conversion.hashedUserIdentifiers = userIdentifiers;
  }

  const payload = {
    conversions:    [conversion],
    partialFailure: true,
  };

  const start = Date.now();
  const url   = `https://googleads.googleapis.com/v19/customers/${customerId}:uploadConversions`;

  try {
    const res          = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization':   `Bearer ${accessToken}`,
        'developer-token': devToken,
        'Content-Type':    'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();

    // Detect partial failures (API returns 200 with partialFailureError)
    let errorMsg = '';
    if (!res.ok) {
      errorMsg = `api_error_${res.status}`;
    } else {
      try {
        const parsed: any = JSON.parse(responseText);
        if (parsed.partialFailureError) {
          errorMsg = `partial_failure: ${JSON.stringify(parsed.partialFailureError).substring(0, 200)}`;
        }
      } catch (_) {}
    }

    await logEvent(env.DB, {
      site_id:          siteId,
      event_name:       eventName,
      platform:         'google_ads',
      channel:          'server',
      source,
      status_code:      res.ok ? 200 : res.status,
      request_ms:       Date.now() - start,
      sent_payload:     JSON.stringify(payload),
      response_payload: responseText.substring(0, 500),
      error_message:    errorMsg,
      nx_user:          eventData.nx_user || '',
      source_ip:        eventData.ip      || '',
      user_agent:       eventData.user_agent || '',
    });
  } catch (e: any) {
    await logEvent(env.DB, {
      site_id:       siteId,
      event_name:    eventName,
      platform:      'google_ads',
      channel:       'server',
      source,
      status_code:   0,
      request_ms:    Date.now() - start,
      error_message: e?.message || String(e),
      nx_user:       eventData.nx_user || '',
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format UTC datetime for Google Ads API: "YYYY-MM-DD HH:MM:SS+00:00" */
function formatConversionDateTime(eventTime?: number): string {
  const d   = eventTime ? new Date(eventTime * 1000) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}
