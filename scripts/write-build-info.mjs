// Records which deploy this build is (Netlify CONTEXT + COMMIT_REF) in src/lib/build-info.json, which both the
// browser bundle and the Netlify Functions import, so Sentry events carry an environment and release without
// reading build-only variables at runtime. Outside Netlify nothing is written (the committed file stays as is).
import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('../src/lib/build-info.json', import.meta.url)
const { CONTEXT, COMMIT_REF } = process.env
if (CONTEXT || COMMIT_REF) {
  const environment = ['production', 'deploy-preview', 'branch-deploy'].includes(CONTEXT) ? CONTEXT : CONTEXT ? 'development' : null
  const next = `${JSON.stringify({ environment, release: COMMIT_REF || null })}\n`
  if (readFileSync(file, 'utf8') !== next) writeFileSync(file, next)
}
