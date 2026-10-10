// Module-resolution hooks used ONLY by the integration/E2E test runners
// (loaded with `node --import ./tests/integration/register.mjs`). They let the
// real, unmodified `netlify/functions/workspace-api.mts` handler run in plain
// Node against a real Postgres by swapping the three platform-provided modules:
//   db/index.js          -> node-postgres Drizzle client (TEST_DATABASE_URL)
//   @netlify/identity    -> stub whose "verified" caller is set by the harness
//   @netlify/blobs       -> in-memory blob store
// Nothing under src/, netlify/ or db/ references these files, so the stubs
// cannot be enabled in a deployed function. They also refuse to load when the
// process looks like production or a Netlify runtime.
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

if (process.env.NODE_ENV === 'production' || process.env.NETLIFY || process.env.CONTEXT) {
  throw new Error('Test auth/storage stubs must never be loaded in production or on Netlify')
}

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const STUBS = {
  '@netlify/identity': path.join(here, 'stubs/identity.mjs'),
  '@netlify/blobs': path.join(here, 'stubs/blobs.mjs'),
}

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: pathToFileURL(STUBS[specifier]).href, shortCircuit: true }
  if (context.parentURL && (specifier.startsWith('./') || specifier.startsWith('../'))) {
    const parent = fileURLToPath(context.parentURL)
    if (parent.startsWith(repoRoot) && !parent.includes('node_modules')) {
      let target = path.resolve(path.dirname(parent), specifier)
      if (/db[\\/]index\.js$/.test(target) && target.startsWith(path.join(repoRoot, 'db'))) {
        return { url: pathToFileURL(path.join(here, 'testDb.ts')).href, shortCircuit: true }
      }
      if (target.endsWith('.js') && !existsSync(target)) {
        const ts = target.slice(0, -3) + '.ts'
        if (existsSync(ts)) return { url: pathToFileURL(ts).href, shortCircuit: true }
      }
    }
  }
  return nextResolve(specifier, context)
}
