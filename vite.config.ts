import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import prerender from './scripts/prerender-plugin.mjs'

/**
 * Preload the LCP font (SPEC §9.11): find the emitted Archivo latin
 * variable woff2 in the bundle and inject a <link rel="preload"> for it.
 * Build only; in dev the font loads from the fontsource CSS as usual.
 */
function preloadFonts(): Plugin {
  let base = '/'
  return {
    name: 'dtw:preload-fonts',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const tags = Object.values(ctx.bundle)
          .filter((file) => file.type === 'asset' && /archivo-latin-wdth-normal[^/]*\.woff2$/.test(file.fileName))
          .map((file) => ({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: true,
              href: `${base}${file.fileName}`,
            },
            injectTo: 'head' as const,
          }))
        return { html, tags }
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFonts(), prerender()],
  build: {
    // The lazy field chunk (three + engine + shaders) is ~610 kB raw by design; its
    // budget is 170 kB gzipped (SPEC §8.5), checked by the QA audit, not by this warning.
    chunkSizeWarningLimit: 650,
  },
})
