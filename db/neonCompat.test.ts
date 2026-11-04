// Self-check — run directly with `node db/neonCompat.test.ts`.
// Runs drizzle's Netlify Database driver against the real Neon HTTP client, with only the network replaced, so the
// 2026-10-29 outage (every query failed; the integration tests use node-postgres and missed it) can't come back unseen.
import assert from 'node:assert/strict'
import { Pool, neon, neonConfig } from '@neondatabase/serverless'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/netlify-db'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { neonHttpCompat } from './neonCompat.ts'

const URL = 'postgres://user:pass@ep-test.example/neondb'
const items = pgTable('items', { id: integer('id').primaryKey(), name: text('name').notNull() })

// Neon's HTTP API: POST {query, params} → one result; POST {queries: [...]} → {results: [...]}.
const sent: unknown[] = []
const result = (fields: string[], rows: unknown[][]) => ({
  command: 'SELECT', rowCount: rows.length, rowAsArray: true,
  fields: fields.map((name) => ({ name, dataTypeID: name === 'id' ? 23 : 25 })), rows,
})
neonConfig.fetchFunction = async (_url: string, init: { body: string }) => {
  const body = JSON.parse(init.body)
  sent.push(body)
  const one = () => result(['id', 'name'], [[1, 'Riverbend']])
  return new Response(JSON.stringify(body.queries ? { results: body.queries.map(one) } : one()), { status: 200, headers: { 'content-type': 'application/json' } })
}

// The bug, as it happened: drizzle rc.5 with the plain Neon client fails on every query.
const broken = drizzle({ client: { http: neon(URL), pool: new Pool({ connectionString: URL }) } })
await assert.rejects(broken.select().from(items), /tagged-template/)

// Through the compat client: selects, raw SQL and batches all work.
const db = drizzle({ client: { http: neonHttpCompat(neon(URL)), pool: new Pool({ connectionString: URL }) } })
assert.deepEqual(await db.select().from(items), [{ id: 1, name: 'Riverbend' }])
assert.equal((sent.at(-1) as { query: string }).query, 'select "id", "name" from "items"')

const raw = await db.execute(sql`SELECT ${42}::int AS answer`, 'objects')
assert.ok(raw, 'raw execute returns')
assert.deepEqual((sent.at(-1) as { params: unknown[] }).params, ['42'])

const batch = await db.batch([db.select().from(items), db.select({ id: items.id }).from(items)])
assert.equal(batch.length, 2)
assert.equal((sent.at(-1) as { queries: unknown[] }).queries.length, 2)

// Tagged-template use of the compat client still works too.
const tagged = neonHttpCompat(neon(URL))
assert.ok(await tagged`SELECT 1`)

console.log('neonCompat.test.ts: all assertions passed')
