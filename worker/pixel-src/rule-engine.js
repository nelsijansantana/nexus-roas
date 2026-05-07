/**
 * rule-engine.js — Motor de regras para tráfego direto.
 * Avalia triggers configurados por projeto (click, form_submit, scroll,
 * time_on_page, pageload) e dispara eventos via callback injetado.
 *
 * Evita dependência circular com tracker.js: recebe a função `track`
 * como parâmetro em init().
 */
import { NxUtils } from './utils.js';

let _track = null;

function customData(rule) {
  return (rule.customData && Object.keys(rule.customData).length) ? rule.customData : undefined;
}

function matchesEl(el, rule) {
  if (!el || el === document || el.nodeType !== 1) return false;
  let ok = true;
  if (rule.selector) {
    try { ok = el.matches(rule.selector); } catch (e) { ok = false; }
  }
  if (ok && rule.buttonText) {
    const text = (el.textContent || el.innerText || el.value || '').trim().toLowerCase();
    ok = text.includes(rule.buttonText.toLowerCase());
  }
  return ok;
}

function initClick(rule) {
  document.addEventListener('click', e => {
    let el = e.target;
    while (el && el !== document.documentElement) {
      if (matchesEl(el, rule)) {
        _track(rule.eventName, customData(rule));
        return;
      }
      el = el.parentElement;
    }
  }, true);
}

function initFormSubmit(rule) {
  document.addEventListener('submit', e => {
    const form = e.target;
    let ok = true;
    if (rule.selector) { try { ok = form.matches(rule.selector); } catch (_) { ok = false; } }
    if (ok) _track(rule.eventName, customData(rule));
  }, true);
}

function initScroll(rule) {
  if (!rule.scrollDepth) return;
  let fired = false;
  const depth = rule.scrollDepth;
  const handler = () => {
    if (fired) return;
    const docH    = document.documentElement.scrollHeight || document.body.scrollHeight || 1;
    const scrolled = (window.scrollY + window.innerHeight) / docH * 100;
    if (scrolled >= depth) {
      fired = true;
      window.removeEventListener('scroll', handler, true);
      _track(rule.eventName, customData(rule));
    }
  };
  window.addEventListener('scroll', handler, { passive: true, capture: true });
}

function initTimer(rule) {
  if (!rule.timeSeconds || rule.timeSeconds <= 0) return;
  setTimeout(() => _track(rule.eventName, customData(rule)), rule.timeSeconds * 1000);
}

export const NxRuleEngine = {
  /**
   * @param {Array}    rules    - Trigger rules from CFG.triggers
   * @param {Function} trackFn  - NxTracker.track (injected to avoid circular dep)
   */
  init(rules, trackFn) {
    if (!rules?.length || !trackFn) return;
    _track = trackFn;

    rules.forEach(rule => {
      if (!rule?.eventName || !rule?.triggerType) return;
      switch (rule.triggerType) {
        case 'pageload':     _track(rule.eventName, customData(rule)); break;
        case 'click':        initClick(rule);       break;
        case 'form_submit':  initFormSubmit(rule);  break;
        case 'scroll':       initScroll(rule);      break;
        case 'time_on_page': initTimer(rule);       break;
      }
    });
  },
};
