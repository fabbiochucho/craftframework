# Error monitoring (Sentry, EU)

Error monitoring runs on **Sentry's EU data region** (org `dibadili-institute`, project `craftframework`, ingest
`*.ingest.de.sentry.io`). It reports crashes and unexpected function failures so they can be fixed. It is **not**
analytics and is independent of the PostHog consent flow.

## Lawful basis
Legitimate interests (keeping the service working and secure). No consent banner is needed because the reports
contain no personal data by design (see below). The privacy policy and the sub-processors page say so.

## What is sent, and what never is
Everything is scrubbed in `src/lib/errorScrub.ts` (shared by the browser and the functions) inside `beforeSend`,
`beforeSendTransaction` and `beforeBreadcrumb`, and the SDK's own data collection is switched off
(`NO_DATA_COLLECTION`; Sentry v11 replaced `sendDefaultPii` with `dataCollection`). Unit-tested in
`src/lib/errorScrub.test.ts`.

| Sent | Never sent |
| --- | --- |
| Error type and message (emails, 5+ digit runs, tokens, UUIDs, quoted values and SQL parameters redacted) | User, email, account id, IP address |
| Stack trace (file names without query strings) | Request bodies, cookies, headers other than `User-Agent` |
| Page as a **route pattern** (`/app/workspaces/:id/evidence/:id`) | Query strings, fragments, ids in URLs |
| Browser / OS type, release (commit SHA), environment | Scores, evidence, comments, organisation names, `extra` data |
| 5% of page-load / navigation timings (URL paths parameterised) | Session replay, screenshots, feedback widget, profiling, DOM text |
| Breadcrumbs: navigation (parameterised), fetch method/status/path, click selectors | Console breadcrumbs from sensitive routes; typed input |

Environment comes from Netlify's `CONTEXT` (`production`, `deploy-preview`, `branch-deploy`) and the release from
`COMMIT_REF`, written at build time to `src/lib/build-info.json` by `scripts/write-build-info.mjs`.

## Configuration
| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SENTRY_DSN` | Netlify (build) | Browser DSN. Unset = browser monitoring is a no-op and the SDK is not even bundled |
| `SENTRY_DSN` | Netlify (runtime) | Functions DSN. Unset = server monitoring is a no-op and `@sentry/node` is never imported |
| `SENTRY_AUTH_TOKEN` | Netlify (build) | Org auth token with the `project:releases` scope; enables source-map upload |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_URL` | Netlify (build) | `dibadili-institute` / `craftframework` / `https://de.sentry.io` |

Source maps are built as *hidden* maps (no `sourceMappingURL`), uploaded only when `SENTRY_AUTH_TOKEN` is set, and
always removed from `dist` afterwards (`scripts/strip-sourcemaps.mjs` fails the build if a `.map` would be published).

## How it works
- **Browser:** `src/lib/monitoring.ts` loads `@sentry/browser` (only `init`, `captureException`,
  `browserTracingIntegration` - see `sentryBrowser.ts`) after the page has loaded, in its own chunk. Unhandled
  errors and rejections are captured by the SDK; `RootErrorBoundary` shows the fallback and reports render errors.
- **Functions:** every handler is exported through `monitored(...)` (`netlify/lib/monitoring.ts`, re-exported from
  `netlify/lib/logger.ts`). `logger.error(...)` also reports; an exception escaping a handler is reported and
  re-thrown; reports are flushed (max ~2 s) before the response returns. Errors with a 4xx `status`, and Zod
  errors, are never reported. New functions must export `monitored(handler)`.
- Sentry failures never change a response.

## Testing it end to end
Sign in as the Super Admin and open `/app/monitoring-test`: buttons send a browser error, a server error
(`POST /api/monitoring-test`) or crash the page to show the fallback. In a browser console on any page,
`setTimeout(() => { throw new Error('Sentry test') })` also produces an unhandled error.
