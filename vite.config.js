import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// If deploying to GitHub Pages at https://<user>.github.io/SwiftStat/,
// set BASE_PATH to '/SwiftStat/'. For a custom domain or Vercel/Netlify root, keep '/'.
const base = process.env.BASE_PATH || '/'

// Build profile: 'public' (SRD-only, safe to host) or 'personal' (also loads your
// git-ignored custom cards). Defaults to 'public' when the env var is absent.
const profile = process.env.SWIFTSTAT_PROFILE === 'personal' ? 'personal' : 'public'
console.log(`[swiftstat] building profile: ${profile}`)

// https://vite.dev/config/
export default defineConfig({
  base,
  define: {
    // Exposed to the app so search.js knows whether to load personal-*.json.
    'import.meta.env.VITE_PROFILE': JSON.stringify(profile),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'data/srd-2014.json'],
      manifest: {
        name: 'SwiftStat — D&D rules',
        short_name: 'SwiftStat',
        description: 'Fast D&D 5e / 5.5 rules, spells, monsters, and attack math. Offline-ready.',
        theme_color: '#14110f',
        background_color: '#14110f',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + only the DEFAULT edition (srd-2014.json via
        // includeAssets). The other edition is runtime-cached on first open — this
        // halves the install payload and avoids downloading an edition you never use.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
            handler: 'CacheFirst',
            options: { cacheName: 'srd-data', expiration: { maxEntries: 6 } },
          },
        ],
      },
    }),
  ],
})
