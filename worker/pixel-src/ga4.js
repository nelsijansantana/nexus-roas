/**
 * ga4.js — Resolução de client_id e dados de sessão GA4.
 * Lê o cookie _ga (escrito pelo gtag.js) ou gera e persiste um ID próprio.
 * initGtag() carrega gtag.js no browser para que page_view tenha session_id,
 * page_title, page_referrer e atribuição de fonte corretos no GA4.
 */
import { CFG }      from './config.js';
import { NxUtils }  from './utils.js';

const CLIENT_KEY = 'nx_ga4_cid';

export const NxGA4 = {
  /**
   * Carrega gtag.js assincronamente e dispara page_view com contexto completo.
   * Chamado no init() do tracker quando ga4_measurement_id está configurado.
   * O Worker NÃO envia page_view via Measurement Protocol (evita duplicata).
   */
  initGtag(measurementId) {
    if (!measurementId || typeof window === 'undefined') return;

    // Inicializa dataLayer e função gtag antes do script carregar
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;

    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      // Não disparar page_view automaticamente — vamos disparar explicitamente
      // depois que o script carregar, para garantir que os cookies estejam prontos.
      send_page_view: false,
    });

    // Carrega o script gtag.js assincronamente
    const script = document.createElement('script');
    script.async = true;
    script.src   = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onload = () => {
      // Após carregar, dispara page_view com contexto completo (title, referrer, source)
      window.gtag('event', 'page_view', {
        page_location: window.location.href,
        page_title:    document.title,
        page_referrer: document.referrer,
      });
      NxUtils.log('GA4 gtag page_view fired', measurementId);
    };
    document.head.appendChild(script);
  },

  getClientId() {
    // 1. Cookie _ga gerado pelo gtag.js
    const ga = NxUtils.getCookie('_ga');
    if (ga) {
      const parts = ga.split('.');
      if (parts.length >= 4) return `${parts[2]}.${parts[3]}`;
    }
    // 2. ID próprio persistido em localStorage
    try {
      const stored = localStorage.getItem(CLIENT_KEY);
      if (stored) return stored;
      const newId = `${Math.random().toString(36).substring(2)}.${Date.now()}`;
      localStorage.setItem(CLIENT_KEY, newId);
      return newId;
    } catch (_) { return ''; }
  },

  getSessionData() {
    const measurementId = CFG.ga4_measurement_id || '';
    // gtag.js creates the cookie as _ga_XXXXXXXXXX — uppercase, matching the measurement ID.
    // Do NOT lowercase: _ga_abcdef !== _ga_ABCDEF (cookies are case-sensitive).
    const shortId       = measurementId.replace('G-', '');
    const sessionCookie = NxUtils.getCookie(`_ga_${shortId}`);
    if (sessionCookie) {
      const parts = sessionCookie.split('.');
      // Formato: GS1.1.<session_id>.<session_count>.<timestamp>...
      if (parts.length >= 4) {
        return { session_id: parts[2] || '', session_count: parts[3] || '', timestamp: parts[4] || '' };
      }
    }
    return { session_id: '', session_count: '', timestamp: '' };
  },
};
