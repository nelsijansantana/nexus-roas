import * as esbuild from 'esbuild'

type ScriptName =
  | 'shopify-storefront'
  | 'shopify-checkout'
  | 'cartpanda-checkout'
  | 'yampi-checkout'
  | 'direct-traffic'

interface ScriptConfig {
  entry: string
  banner: string
}

const CHECKOUT_BANNER = [
  '/*__NX_COLLECT__*/',
  '/*__META_PIXEL_IDS__*/',
  '/*__TIKTOK_PIXEL__*/',
  '/*__GA4_ID__*/',
  '/*__META_TEST__*/',
  '/*__TIKTOK_TEST__*/',
].join('\n')

const SCRIPTS: Record<ScriptName, ScriptConfig> = {
  'shopify-storefront': {
    entry: 'src/pixel/scripts/shopify-storefront.ts',
    banner: '/*__CONFIG__*/\n/*__NX_USER__*/',
  },
  'shopify-checkout': {
    entry: 'src/pixel/scripts/shopify-checkout.ts',
    banner: CHECKOUT_BANNER,
  },
  'cartpanda-checkout': {
    entry: 'src/pixel/scripts/cartpanda-checkout.ts',
    banner: CHECKOUT_BANNER,
  },
  'yampi-checkout': {
    entry: 'src/pixel/scripts/yampi-checkout.ts',
    banner: CHECKOUT_BANNER,
  },
  'direct-traffic': {
    entry: 'src/pixel/scripts/direct-traffic.ts',
    banner: '/*__CONFIG__*/\n' + CHECKOUT_BANNER,
  },
}

const only = process.argv
  .find(a => a.startsWith('--only='))
  ?.split('=')[1] as ScriptName | undefined

const isWatch = process.argv.includes('--watch')

const targets: Partial<Record<ScriptName, ScriptConfig>> =
  only ? { [only]: SCRIPTS[only] } : SCRIPTS

function buildOptions(name: string, cfg: ScriptConfig): esbuild.BuildOptions {
  return {
    entryPoints: [cfg.entry],
    bundle: true,
    minify: !isWatch,
    target: 'es2020',
    format: 'iife',
    banner: { js: cfg.banner },
    outfile: `dist/${name}.js`,
  }
}

if (isWatch) {
  for (const [name, cfg] of Object.entries(targets) as [string, ScriptConfig][]) {
    const ctx = await esbuild.context(buildOptions(name, cfg))
    await ctx.watch()
    console.log(`[watch] ${name}`)
  }
} else {
  const start = Date.now()
  await Promise.all(
    (Object.entries(targets) as [string, ScriptConfig][]).map(async ([name, cfg]) => {
      await esbuild.build(buildOptions(name, cfg))
      console.log(`[build] dist/${name}.js ✓`)
    })
  )
  console.log(`[build:pixel] done in ${Date.now() - start}ms`)
}
