import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Source maps are always generated as hidden maps (no sourceMappingURL comment). With SENTRY_AUTH_TOKEN set (Netlify
// build) they are uploaded to Sentry for readable stack traces and then deleted; without it scripts/strip-sourcemaps.mjs
// removes them. Either way no .map file is ever published.
const sentryUpload = process.env.SENTRY_AUTH_TOKEN
  ? sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      url: process.env.SENTRY_URL,
      telemetry: false,
      release: { name: process.env.COMMIT_REF || undefined },
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
      // A Sentry outage must never fail a production build.
      errorHandler: err => console.warn(`[sentry] source map upload skipped: ${err.message}`),
    })
  : []

const config = defineConfig({
  build: { sourcemap: 'hidden' },
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    netlify(),
    tanstackStart(),
    viteReact(),
    // Last, so it sees the final bundles. Client environment only (the SSR bundle is not public).
    ...[sentryUpload].flat().map(p => ({ ...p, applyToEnvironment: (env: { name: string }) => env.name === 'client' })),
    // Offline service worker: generated post-build by scripts/generate-sw.mjs.
  ],
})

export default config
