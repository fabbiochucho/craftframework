import type { Config } from '@netlify/functions'
import { and, asc, eq, isNotNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, featureSwitches, networks, organizations, users } from '../../db/schema.js'
import { forbidden, isSuperAdmin, mfaRequired, resolveCaller, unauthorized } from '../lib/auth.js'
import { clearSwitchCache, effectiveFor, loadSwitches, whoFor } from '../lib/feature-gate.js'
import { logger, monitored } from '../lib/logger.js'
import { decide, FEATURE_KEYS, FEATURES, SCOPES } from '../../src/lib/features.js'

// /api/features — feature switches (rules in src/lib/features.ts).
//   GET                    anyone (signed out: settings for everyone only): which features are on for them { features: { key: { enabled, reason } } }
//   GET    admin           Super Admin (MFA): the features, every switch, and the values each scope can take
//   PUT    admin           Super Admin (MFA): set a switch { feature, scope, scopeId, enabled, reason, expiresAt? }
//   DELETE admin           Super Admin (MFA): remove a switch { feature, scope, scopeId }
//   GET    check?email=&orgId=   Super Admin (MFA): "check as": each feature's decision for that person, and which rule decided it

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const target = { feature: z.enum(FEATURE_KEYS as [string, ...string[]]), scope: z.enum(SCOPES), scopeId: z.string().trim().max(254) }
const setSchema = z.object({ ...target, enabled: z.boolean(), reason: z.string().trim().min(3).max(300), expiresAt: z.string().datetime({ offset: true }).nullable().optional() }).strict()
  .refine((s) => (s.scope === 'global') === (s.scopeId === ''), 'Everyone takes no target; every other scope needs one')
const removeSchema = z.object({ ...target }).strict()

const handleRequest = async (req: Request) => {
  try {
    const caller = await resolveCaller()
    const url = new URL(req.url)
    const sub = url.pathname.replace(/^\/api\/features\/?/, '')

    if (req.method === 'GET' && sub === '') {
      // Signed out: only settings for everyone can apply.
      const all = await effectiveFor(caller ?? { email: '', orgId: '', role: '' })
      return json({ features: Object.fromEntries(Object.entries(all).map(([k, d]) => [k, { enabled: d.enabled, reason: d.reason }])) })
    }

    if (!caller) return unauthorized()
    if (!isSuperAdmin(caller.email) || caller.role !== 'super_admin' || caller.readOnly) return forbidden()
    const origin = req.headers.get('origin')
    if (req.method !== 'GET' && origin && origin !== url.origin) return forbidden()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock

    if (req.method === 'GET' && sub === 'admin') {
      const [rows, archetypes, countries, nets] = await Promise.all([
        db.select().from(featureSwitches).orderBy(asc(featureSwitches.feature), asc(featureSwitches.scope)),
        db.selectDistinct({ v: organizations.archetype }).from(organizations).where(and(isNotNull(organizations.archetype), ne(organizations.archetype, ''))),
        db.selectDistinct({ v: organizations.country }).from(organizations).where(ne(organizations.country, '')),
        db.select({ id: networks.id, name: networks.name }).from(networks).where(eq(networks.status, 'active')).orderBy(asc(networks.name)),
      ])
      return json({
        features: FEATURES.map(({ key, label, description }) => ({ key, label, description })),
        switches: rows.map((r) => ({ ...r, setAt: r.setAt.toISOString(), expiresAt: r.expiresAt?.toISOString() ?? null })),
        options: { archetype: archetypes.map((a) => a.v!).sort(), country: countries.map((c) => c.v).sort(), network: nets },
      })
    }

    if (req.method === 'GET' && sub === 'check') {
      const email = (url.searchParams.get('email') ?? '').trim().toLowerCase()
      let orgId = (url.searchParams.get('orgId') ?? '').trim()
      if (!email && !orgId) return json({ error: 'Give an email or an organisation id.' }, 400)
      if (email && !orgId) {
        const [u] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.email, email))
        orgId = u?.orgId ?? ''
      }
      const who = await whoFor(email, orgId)
      const switches = await loadSwitches()
      return json({ who, decisions: Object.fromEntries(FEATURES.map((f) => [f.key, decide(f.key, who, switches)])) })
    }

    if (req.method === 'PUT' && sub === 'admin') {
      const p = setSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Choose a feature and who it applies to, say on or off, and give a reason (3 to 300 characters).' }, 400)
      const s = { ...p.data, scopeId: p.data.scope === 'user' ? p.data.scopeId.toLowerCase() : p.data.scopeId }
      const values = { enabled: s.enabled, reason: s.reason, setBy: caller.email, setAt: new Date(), expiresAt: s.expiresAt ? new Date(s.expiresAt) : null }
      await db.transaction(async (tx) => {
        await tx.insert(featureSwitches).values({ feature: s.feature, scope: s.scope, scopeId: s.scopeId, ...values })
          .onConflictDoUpdate({ target: [featureSwitches.feature, featureSwitches.scope, featureSwitches.scopeId], set: values })
        await tx.insert(auditLogs).values({ actor: caller.email, action: `Switched ${s.feature} ${s.enabled ? 'on' : 'off'} (${s.reason})`, target: `${s.scope}${s.scopeId ? `:${s.scopeId}` : ''}`, category: 'Config' })
      })
      clearSwitchCache()
      return json({ ok: true })
    }

    if (req.method === 'DELETE' && sub === 'admin') {
      const p = removeSchema.safeParse(await req.json().catch(() => null))
      if (!p.success) return json({ error: 'Say which switch to remove.' }, 400)
      const { feature, scope, scopeId } = p.data
      await db.transaction(async (tx) => {
        const gone = await tx.delete(featureSwitches).where(and(eq(featureSwitches.feature, feature), eq(featureSwitches.scope, scope), eq(featureSwitches.scopeId, scopeId))).returning({ id: featureSwitches.id })
        if (gone.length) await tx.insert(auditLogs).values({ actor: caller.email, action: `Removed the ${feature} switch`, target: `${scope}${scopeId ? `:${scopeId}` : ''}`, category: 'Config' })
      })
      clearSwitchCache()
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    logger.error('features', 'request failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

export const config: Config = { path: ['/api/features', '/api/features/*'] }

export default monitored(handleRequest)
