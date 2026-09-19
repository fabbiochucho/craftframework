import { defineConfig } from 'drizzle-kit'

// `out` MUST be netlify/database/migrations so Netlify applies migrations
// automatically at deploy time.
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: 'netlify/database/migrations',
})
