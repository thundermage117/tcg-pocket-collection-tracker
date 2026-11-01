import path from 'node:path'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type Rolldown } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import stripComments from 'vite-plugin-strip-comments'

// CardsDB and ValueDB fetch these at startup and block rendering until they arrive. Without a preload the request
// only starts once every JS chunk has downloaded and evaluated.
const PRELOADED_JSON = ['cards.json', 'values.json']

function findJsonAssets(bundle: Rolldown.OutputBundle) {
  return Object.values(bundle).filter(
    (output): output is Rolldown.OutputAsset =>
      output.type === 'asset' && output.originalFileNames.some((name) => PRELOADED_JSON.some((json) => name.endsWith(`assets/${json}`))),
  )
}

function preloadJsonAssets(): Plugin {
  return {
    name: 'preload-json-assets',
    apply: 'build',
    // The source files are pretty-printed for readable diffs
    generateBundle(_options, bundle) {
      for (const asset of findJsonAssets(bundle)) {
        asset.source = JSON.stringify(JSON.parse(asset.source.toString()))
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const assets = findJsonAssets(ctx.bundle ?? {})
        if (assets.length !== PRELOADED_JSON.length) {
          throw new Error(`preload-json-assets: expected ${PRELOADED_JSON.length} assets, found ${assets.length}`)
        }
        // crossorigin is required for a fetch() to reuse an as="fetch" preload
        return assets.map((asset) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'fetch', href: `/${asset.fileName}`, crossorigin: 'anonymous' },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), stripComments({ type: 'none' }), mkcert(), preloadJsonAssets()],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    fs: {
      strict: false,
    },
  },
  build: {
    commonjsOptions: {
      include: [/onnxruntime-web/, /node_modules/],
    },
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router)[\\/]/ },
            { name: 'supabase-vendor', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'tensorflow-vendor', test: /node_modules[\\/]@tensorflow[\\/]/ },
            { name: 'xlsx-vendor', test: /node_modules[\\/]xlsx[\\/]/ },
          ],
        },
      },
    },
  },
})
