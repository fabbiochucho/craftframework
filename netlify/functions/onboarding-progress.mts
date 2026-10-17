import type { Config } from '@netlify/functions'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { onboardingProgress } from '../../db/schema.js'
import { forbidden, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { logger } from '../lib/logger.js'
import { sendWelcomeEmailOnce } from '../lib/welcome-email.js'
import { onboardingStepName } from '../../src/lib/onboardingProgress.js'

// /api/onboarding-progress — records how far the signed-in person got in /onboarding: the step number and
// name and when, never what they typed. The person is always the verified caller, never a body field.
//   PUT { step: 1..3, completed?: true }
const bodySchema = z.object({ step: z.number().int().min(1).max(3), completed: z.boolean().optional() }).strict()

export default async (req: Request) => {
  try {
    if (req.method !== 'PUT') return new Response('Method Not Allowed', { status: 405 })
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    if (caller.readOnly) return forbidden()
    const origin = req.headers.get('origin')
    if (origin && origin !== new URL(req.url).origin) return forbidden()
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: 'Invalid request body' }, { status: 400 })
    const { step, completed } = parsed.data
    const now = new Date()
    // The furthest step reached is kept: going Back never lowers it. Completion is final.
    await db.insert(onboardingProgress).values({
      email: caller.email, step: completed ? 3 : step, stepName: onboardingStepName(completed ? 3 : step)!,
      startedAt: now, lastActivityAt: now, completedAt: completed ? now : null,
    }).onConflictDoUpdate({
      target: onboardingProgress.email,
      set: {
        step: sql`greatest(${onboardingProgress.step}, ${completed ? 3 : step})`,
        stepName: sql`case when greatest(${onboardingProgress.step}, ${completed ? 3 : step}) = ${onboardingProgress.step} then ${onboardingProgress.stepName} else ${onboardingStepName(completed ? 3 : step)!} end`,
        lastActivityAt: now,
        completedAt: sql`coalesce(${onboardingProgress.completedAt}, ${completed ? now : null})`,
      },
    })
    // First completion sends the welcome email (claimed once; never fails the request).
    if (completed) await sendWelcomeEmailOnce(caller)
    return Response.json({ ok: true })
  } catch (err) {
    logger.error('/api/onboarding-progress', 'failed', err)
    return Response.json({ error: 'Progress request failed' }, { status: 500 })
  }
}

export const config: Config = { path: '/api/onboarding-progress' }
