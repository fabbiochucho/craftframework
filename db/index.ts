// Drizzle client backed by the native Netlify Database adapter. The connection
// is configured automatically by the platform — no connection string needed.
import { drizzle } from 'drizzle-orm/netlify-db'
import * as schema from './schema.js'

export const db = drizzle({ schema })

export * from './schema.js'
