import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { VitePWA } from 'vite-plugin-pwa'

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    netlify(),
    tanstackStart(),
    viteReact(),
    // ------------------------------------------------------------------------
    // CRAFT v4.0 — Offline-First PWA
    // ------------------------------------------------------------------------
    // Generates a Workbox service worker that precaches the app shell and core
    // assessment schemas so field assessors can keep working with no signal.
    // `autoUpdate` ships new builds silently on the next navigation. Registration
    // is done manually from the client (see components/OfflineBanner.tsx) rather
    // than via an injected <script>, because TanStack Start renders through SSR
    // and has no static index.html for the plugin to rewrite. The PWA manifest is
    // hand-authored at public/manifest.json (manifest: false below) and linked
    // from the document head in routes/__root.tsx.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Precache the built app shell (JS/CSS/HTML) plus icons and fonts.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Fiduciary/assessment data — always try the network first so a
            // connected assessor sees fresh records; fall back to cache offline.
            // Covers the app's own /api/* routes and any Supabase REST/RPC host.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') || /\.supabase\.(co|in)$/.test(url.hostname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'craft-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Static build assets — serve instantly from cache, revalidate later.
            urlPattern: ({ request }) =>
              ['script', 'style', 'font'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'craft-static',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Web fonts (Google Fonts CSS + files used for Playfair/Inter/Mono).
            urlPattern: ({ url }) =>
              url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'craft-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW off during `netlify dev` to avoid caching a live-reloading
        // build; it is generated and active only for production output.
        enabled: false,
      },
    }),
  ],
})

export default config
