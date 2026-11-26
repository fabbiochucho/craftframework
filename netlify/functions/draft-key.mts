import type { Config } from '@netlify/functions'
import { hkdfSync } from 'node:crypto'
import { resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'

// /api/draft-key — the key a signed-in person's browser uses to encrypt answers it is still holding for them
// (src/lib/draftVault.ts). It is derived, never stored: the same person always gets the same key, so drafts left on
// a shared computer stay unreadable until that person signs in again, and survive sign-out without being erased.
// Rotating DRAFT_KEY_SECRET (or FIELD_ENCRYPTION_KEY when it is unset) makes older unsent drafts unreadable.
const DEV_SECRET = 'craft-local-development-draft-secret'

function secret(): string {
  const configured = process.env.DRAFT_KEY_SECRET || process.env.FIELD_ENCRYPTION_KEY
  if (configured) return configured
  if (process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production') throw new Error('DRAFT_KEY_SECRET or FIELD_ENCRYPTION_KEY is required in production')
  return DEV_SECRET
}

export function draftKeyFor(email: string): string {
  return Buffer.from(hkdfSync('sha256', secret(), 'craft-draft-key-v1', email.trim().toLowerCase(), 32)).toString('base64')
}

const handleRequest = async (req: Request) => {
  try {
    if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 })
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    return Response.json({ key: draftKeyFor(caller.email) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logger.error('draft-key', 'request failed', error)
    return Response.json({ error: 'Draft key unavailable.' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/draft-key' }
export default monitored(handleRequest)
