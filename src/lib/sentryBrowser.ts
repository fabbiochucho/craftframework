// The only parts of the browser SDK CRAFT uses. Loaded through a dynamic import (see monitoring.ts); re-exporting
// just these names lets the bundler drop session replay, feedback and profiling, which are never used.
export { init, captureException, browserTracingIntegration } from '@sentry/browser'
