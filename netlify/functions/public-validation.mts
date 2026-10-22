import type { Config } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, validationConcerns, validations } from '../../db/schema.js'
import { logger, monitored } from '../lib/logger.js'
import { buildPublicView, ensureStatement, publicUrlFor } from '../lib/public-validation.js'
import { clientIp, overLimit } from '../lib/public-rate-limit.js'
import { sendReminderEmail } from '../lib/reminder-email.js'
import { CONCERN_CATEGORIES, normaliseVerificationId } from '../../src/lib/validationStatement.js'

// /api/public/validation/:verificationId — the PUBLIC verification of an issued validation (PR 6).
// No sign-in. There is NO list or search: a validation is found only by its random ID (or the QR on its PDF).
//
//   GET  /:id                 the public view (see netlify/lib/public-validation.ts for exactly what it holds)
//   GET  /:id/statement.pdf   the issued statement PDF (its SHA-256 is shown on the page)
//   POST /:id/concern         "report a concern": stored for the CRAFT programme team; rate-limited
//
// Never exposed here: indicator scores, evidence, validator comments, contact details.

const headers = { 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex, nofollow' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers })
const notFound = () => json({ error: 'No validation found with that ID' }, 404)
const concernSchema = z.object({
  category: z.enum(CONCERN_CATEGORIES),
  message: z.string().trim().min(10).max(4000),
  name: z.string().trim().max(200).optional(),
  email: z.union([z.literal(''), z.string().trim().email().max(200)]).optional(),
  website: z.string().max(200).optional(), // honeypot: real people leave it empty
})

const handleRequest = async (req: Request) => {
  try {
    const url = new URL(req.url)
    const [rawId, sub] = url.pathname.replace(/^\/api\/public\/validation\/?/, '').split('/').filter(Boolean)
    const ip = clientIp(req)
    // Lookups are cheap but enumerable: slow anyone trying IDs. Concerns are tighter still.
    if (await overLimit(`pv:${ip}`, 60)) return json({ error: 'Too many requests' }, 429)
    const id = normaliseVerificationId(rawId)
    if (!id) return notFound()
    const [v] = await db.select().from(validations).where(eq(validations.verificationId, id))
    if (!v) return notFound()

    if (req.method === 'GET' && !sub) {
      const view = await buildPublicView(v)
      if (!view) return notFound()
      const statement = await ensureStatement(v)
      return json({ ...view, pdf: statement ? { sha256: statement.sha256, url: `/api/public/validation/${id}/statement.pdf` } : null, verifyUrl: publicUrlFor(id) })
    }

    if (req.method === 'GET' && sub === 'statement.pdf') {
      const statement = await ensureStatement(v)
      if (!statement) return notFound()
      return new Response(Buffer.from(statement.bytes), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${id}-statement.pdf"`, 'Cache-Control': 'public, max-age=3600' } })
    }

    if (req.method === 'POST' && sub === 'concern') {
      if (await overLimit(`pvc:${ip}`, 5)) return json({ error: 'Too many reports from this connection. Please try again later.' }, 429)
      const body = await req.json().catch(() => null)
      const p = concernSchema.safeParse(body)
      if (!p.success) return json({ error: 'Choose what your concern is about and describe it (at least 10 characters)' }, 400)
      if (p.data.website) return json({ ok: true }, 201) // bot: pretend it worked, store nothing
      const concernId = `con_${crypto.randomUUID()}`
      await db.insert(validationConcerns).values({
        id: concernId, validationId: v.id, category: p.data.category, message: p.data.message, contactName: p.data.name ?? '', contactEmail: p.data.email ?? '',
      })
      await db.insert(auditLogs).values({ actor: 'public', action: `concern raised (${p.data.category})`, target: concernId, category: 'Validation', orgId: v.orgId })
      const to = process.env.CONCERNS_TO_EMAIL
      if (to) {
        await sendReminderEmail({ to, subject: `CRAFT validation concern: ${id}`, text: `A concern was raised about ${id} (${p.data.category}).\n\n${p.data.message}\n\nSign in to CRAFT to review it.` }, `concern-${concernId}`, 'validation_concern')
          .catch((err) => logger.error('public-validation', 'concern email failed', err))
      }
      return json({ ok: true }, 201)
    }

    return notFound()
  } catch (err) {
    logger.error('/api/public/validation', 'failed', err)
    return json({ error: 'Verification is temporarily unavailable' }, 500)
  }
}

export const config: Config = { path: ['/api/public/validation/*'] }

export default monitored(handleRequest)
