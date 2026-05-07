/**
 * datalayer.js — Observer do window.dataLayer para eventos ecommerce GA4.
 * Mapeia eventos GA4 (view_item, add_to_cart, begin_checkout…) para
 * eventos Nexus e os dispara via callback injetado.
 *
 * Evita dependência circular com tracker.js: recebe `track` em init().
 */
import { NxUtils } from './utils.js';

const GA4_EVENT_MAP = {
  'view_item':         'ViewContent',
  'select_item':       'ViewContent',
  'view_item_list':    'ViewCategory',
  'add_to_cart':       'AddToCart',
  'remove_from_cart':  'RemoveFromCart',
  'view_cart':         'ViewCart',
  'begin_checkout':    'InitiateCheckout',
  'add_shipping_info': 'AddShippingInfo',
  'add_payment_info':  'AddPaymentInfo',
  'search':            'Search',
  'add_to_wishlist':   'AddToWishlist',
};

const TRANSACTIONAL = ['AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase'];

let _track = null;
const _fired = {};

function processEvent(entry) {
  if (!entry || typeof entry !== 'object' || !entry.event) return;
  const rawEvent = typeof entry.event === 'string' ? entry.event.toLowerCase() : '';
  if (!rawEvent) return;

  let mappedName = null;
  for (const key in GA4_EVENT_MAP) {
    if (rawEvent === key || rawEvent.includes(key)) { mappedName = GA4_EVENT_MAP[key]; break; }
  }
  if (!mappedName) return;

  const ecomData  = entry.ecommerce  || {};
  const modelData = entry.eventModel || {};
  const items     = ecomData.items || modelData.items || entry.items || [];

  const value    = ecomData.value    !== undefined ? ecomData.value
                 : modelData.value   !== undefined ? modelData.value
                 : entry.value       !== undefined ? entry.value
                 : modelData.ecomm_totalvalue;
  const currency = ecomData.currency || modelData.currency || entry.currency || 'BRL';

  const contentIds = [], contents = [], contentNames = [], contentCategories = [];
  let numItems = 0;

  items.forEach(item => {
    const id   = item.item_id || item.product_id || item.variant_id;
    const name = item.item_name || item.product_title || item.name;
    const qty  = parseInt(item.quantity, 10) || 1;
    const price = parseFloat(item.price) || 0;
    if (id)   { contentIds.push(id.toString()); const co = { id: id.toString(), quantity: qty }; if (price) co.item_price = price; contents.push(co); }
    if (name) contentNames.push(name);
    numItems += qty;
    const cat = item.item_category || item.category;
    if (cat && !contentCategories.includes(cat)) contentCategories.push(cat);
  });

  const customData = {};
  if (contentIds.length)       customData.content_ids      = contentIds;
  if (contents.length)         customData.contents         = contents;
  if (contentIds.length)       customData.content_type     = 'product';
  if (contentNames.length)     customData.content_name     = contentNames.join(', ');
  if (contentCategories.length) customData.content_category = contentCategories.join(', ');
  if (TRANSACTIONAL.includes(mappedName)) {
    if (value !== undefined && !isNaN(parseFloat(value))) customData.value = parseFloat(value);
    if (currency) customData.currency = currency;
  }
  if (numItems > 0) customData.num_items = numItems;
  if (mappedName === 'Search') {
    const s = ecomData.search_term || modelData.search_term || entry.search_term;
    if (s) customData.search_string = s;
  }
  if (mappedName === 'ViewCategory') {
    const ln = ecomData.item_list_name || modelData.item_list_name || entry.item_list_name
             || ecomData.item_list_id  || modelData.item_list_id  || entry.item_list_id;
    if (ln) customData.content_category = ln;
    if (contentIds.length) customData.content_type = 'product_group';
  }

  // Deduplicação: mesmo evento + mesmos produtos dispara só uma vez por pageload
  const sig = `${mappedName}:${contentIds.join(',')}`;
  if (_fired[sig]) return;
  _fired[sig] = true;

  NxUtils.log('DataLayer →', mappedName, customData);
  _track(mappedName, customData);
}

function processEntry(entry) {
  if (!entry) return;
  // Formato gtag() Arguments Array: ['event', 'name', params]
  if (entry.length !== undefined && entry[0] === 'event' && typeof entry[1] === 'string') {
    const gtagParams = entry[2] || {};
    const normalized = { event: entry[1] };
    if (gtagParams.items) normalized.ecommerce = gtagParams;
    else normalized.eventModel = gtagParams;
    Object.assign(normalized, gtagParams);
    processEvent(normalized);
    return;
  }
  processEvent(entry);
}

export const NxDataLayerObserver = {
  /**
   * @param {Function} trackFn - NxTracker.track (injected to avoid circular dep)
   */
  init(trackFn) {
    if (!trackFn) return;
    _track = trackFn;

    window.dataLayer = window.dataLayer || [];

    // Processar entradas já existentes
    window.dataLayer.forEach(e => { try { processEntry(e); } catch (_) {} });

    // Interceptar pushes futuros
    const originalPush = window.dataLayer.push;
    window.dataLayer.push = function (...args) {
      const result = originalPush.apply(this, args);
      args.forEach(e => { try { processEntry(e); } catch (_) {} });
      return result;
    };

    NxUtils.log('DataLayer observer inicializado, entradas existentes:', window.dataLayer.length);
  },
};
