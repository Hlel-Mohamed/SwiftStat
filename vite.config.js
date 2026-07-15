import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// If deploying to GitHub Pages at https://<user>.github.io/SwiftStat/,
// set BASE_PATH to '/SwiftStat/'. For a custom domain or Vercel/Netlify root, keep '/'.
const base = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SwiftStat — D&D 5e rules',
        short_name: 'SwiftStat',
        description: 'Fast D&D 5e rules, spells, and attack math. Offline-ready.',
        theme_color: '#14110f',
        background_color: '#14110f',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Include the ~1 MB data JSON so the app works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
})
