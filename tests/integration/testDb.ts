// Test-only replacement for db/index.ts: Drizzle over node-postgres, pointed at
// TEST_DATABASE_URL. Refuses anything that is not obviously a test database
// because the harness TRUNCATEs every table between tests.
import { drizzle } from 'drizzle-orm/node-postgres'
// @ts-ignore -- `pg` ships without bundled types and @types/pg is not installed
import pg from 'pg'
import * as schema from '../../db/schema.ts'

const url = process.env.TEST_DATABASE_URL
if (!url) throw new Error('TEST_DATABASE_URL is required for integration tests')
const dbName = decodeURIComponent(new URL(url).pathname.slice(1))
if (!/test/i.test(dbName)) throw new Error(`Refusing to run against database "${dbName}": its name must contain "test"`)

export const pool = new pg.Pool({ connectionString: url, max: 5 })
export const db = drizzle({ client: pool, schema })

export * from '../../db/schema.ts'
