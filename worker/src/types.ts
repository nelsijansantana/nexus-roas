export interface PersistenceMessage {
  type: 'user_store' | 'user_attribution';
  pixel_id: string;
  account_id?: string;
  nx_user: string;
  user?: Record<string, any>;
  attribution?: Record<string, any>;
}

export interface Env {
  DB: D1Database;
  /** Queue para D1 writes assíncronos — não bloqueia a resposta da edge */
  PERSISTENCE_QUEUE: Queue<PersistenceMessage>;
  /** KV namespace — stores multi-tenant configs.
   *  Keys: `site_config:<pixel_id>`  → SiteConfig JSON
   *        `domain_map:<custom_host>` → pixel_id string
   *        `webhook:<wid>`            → WebhookEndpointConfig JSON
   */
  SITE_CONFIG_KV: KVNamespace;
  /** KV namespace for server-side event deduplication.
   *  Keys: `dedup:{pixel_id}:{event_id}` → TTL 24h */
  KV_DEDUP: KVNamespace;
  /** Cloudflare Queue for async CAPI dispatch (consumed by story 8.5 processor). */
  CAPI_QUEUE?: Queue<Record<string, unknown>>;
  /** Fallback for single-tenant / local dev (wrangler.toml [vars]) */
  SITE_CONFIG?: string;
  META_ACCESS_TOKEN?: string;
  TIKTOK_ACCESS_TOKEN?: string;
  GA4_API_SECRET?: string;
  /** Platform-level Google Ads credentials (shared across all tenants).
   *  Per-project refresh_token and customer_id come from KV SiteConfig.
   *  These are fallbacks so the developer_token/oauth credentials don't
   *  need to be repeated in every project's KV entry. */
  GOOGLE_ADS_CLIENT_ID?: string;
  GOOGLE_ADS_CLIENT_SECRET?: string;
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  NEXUS_ADMIN_SECRET?: string;
}

/**
 * WebhookEndpointConfig — armazenado em KV como `webhook:<wid>`.
 * Criado/atualizado pelo backend quando o usuário configura um webhook endpoint.
 * Determina de forma explícita para quais projetos disparar o CAPI
 * quando uma venda chega via ?wid=<webhook_id>.
 */
export interface WebhookEndpointConfig {
  /** ID único do endpoint — aparece na URL (?wid=) */
  wid:        string;
  /** UUID da conta dona deste endpoint — usado para filtrar user_store */
  account_id: string;
  /** Gateway configurado (hotmart, kiwify, etc.) */
  gateway:    string;
  /** Nome amigável definido pelo usuário ("Hotmart — Produto Principal") */
  name:       string;
  /** pixelIds dos projetos que devem receber o CAPI desta venda */
  site_ids:   string[];
}

export interface SiteConfig {
  pixel_id?: string;
  /** UUID da conta dona deste projeto — usado para isolamento no D1 */
  account_id?: string;
  nexus?: {
    pixel_id: string;
    ingest_url: string;
    ingest_key: string;
  };
  platforms?: {
    meta?: PlatformConfig;
    tiktok?: PlatformConfig;
    ga4?: {
      measurement_id: string;
      api_secret?: string;
    };
    google_ads?: {
      /** AW-XXXXXXXXXX — used in browser gtag send_to */
      conversion_id?: string;
      /** Google Ads customer ID (digits only, no dashes) */
      customer_id?: string;
      /** Developer token from Google Ads → Admin → API Center */
      developer_token?: string;
      /** OAuth2 credentials from Google Cloud Console */
      oauth_client_id?: string;
      oauth_client_secret?: string;
      refresh_token?: string;
      /**
       * Event → conversion action mapping.
       * Keys: canonical event names ("Purchase", "Lead", "Contact", custom names…)
       * label: for browser gtag (AW-XXXX/{label})
       * action_resource: for server-side API (customers/{id}/conversionActions/{id})
       * Both can coexist — browser and server fire simultaneously.
       */
      events?: Record<string, {
        label?: string;
        action_resource?: string;
      }>;
    };
  };
  /** Pixel-event rules — evaluated client-side by NxRuleEngine in pixel.js */
  triggers?: Array<{
    id: string;
    eventName: string;
    triggerType: 'click' | 'form_submit' | 'scroll' | 'time_on_page' | 'pageload';
    selector?: string | null;
    buttonText?: string | null;
    scrollDepth?: number | null;
    timeSeconds?: number | null;
    customData?: Record<string, unknown>;
  }>;
  cookies?: Record<string, string>;
  gateways_config?: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
  debug?: boolean;
}

