/**
 * link-decorator.js — Decora links de checkout com UTMs e nx_user (src/sck).
 * Suporta <a> elements, forms e observa DOM mutations para links adicionados dinamicamente.
 */
import { NX_USER } from './config.js';
import { NxUtm }   from './utm.js';

const CHECKOUT_DOMAINS = [
  'cartpanda.com', 'hotmart.com', 'ticto.com.br', 'ticto.io',
  'kiwify.com.br', 'kiwify.com', 'kirvano.com', 'greenn.com.br',
  'pay.', 'checkout.',
];

const UTM_FIELDS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'cid',
  'fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'msclkid', 'twclid',
];

function isCheckout(urlStr) {
  if (!urlStr) return false;
  return CHECKOUT_DOMAINS.some(d => urlStr.indexOf(d) > -1);
}

function decorateElement(el) {
  if (!el || el.tagName !== 'A' || !el.href) return;
  if (!isCheckout(el.hostname)) return;

  const utms = NxUtm.get() || {};
  let url;
  try { url = new URL(el.href); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  let modified = false;
  UTM_FIELDS.forEach(f => {
    if (utms[f] && !url.searchParams.has(f)) {
      url.searchParams.set(f, utms[f]);
      modified = true;
    }
  });
  if (NX_USER) {
    if (!url.searchParams.has('src')) { url.searchParams.set('src', NX_USER); modified = true; }
    if (!url.searchParams.has('sck')) { url.searchParams.set('sck', NX_USER); modified = true; }
  }
  if (modified) el.href = url.toString();
}

function decorateForm(form) {
  const action = form.action || '';
  if (!isCheckout(action)) return;
  if (!NX_USER) return;
  ['src', 'sck'].forEach(param => {
    if (!form.querySelector(`input[name="${param}"]`)) {
      const input   = document.createElement('input');
      input.type  = 'hidden';
      input.name  = param;
      input.value = NX_USER;
      form.appendChild(input);
    }
  });
}

function scan() {
  const links = document.getElementsByTagName('A');
  for (let i = 0; i < links.length; i++) decorateElement(links[i]);
  const forms = document.getElementsByTagName('FORM');
  for (let j = 0; j < forms.length; j++) decorateForm(forms[j]);
}

export const NxLinkDecorator = {
  init() {
    document.addEventListener('click', e => {
      let target = e.target;
      while (target && target.tagName !== 'A') target = target.parentNode;
      if (target && target.href) decorateElement(target);
    }, true);

    document.addEventListener('submit', e => {
      const form = e.target;
      if (form.tagName === 'FORM') decorateForm(form);
    }, true);

    scan();

    if (window.MutationObserver) {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(m => { if (m.addedNodes.length) scan(); });
      });
      const attach = () => observer.observe(document.body, { childList: true, subtree: true });
      if (document.body) attach();
      else document.addEventListener('DOMContentLoaded', attach);
    }
  },
};
