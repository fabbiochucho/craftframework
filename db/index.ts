// Drizzle client backed by the native Netlify Database adapter. The connection
// is configured automatically by the platform — no connection string needed.
import { drizzle } from 'drizzle-orm/netlify-db'

export const db = drizzle()

export * from './schema.js'
