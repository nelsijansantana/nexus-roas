/**
 * index.js — Entry point do pixel.
 *
 * esbuild compila este arquivo (+ todas as importações) para pixel.js.
 * O banner de build injeta os placeholders que serve-pixel.ts substitui em runtime:
 *   /*__CONFIG__*\/  → var __CONFIG__ = { ... };
 *   /*__NX_USER__*\/ → var __NX_USER__ = "uuid";
 */
import { NxTracker } from './tracker.js';

// Guard: evita dupla inicialização (ex: script carregado mais de uma vez)
if (!window.__NX_INITIALIZED__) {
  window.__NX_INITIALIZED__ = true;

  NxTracker.init();

  // API pública — permite disparar eventos customizados via window.NexusPixel.track(...)
  window.NexusPixel = {
    track: (eventType, customData) => NxTracker.track(eventType, customData),
    version: '3.1.0',
  };
}
