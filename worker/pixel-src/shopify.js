/**
 * shopify.js — Bridge para storefronts Shopify.
 * Sincroniza nx_user e UTMs em cart.attributes via /cart/update.js,
 * para que order.note_attributes chegue ao webhook com atribuição completa.
 */
import { NX_USER }    from './config.js';
import { NxUtils }    from './utils.js';
import { NxUtm }      from './utm.js';
import { NxClickIds } from './click-ids.js';

export const NxShopify = {
  init() {
    // Set nx_lid on every storefront (JS-readable, root-domain) so checkout scripts
    // on any platform (CartPanda, CartX, Shopify checkout) can read it cross-subdomain.
    // nx_user is HttpOnly and invisible to JS — nx_lid is its readable mirror.
    const parts = window.location.hostname.split('.');
    // For ccTLDs like .com.br / .co.uk, slice(-2) gives the public suffix — take 3 labels.
    // Heuristic: second-to-last label <= 3 chars (com, net, co, org) → ccTLD compound.
    const _sld = parts[parts.length - 2] || '';
    const _take = (parts.length >= 3 && _sld.length <= 3) ? 3 : 2;
    const rootDomain = parts.length >= 2 ? '.' + parts.slice(-_take).join('.') : window.location.hostname;
    document.cookie = `nx_lid=${encodeURIComponent(NX_USER)}; max-age=${365 * 24 * 60 * 60}; path=/; domain=${rootDomain}; SameSite=Lax; Secure`;

    // Shopify-specific: sync nx_user + UTMs into cart.attributes so they appear in
    // order.note_attributes and enable Tier-2 attribution on Shopify webhooks.
    if (!window.Shopify) return;
    NxShopify._sync();
    document.addEventListener('cart:updated', NxShopify._sync);
  },

  _sync() {
    const utms     = NxUtm.get() || {};
    const clickIds = NxClickIds.collect();
    const attrs    = { nx_user: NX_USER };

    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
     'utm_id', 'utm_platform', 'ad_id', 'adset_id', 'campaign_id',
     'src', 'sck', 'xcod']
      .forEach(k => { if (utms[k]) attrs[k] = utms[k]; });

    // Click IDs — read from live URL params + cookies so checkout pixel can recover them
    ['fbclid', 'fbc', 'fbp', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'ttp', 'msclkid']
      .forEach(k => { if (clickIds[k]) attrs[k] = clickIds[k]; });

    fetch('/cart/update.js', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ attributes: attrs }),
    }).catch(() => {});
  },
};
