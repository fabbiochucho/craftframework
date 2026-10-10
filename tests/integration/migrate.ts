// Applies every repo migration (netlify/database/migrations, in order) to a
// freshly-recreated schema in TEST_DATABASE_URL, exactly as the platform does
// at deploy time. Run before the integration suites.
import { applyMigrations, pool } from './harness.ts'

const count = await applyMigrations()
console.log(`integration: applied ${count} migrations`)
await pool.end()
