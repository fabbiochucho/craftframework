// drizzle-orm 1.0.0-rc.5's Netlify Database driver calls the Neon HTTP client as a plain function,
// sql(text, params, options). @neondatabase/serverless 1.x only accepts that as sql.query(text, params, options) and
// throws otherwise, which broke every query in production on 2026-10-29 (Sentry 157191997). This client routes
// plain calls to .query(), so drizzle works unchanged. Remove when drizzle calls .query() itself.
// Self-check: `node db/neonCompat.test.ts`.
import { neon } from '@neondatabase/serverless'

type Neon = ReturnType<typeof neon>

export function neonHttpCompat(sql: Neon): Neon {
  const call = (text: string, params?: unknown[], options?: Parameters<Neon['query']>[2]) => sql.query(text, params as any[], options)
  return Object.assign(call, { query: sql.query, transaction: sql.transaction }) as unknown as Neon
}
