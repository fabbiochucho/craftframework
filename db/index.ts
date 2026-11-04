// Drizzle client backed by the native Netlify Database adapter. The connection
// is configured automatically by the platform — no connection string needed.
import { Pool, neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/netlify-db'
import { neonHttpCompat } from './neonCompat.js'

// Same as drizzle()'s own setup, except the Neon HTTP client goes through neonHttpCompat (see that file).
const url = process.env.NETLIFY_DB_URL
export const db = !url || process.env.NETLIFY_DB_DRIVER === 'server'
  ? drizzle()
  : drizzle({ client: { http: neonHttpCompat(neon(url)), pool: new Pool({ connectionString: url }) } })

export * from './schema.js'
