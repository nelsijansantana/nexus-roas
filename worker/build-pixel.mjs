import * as esbuild from 'esbuild';
import { copyFileSync } from 'fs';

const CHECKOUT_BANNER = [
  '/*__NX_COLLECT__*/',
  '/*__META_PIXEL_IDS__*/',
  '/*__TIKTOK_PIXEL__*/',
  '/*__GA4_ID__*/',
  '/*__META_TEST__*/',
  '/*__TIKTOK_TEST__*/',
].join('\n');

await esbuild.build({
  entryPoints: ['pixel-src/index.js'],
  bundle:      true,
  minify:      true,
  target:      'es2015',
  format:      'iife',
  banner:      { js: '/*__CONFIG__*/\n/*__NX_USER__*/' },
  outfile:     'pixel.js',
});
copyFileSync('pixel.js', 'pixel-template.txt');
console.log('[build:pixel] pixel.js ✓');

await esbuild.build({
  entryPoints: ['checkout-src/cartpanda-checkout.js'],
  bundle:      true,
  minify:      true,
  target:      'es2015',
  format:      'iife',
  banner:      { js: CHECKOUT_BANNER },
  outfile:     'cartpanda-checkout.js',
});
copyFileSync('cartpanda-checkout.js', 'cartpanda-checkout-template.txt');
console.log('[build:pixel] cartpanda-checkout.js ✓');

await esbuild.build({
  entryPoints: ['checkout-src/yampi-checkout.js'],
  bundle:      true,
  minify:      true,
  target:      'es2015',
  format:      'iife',
  banner:      { js: CHECKOUT_BANNER },
  outfile:     'yampi-checkout.js',
});
copyFileSync('yampi-checkout.js', 'yampi-checkout-template.txt');
console.log('[build:pixel] yampi-checkout.js ✓');
