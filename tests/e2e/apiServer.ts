// Test-only API server for the browser E2E suite. It runs the REAL
// `netlify/functions/workspace-api.mts` handler against a real Postgres
// (TEST_DATABASE_URL) and exposes it over HTTP so Playwright can forward the
// app's `/api/*` calls to it.
//
// Sign-in is a test-only path that lives entirely in this file and in the
// Playwright fixtures: the caller identity is read from the `nf_jwt` cookie the
// browser holds (an unsigned, runtime-generated token). Production never loads
// this server, the stubs or the module hooks, and the hooks refuse to load on
// Netlify / NODE_ENV=production. The real function keeps verifying Netlify
// Identity sessions, so no production auth is weakened.
import http from 'node:http'
// @ts-ignore -- resolved at runtime by tests/integration/hooks.mjs
import { applyMigrations, loadHandler, truncateAll } from '../integration/harness.ts'

// The app and API are same-origin in production; mirror that for the origin check.
const WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:3000'
const PORT = Number(process.env.E2E_API_PORT ?? 8899)

function identityFromCookie(header: string | undefined): { id: string; email: string; name: string } | null {
  const token = /(?:^|;\s*)nf_jwt=([^;]+)/.exec(header ?? '')?.[1]
  if (!token) return null
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof claims.email === 'string' && typeof claims.sub === 'string' && claims.exp * 1000 > Date.now()
      ? { id: claims.sub, email: claims.email, name: claims.email } : null
  } catch {
    return null
  }
}

await applyMigrations()
const handler = await loadHandler('e2e')
const als = (globalThis as any).__craftTestIdentityAls
const legacyHandlers = new Map<string, (request: Request) => Promise<Response>>()
for (const name of ['legacy-state', 'organizations', 'responses', 'response-notes', 'presigned-url', 'data-room-upload']) {
  const module = await import(new URL(`../../netlify/functions/${name}.mts`, import.meta.url).href)
  legacyHandlers.set(`/api/${name}`, module.default)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
    if (url.pathname === '/__test/reset' && req.method === 'POST') {
      await truncateAll()
      res.writeHead(204).end()
      return
    }
    if (url.pathname === '/__test/ready') {
      res.writeHead(200).end('ok')
      return
    }
    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404).end('not found')
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
    headers.set('x-nf-client-connection-ip', '127.0.0.1')
    const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined
    const request = new Request(`${WEB_ORIGIN}${req.url}`, { method: req.method, headers, body })
    const routeHandler = legacyHandlers.get(url.pathname) ?? handler
    const response: Response = await als.run(identityFromCookie(req.headers.cookie), () => routeHandler(request))
    const out: Record<string, string> = {}
    response.headers.forEach((v, k) => { out[k] = v })
    res.writeHead(response.status, out).end(Buffer.from(await response.arrayBuffer()))
  } catch (err) {
    console.error('e2e api server error', err)
    res.writeHead(500).end('server error')
  }
})
server.listen(PORT, '127.0.0.1', () => console.log(`e2e api server listening on ${PORT}`))
