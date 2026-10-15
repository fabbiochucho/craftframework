import type { Config } from '@netlify/functions'
import { runEncryptionBackfill } from '../lib/encryption-backfill.js'
import { logger } from '../lib/logger.js'

// Daily: encrypt any field that should be encrypted at rest but is still plaintext. A no-op once
// everything is encrypted; logs an error if FIELD_ENCRYPTION_KEY is missing so misconfiguration is visible.
export default async () => {
  try {
    const counts = await runEncryptionBackfill()
    logger.info('encryption-backfill', `rows encrypted: ${JSON.stringify(counts)}`)
  } catch (err) {
    logger.error('encryption-backfill', 'failed', err)
  }
}

export const config: Config = { schedule: '@daily' }