export interface PlatformConfig {
  pixel_id: string;
  access_token?: string;
  pixel_ids_mirror?: string[];
}

export interface LeadRecord {
  nx_user: string;
  updated_at?: string;
  ip?: string;
  user_agent?: string;
  fbp?: string;
  fbc?: string;
  ttp?: string;
  ttclid?: string;
  ga_client_id?: string;
  ga_session_id?: string;
  ga_session_count?: string;
  ga_timestamp?: string;
  page_url?: string;
  email?: string;
  phone?: string;
  fullname?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  cart_token?: string;
  // UTM / attribution — stored at first touch so webhooks can recover them
  utm_source?:      string;
  utm_medium?:      string;
  utm_campaign?:    string;
  utm_content?:     string;
  utm_term?:        string;
  utm_id?:          string;
  utm_platform?:    string;
  utm_network?:     string;
  ad_id?:           string;
  adset_id?:        string;
  campaign_id?:     string;
  placement?:       string;
  creative_format?: string;
  conversion_type?: string;
}

export interface TrackingEvent {
  event_type: string;
  event_id?: string;
  event_time?: number;
  nx_user: string;
  session_id?: string;
  // Valor
  value?: number;
  currency?: string;
  payment_gateway?: string;
  order_id?: string;
  items?: string;
  // UTMs
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?:    string;
  utm_content?:     string;
  utm_term?:        string;
  utm_id?:          string;
  utm_platform?:    string;
  utm_network?:     string;
  // IDs de campanha
  ad_id?:           string;
  adset_id?:        string;
  campaign_id?:     string;
  placement?:       string;
  creative_format?: string;
  conversion_type?: string;
  // Click IDs
  fbclid?:  string;
  fbc?:     string;
  fbp?:     string;
  gclid?:   string;
  gbraid?:  string;
  wbraid?:  string;
  ttclid?:  string;
  ttp?:     string;
  msclkid?: string;
  twclid?:  string;
  // GA4
  ga_session_id?:     string;
  ga_session_number?: string;
  // Qualidade da identidade
  match_type?: string;
  // Geo + Device
  ip?: string;
  country?: string;
  city?: string;
  state?: string;
  user_agent?: string;
  // Contexto de página
  page_url?: string;
  referrer?: string;
}

export interface WebhookData {
  nx_user: string;
  email?: string;
  phone?: string;
  name?: string;
  order_id?: string;
  value?: string | number;
  currency?: string;
  product_name?: string;
  product_id?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  ip?: string;
  user_agent?: string;
  gateway?: string;
  page_url?: string;
  // UTMs (carried by gateways that include attribution in the webhook payload)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?:    string;
  utm_content?:     string;
  utm_term?:        string;
  utm_id?:          string;
  utm_platform?:    string;
  utm_network?:     string;
  ad_id?:           string;
  adset_id?:        string;
  campaign_id?:     string;
  placement?:       string;
  creative_format?: string;
  conversion_type?: string;
  // Used by CartPanda/Shopify Tier-3 attribution when nx_user is absent
  cart_token?: string;
  // Event type — gateways can set this to 'Lead', 'Contact', etc. Defaults to 'Purchase'.
  event_name?: string;
  // Click IDs captured by the pixel link-decorator and stored in gateway metadata
  // (e.g. Shopify note_attributes, Greenn saleMetas, Yampi metadata array)
  fbclid?:  string;
  fbc?:     string;
  fbp?:     string;
  gclid?:   string;
  gbraid?:  string;
  wbraid?:  string;
  ttclid?:  string;
  ttp?:     string;
  msclkid?: string;
  twclid?:  string;
  // GA4 client ID (Yampi metadata _ga)
  ga_client_id?: string;
}
