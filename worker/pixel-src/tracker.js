/**
 * tracker.js — Coordenador central. Inicializa todos os módulos e expõe track().
 */
import { CFG, NX_USER }       from './config.js';
import { NxUtils }             from './utils.js';
import { NxGeo }               from './geo.js';
import { NxUtm }               from './utm.js';
import { NxApi }               from './api.js';
import { NxPixelBridge }       from './pixel-bridge.js';
import { NxLinkDecorator }     from './link-decorator.js';
import { NxShopify }           from './shopify.js';
import { NxRuleEngine }        from './rule-engine.js';
import { NxDataLayerObserver } from './datalayer.js';
import { NxGA4 }               from './ga4.js';

export const NxTracker = {
  track(eventType, customData, explicitEventId) {
    const eventId = explicitEventId || NxUtils.uuid();
    NxApi.sendEvent(eventType, eventId, customData || undefined);
    NxPixelBridge.fireEvent(eventType, eventId, customData);
  },

  init() {
    NxGeo.init();
    NxUtm.collect();

    // Carrega gtag.js browser-side quando GA4 está configurado.
    // Isso garante que page_view tenha session_id, page_title, page_referrer e
    // atribuição de tráfego corretos no GA4 — equivalente ao que o GTM faz.
    // O Worker não envia page_view via Measurement Protocol (GA4_SKIP) para evitar duplicata.
    if (CFG.ga4_measurement_id) {
      NxGA4.initGtag(CFG.ga4_measurement_id);
    }

    // Inicializa pixels client-side a partir da config injetada (sem round-trip)
    const metaIds   = [];
    const tiktokIds = [];

    if (CFG.meta_pixel_id) metaIds.push(CFG.meta_pixel_id);
    if (CFG.meta_pixel_ids_mirror?.length) {
      CFG.meta_pixel_ids_mirror.forEach(id => { if (!metaIds.includes(id)) metaIds.push(id); });
    }
    if (CFG.tiktok_pixel_id) tiktokIds.push(CFG.tiktok_pixel_id);

    NxPixelBridge.init(metaIds, tiktokIds);

    // PageView — server-side CAPI + pixels client-side
    NxTracker._sendPageView();

    // DataLayer observer (ecommerce GA4 events)
    NxDataLayerObserver.init((eventType, customData) => NxTracker.track(eventType, customData));

    // Decora links de checkout com UTMs + nx_user
    NxLinkDecorator.init();

    // Shopify: sincroniza cart attributes + cookie legível pelo checkout pixel
    NxShopify.init();

    // Rule engine — tráfego direto: triggers configurados por projeto
    if (CFG.triggers?.length) {
      NxRuleEngine.init(CFG.triggers, (eventType, customData) => NxTracker.track(eventType, customData));
    }

  },

  _sendPageView() {
    const eventId = NxUtils.uuid();
    NxApi.sendEvent('PageView', eventId, undefined);
    NxPixelBridge.fireEvent('PageView', eventId);
  },
};
