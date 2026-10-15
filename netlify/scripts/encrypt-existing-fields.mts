// Manual run of the encrypted-field backfill: `npm run crypto:backfill` (add `-- --rotate` after a key rotation).
// The same backfill also runs daily as the `encryption-backfill` scheduled function.
import { runEncryptionBackfill } from '../lib/encryption-backfill.js'

const counts = await runEncryptionBackfill({ rotate: process.argv.includes('--rotate') })
console.log('Encrypted-field backfill complete', counts)
