// Server entry: pages are rendered by a function, and Netlify applies netlify.toml [[headers]]
// only to static files, so the same security headers are added to every SSR response here.
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { securityHeaders } from './lib/securityHeaders'
import netlifyToml from '../netlify.toml?raw'

const HEADERS = securityHeaders(netlifyToml)

export default createServerEntry({
  async fetch(request) {
    const res = await handler.fetch(request)
    // Copy so immutable responses (e.g. from fetch) can still take headers.
    const out = new Response(res.body, res)
    for (const [k, v] of HEADERS) if (!out.headers.has(k)) out.headers.set(k, v)
    return out
  },
})
