import { LeadRecord, WebhookData } from '../types';
import { firstDefined } from '../shared/helpers';

/**
 * fdvMerge — Merges data from the D1 store (browser) with the incoming Webhook data (gateway).
 * 
 * Prioritizes Store (browser) for identity/attribution and Webhook for transaction details.
 */
export function fdvMerge(storeData: LeadRecord | null, webhookData: any): any {
  const store: Partial<LeadRecord> = storeData || {};

  return {
    // Identity & Attribution: Store takes priority (real user beacon)
    email:            firstDefined(store.email, webhookData.email),
    phone:            firstDefined(store.phone, webhookData.phone),
    fullname:         firstDefined(store.fullname, webhookData.name),
    ip:               firstDefined(store.ip, webhookData.ip),
    user_agent:       firstDefined(store.user_agent, webhookData.user_agent),
    city:             firstDefined(store.city, webhookData.city),
    state:            firstDefined(store.state, webhookData.state),
    country:          firstDefined(store.country, webhookData.country),
    zip:              firstDefined(webhookData.zip, store.zip),

    // Browser/Session identifiers: ALWAYS from store
    fbp:              store.fbp || '',
    fbc:              store.fbc || '',
    ttp:              store.ttp || '',
    ttclid:           store.ttclid || webhookData.ttclid || '',
    ga_client_id:     store.ga_client_id     || webhookData.ga_client_id || '',
    ga_session_id:    store.ga_session_id    || '',
    ga_session_count: store.ga_session_count || '',
    ga_timestamp:     store.ga_timestamp     || '',
    page_url:         store.page_url || '',
    nx_user:          store.nx_user || webhookData.nx_user,

    // Raw click IDs — gateway parsers extract from note_attributes/metadata/saleMetas.
    // Supplemented by attribution recovery in webhook.ts before fdvMerge is called.
    fbclid:  webhookData.fbclid  || '',
    gclid:   webhookData.gclid   || '',
    gbraid:  webhookData.gbraid  || '',
    wbraid:  webhookData.wbraid  || '',
    msclkid: webhookData.msclkid || '',
    twclid:  webhookData.twclid  || '',

    // Transaction Data: ALWAYS from webhook
    order_id:         webhookData.order_id,
    value:            webhookData.value,
    currency:         webhookData.currency || 'BRL',
    product_name:     webhookData.product_name,
    product_id:       webhookData.product_id,
    gateway:          webhookData.gateway,

    // UTM / Attribution: Store takes priority (first-touch from browser session).
    // CartPanda exposes UTMs via tracking_parameters (parsed into webhookData).
    // Store takes priority because it captures the true first-touch; webhook UTMs are the fallback.
    utm_source:      firstDefined(store.utm_source,      webhookData.utm_source),
    utm_medium:      firstDefined(store.utm_medium,      webhookData.utm_medium),
    utm_campaign:    firstDefined(store.utm_campaign,    webhookData.utm_campaign),
    utm_content:     firstDefined(store.utm_content,     webhookData.utm_content),
    utm_term:        firstDefined(store.utm_term,        webhookData.utm_term),
    utm_id:          firstDefined(store.utm_id,          webhookData.utm_id),
    utm_platform:    firstDefined(store.utm_platform,    webhookData.utm_platform),
    utm_network:     firstDefined(store.utm_network,     webhookData.utm_network),
    ad_id:           firstDefined(store.ad_id,           webhookData.ad_id),
    adset_id:        firstDefined(store.adset_id,        webhookData.adset_id),
    campaign_id:     firstDefined(store.campaign_id,     webhookData.campaign_id),
    placement:       firstDefined(store.placement,       webhookData.placement),
    creative_format: firstDefined(store.creative_format, webhookData.creative_format),
    conversion_type: firstDefined(store.conversion_type, webhookData.conversion_type),
  };
}
