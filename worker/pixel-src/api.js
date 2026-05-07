/**
 * api.js — Envia eventos para o Cloudflare Worker (/collect/event).
 * Monta o payload com dados geo, UTM, click IDs e dados de sessão GA4.
 */
import { NX_USER, COLLECT_URL, META_TEST_EVENT_CODE, TIKTOK_TEST_EVENT_CODE } from './config.js';
import { NxUtils }               from './utils.js';
import { NxGeo }                 from './geo.js';
import { NxUtm, UTM_FIELDS }     from './utm.js';
import { NxClickIds }            from './click-ids.js';
import { NxGA4 }                 from './ga4.js';

export const NxApi = {
  sendEvent(eventType, eventId, customData) {
    const clickIds = NxClickIds.collect();
    const geo      = NxGeo._data;
    const utms     = NxUtm.get() || {};
    const session  = NxGA4.getSessionData();

    const utmData = {};
    UTM_FIELDS.forEach(k => {
      if (utms[k]) utmData[k] = utms[k];
    });

    const body = {
      event:          eventType,
      event_id:       eventId,
      nx_user:        NX_USER,
      page_url:       window.location.href.split('?')[0],
      page_title:     document.title     || undefined,
      page_referrer:  document.referrer  || undefined,

      user_data: {
        city:    NxUtils.sanitize(geo.city)    || undefined,
        state:   NxUtils.sanitize(geo.region)  || undefined,
        country: NxUtils.sanitize(geo.country) || undefined,
        zip:     NxUtils.sanitize(geo.postal)  || undefined,
      },

      browser_data: {
        fbclid:           NxUtils.sanitize(clickIds.fbclid)  || undefined,
        fbc:              NxUtils.sanitize(clickIds.fbc)     || undefined,
        fbp:              NxUtils.sanitize(clickIds.fbp)     || undefined,
        ttclid:           NxUtils.sanitize(clickIds.ttclid)  || undefined,
        ttp:              NxUtils.sanitize(clickIds.ttp)     || undefined,
        gclid:            NxUtils.sanitize(clickIds.gclid)   || undefined,
        gbraid:           NxUtils.sanitize(clickIds.gbraid)  || undefined,
        wbraid:           NxUtils.sanitize(clickIds.wbraid)  || undefined,
        msclkid:          NxUtils.sanitize(clickIds.msclkid) || undefined,
        twclid:           NxUtils.sanitize(clickIds.twclid)  || undefined,
        ga_client_id:     NxGA4.getClientId()      || undefined,
        ga_session_id:    session.session_id       || undefined,
        ga_session_count: session.session_count    || undefined,
        ga_timestamp:     session.timestamp        || undefined,
        // Prefer CartPanda's "cart_token" cookie (UUID); fall back to Shopify's "cart"
        // cookie (base64 token). Both are stored under cart_token in D1 so that the
        // shopify_cart_token recovery on the checkout page can find the user.
        cart_token:       NxUtils.sanitize(NxUtils.getCookie('cart_token')) ||
                          NxUtils.sanitize(NxUtils.getCookie('cart')) || undefined,
      },

      utm_data:    Object.keys(utmData).length ? utmData : undefined,
      custom_data: customData || undefined,
      test_event_code:        META_TEST_EVENT_CODE   || undefined,
      tiktok_test_event_code: TIKTOK_TEST_EVENT_CODE || undefined,
    };

    if (!body.utm_data) delete body.utm_data;

    NxUtils.log('sendEvent', eventType, eventId, body);

    fetch(COLLECT_URL, {
      method:    'POST',
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  },
};
