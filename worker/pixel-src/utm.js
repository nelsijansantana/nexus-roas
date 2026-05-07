/**
 * utm.js — Captura e persistência de parâmetros UTM + campos de atribuição.
 */
import { NxUtils } from './utils.js';

const UTM_KEY = 'nx_utms';

export const UTM_FIELDS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_platform', 'utm_network', 'placement', 'creative_format',
  'ad_id', 'adset_id', 'campaign_id', 'conversion_type',
  'xcod', 'src', 'sck', 'cid',
  'fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'msclkid', 'twclid',
];

export const NxUtm = {
  collect() {
    try {
      const params = new URLSearchParams(window.location.search);
      const utms   = this.get() || {};
      let hasNew   = false;
      UTM_FIELDS.forEach(f => {
        const val = params.get(f);
        if (val) { utms[f] = val; hasNew = true; }
      });
      if (hasNew) localStorage.setItem(UTM_KEY, JSON.stringify(utms));
    } catch (_) {}
  },

  get() {
    try {
      const raw = localStorage.getItem(UTM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },
};
