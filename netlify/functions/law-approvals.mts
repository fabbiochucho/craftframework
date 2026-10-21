import type { Config } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, lawApprovals } from '../../db/schema.js'
import { forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger, monitored } from '../lib/logger.js'

// /api/law-approvals — which jurisdictions' law entries a Super Admin has approved for organisation reports.
//   GET                          any signed-in user: the approved jurisdictions
//   POST    { jurisdiction, registerVersion }   Super Admin (MFA): approve a jurisdiction
//   DELETE  /api/law-approvals/:jurisdiction    Super Admin (MFA): revoke an approval

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const JURISDICTION = /^[A-Z]{2}$/
const approveSchema = z.object({
  jurisdiction: z.string().regex(JURISDICTION),
  registerVersion: z.string().trim().min(1).max(60),
}).strict()

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/law-approvals\/?/, '')

    if (req.method === 'GET' && sub === '') {
      const rows = await db.select().from(lawApprovals)
      // The approver's address is personal data; only Super Admins see it.
      const admin = isSuperAdmin(caller.email) && caller.role === 'super_admin'
      return json({ approvals: rows.map((r) => ({ jurisdiction: r.jurisdiction, registerVersion: r.registerVersion, approvedAt: r.approvedAt, ...(admin ? { approvedBy: r.approvedBy } : {}) })) })
    }

    // Changes: Super Admin only (the server allowlist, never a client field), same-origin, with MFA.
    if (!isSuperAdmin(caller.email) || caller.role !== 'super_admin' || caller.readOnly) return forbidden()
    const origin = req.headers.get('origin')
    if (origin && origin !== url.origin) return forbidden()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock

    if (req.method === 'POST' && sub === '') {
      const parsed = approveSchema.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return json({ error: 'Send a two-letter jurisdiction code and the register version.' }, 400)
      const { jurisdiction, registerVersion } = parsed.data
      // The approval and its audit row stand or fall together.
      await db.transaction(async (tx) => {
        await tx.insert(lawApprovals).values({ jurisdiction, approvedBy: caller.email, registerVersion })
          .onConflictDoUpdate({ target: lawApprovals.jurisdiction, set: { approvedBy: caller.email, registerVersion, approvedAt: new Date() } })
        await tx.insert(auditLogs).values({ actor: caller.email, action: `Approved laws register entries (${registerVersion})`, target: jurisdiction, category: 'Config' })
      })
      return json({ ok: true })
    }

    if (req.method === 'DELETE' && JURISDICTION.test(sub)) {
      await db.transaction(async (tx) => {
        const gone = await tx.delete(lawApprovals).where(eq(lawApprovals.jurisdiction, sub)).returning({ j: lawApprovals.jurisdiction })
        if (gone.length) await tx.insert(auditLogs).values({ actor: caller.email, action: 'Revoked laws register approval', target: sub, category: 'Config' })
      })
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('law-approvals', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/law-approvals', '/api/law-approvals/*'] }

export default monitored(handleRequest)
