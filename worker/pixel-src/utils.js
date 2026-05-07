/**
 * utils.js — Utilitários gerais: uuid, cookies, logging.
 */
import { DEBUG } from './config.js';

export const NxUtils = {
  uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  },

  sanitize(val) {
    if (val === null || val === undefined || val === 'null' || val === 'undefined') return undefined;
    return val;
  },

  getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const parts = cookies[i].trim().split('=');
      if (parts[0] === name) return decodeURIComponent(parts[1] || '');
    }
    return undefined;
  },

  setCookie(name, value, maxAgeSecs) {
    if (!value) return;
    document.cookie =
      `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSecs}; path=/; SameSite=Lax; Secure`;
  },

  log(...args) {
    if (DEBUG && typeof console !== 'undefined') {
      console.debug('[NexusPixel]', ...args);
    }
  },
};
