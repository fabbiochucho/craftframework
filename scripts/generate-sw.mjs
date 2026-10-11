// Generates the offline service worker (dist/client/sw.js) after `vite build`.
// vite-plugin-pwa emitted nothing under TanStack Start's multi-environment
// build, so /sw.js 404'd in production and offline mode never activated.
// Registration stays manual (components/OfflineBanner.tsx); the PWA manifest is
// hand-authored at public/manifest.json.
import { generateSW } from 'workbox-build'

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist/client',
  swDest: 'dist/client/sw.js',
  // Precache the built app shell (JS/CSS/HTML) plus icons and fonts.
  globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
  globIgnores: ['sw.js', 'workbox-*.js', 'launch/**'],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  navigateFallback: null,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Private APIs must never use a shared service-worker cache.
      urlPattern: ({ url }) => url.pathname === '/api' || url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    {
      // Static build assets - serve instantly from cache, revalidate later.
      urlPattern: ({ request }) => ['script', 'style', 'font'].includes(request.destination),
      handler: 'CacheFirst',
      options: {
        cacheName: 'craft-static',
        expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Web fonts (Google Fonts CSS + files used for Playfair/Inter/Mono).
      urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
      handler: 'CacheFirst',
      options: {
        cacheName: 'craft-fonts',
        expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
})
for (const warning of warnings) console.warn(`[sw] ${warning}`)
console.log(`[sw] dist/client/sw.js precaches ${count} files (${(size / 1024).toFixed(0)} KB)`)
