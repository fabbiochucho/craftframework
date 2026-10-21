// Source maps are for Sentry only. The Sentry Vite plugin uploads and deletes them when SENTRY_AUTH_TOKEN is set;
// this removes whatever is left (no token, or an upload that was skipped) so no .map file is ever published,
// then fails the build if any remain under dist/client.
import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

function maps(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? maps(join(dir, e.name)) : e.name.endsWith('.map') ? [join(dir, e.name)] : []))
}

for (const file of maps('dist')) rmSync(file)
const left = maps('dist/client')
if (left.length) throw new Error(`Source maps still present: ${left.join(', ')}`)
