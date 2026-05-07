import { Env, SiteConfig, TrackingEvent } from './types';

/**
 * forwardToNexus — Envia dados analíticos para o ingest API do Nexus ROAS.
 * Inclui todos os campos disponíveis na edge: click IDs, cookies de plataforma,
 * dados de atribuição e metadados de identidade.
 * Single attempt — tracking é best-effort; retries com sleep bloqueariam o isolate.
 */
export async function forwardToNexus(env: Env, config: SiteConfig, data: TrackingEvent): Promise<void> {
  const nexus = config?.nexus;
  if (!nexus?.pixel_id || !nexus?.ingest_url || !nexus?.ingest_key) return;

  const payload = JSON.stringify(
    Object.fromEntries(Object.entries({
      pixel_id:          nexus.pixel_id,
      event_name:        data.event_type,
      event_type:        data.event_type,   // alias legado
      event_id:          data.event_id,
      event_time:        data.event_time || Math.floor(Date.now() / 1000),
      nx_user:           data.nx_user,
      lead_id:           data.nx_user,      // alias legado
      session_id:        data.session_id,
      // Valor
      value:             data.value,
      currency:          data.currency || 'BRL',
      order_id:          data.order_id,
      gateway:           data.payment_gateway,
      payment_gateway:   data.payment_gateway,  // alias legado
      items:             data.items,
      // UTMs
      utm_source:        data.utm_source,
      utm_medium:        data.utm_medium,
      utm_campaign:      data.utm_campaign,
      utm_content:       data.utm_content,
      utm_term:          data.utm_term,
      utm_id:            data.utm_id,
      utm_platform:      data.utm_platform,
      utm_network:       data.utm_network,
      // IDs de campanha
      ad_id:             data.ad_id,
      adset_id:          data.adset_id,
      campaign_id:       data.campaign_id,
      placement:         data.placement,
      creative_format:   data.creative_format,
      conversion_type:   data.conversion_type,
      // Click IDs — browser é a fonte mais confiável
      fbclid:            data.fbclid,
      fbc:               data.fbc,
      fbp:               data.fbp,
      gclid:             data.gclid,
      gbraid:            data.gbraid,
      wbraid:            data.wbraid,
      ttclid:            data.ttclid,
      ttp:               data.ttp,
      msclkid:           data.msclkid,
      twclid:            data.twclid,
      // GA4
      ga_session_id:     data.ga_session_id,
      ga_session_number: data.ga_session_number,
      // Qualidade da identidade
      match_type:        data.match_type,
      // Geo + Device
      ip:                data.ip,
      country:           data.country,
      region:            data.state,
      city:              data.city,
      state:             data.state,        // alias legado
      user_agent:        data.user_agent,
      // Contexto de página
      page_url:          data.page_url,
      referrer:          data.referrer,
    }).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  );

  try {
    const res = await fetch(nexus.ingest_url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ingest-Key': nexus.ingest_key },
      body:    payload,
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[nexus] ingest ${res.status}: ${text.substring(0, 200)}`);
    }
  } catch (e: any) {
    console.warn('[nexus] ingest error:', e?.message || String(e));
  }
}
