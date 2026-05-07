/**
 * click-ids.js — Coleta click IDs de plataformas de anúncio (fbclid, ttclid, gclid…)
 * e lê cookies gerados pelos SDKs de pixel (_fbp, _ttp, etc.).
 */
import { NxUtils } from './utils.js';

export const NxClickIds = {
  collect() {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get('fbclid');
    let fbc = NxUtils.getCookie('_fbc');
    if (fbclid && !fbc) fbc = `fb.1.${Date.now()}.${fbclid}`;

    return {
      fbclid: fbclid || undefined,
      fbc:    fbc || NxUtils.getCookie('_fbc')  || undefined,
      fbp:    NxUtils.getCookie('_fbp') || NxUtils.getCookie('fbp') || undefined,
      gclid:  params.get('gclid')   || undefined,
      gbraid: params.get('gbraid')  || undefined,
      wbraid: params.get('wbraid')  || undefined,
      ttclid: params.get('ttclid')  || undefined,
      ttp:    NxUtils.getCookie('_ttp') || NxUtils.getCookie('ttp') || undefined,
      msclkid: params.get('msclkid') || undefined,
      twclid:  params.get('twclid')  || undefined,
    };
  },
};
