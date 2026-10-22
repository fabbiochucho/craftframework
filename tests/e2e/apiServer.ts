// Test-only API server for the browser E2E suite. It runs the REAL
// `netlify/functions/workspace-api.mts` handler against a real Postgres
// (TEST_DATABASE_URL) and exposes it over HTTP so Playwright can forward the
// app's `/api/*` calls to it.
//
// Sign-in is a test-only path that lives entirely in this file and in the
// Playwright fixtures: the caller identity is read from the `nf_jwt` cookie the
// browser holds (an unsigned, runtime-generated token). Production never loads
// this server, the stubs or the module hooks, and the hooks refuse to load on
// Netlify / NODE_ENV=production. The real function keeps verifying Netlify
// Identity sessions, so no production auth is weakened.
import http from 'node:http'
// @ts-ignore -- resolved at runtime by tests/integration/hooks.mjs
import { applyMigrations, loadHandler, placeholderQuestionBank, rows, truncateAll } from '../integration/harness.ts'

// The app and API are same-origin in production; mirror that for the origin check.
const WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:3000'
const PORT = Number(process.env.E2E_API_PORT ?? 8899)
// The resume-onboarding emails need these; no email provider key is set, so previews work and sending reports 'not configured'.
process.env.ONBOARDING_OPTOUT_SECRET ??= 'e2e-optout-secret-not-a-credential'
process.env.APP_URL ??= WEB_ORIGIN

function identityFromCookie(header: string | undefined): { id: string; email: string; name: string } | null {
  const token = /(?:^|;\s*)nf_jwt=([^;]+)/.exec(header ?? '')?.[1]
  if (!token) return null
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof claims.email === 'string' && typeof claims.sub === 'string' && claims.exp * 1000 > Date.now()
      ? { id: claims.sub, email: claims.email, name: claims.email } : null
  } catch {
    return null
  }
}

await applyMigrations()
placeholderQuestionBank()
const handler = await loadHandler('e2e')
const als = (globalThis as any).__craftTestIdentityAls
const legacyHandlers = new Map<string, (request: Request) => Promise<Response>>()
for (const name of [
  'legacy-state', 'organizations', 'responses', 'response-notes', 'presigned-url', 'data-room-upload',
  'users', 'questions', 'compliance', 'audit', 'capacity-actions', 'access-grants',
]) {
  const module = await import(new URL(`../../netlify/functions/${name}.mts`, import.meta.url).href)
  legacyHandlers.set(`/api/${name}`, module.default)
}

// Public (no sign-in) validation verification endpoints, matched by prefix.
const publicValidation = (await import(new URL('../../netlify/functions/public-validation.mts', import.meta.url).href)).default
const validationsHandler = (await import(new URL('../../netlify/functions/validations.mts', import.meta.url).href)).default
const directoryHandler = (await import(new URL('../../netlify/functions/directory.mts', import.meta.url).href)).default
const panelHandler = (await import(new URL('../../netlify/functions/review-panel.mts', import.meta.url).href)).default
const analyticsHandler = (await import(new URL('../../netlify/functions/admin-analytics.mts', import.meta.url).href)).default
const progressHandler = (await import(new URL('../../netlify/functions/onboarding-progress.mts', import.meta.url).href)).default
const lifecyclePublicHandler = (await import(new URL('../../netlify/functions/lifecycle-public.mts', import.meta.url).href)).default
const lifecycleAdminHandler = (await import(new URL('../../netlify/functions/admin-lifecycle.mts', import.meta.url).href)).default
const qualityHandler = (await import(new URL('../../netlify/functions/validator-quality.mts', import.meta.url).href)).default

// Test-only: runs a real engagement -> review -> finalise flow through the real handlers so the
// browser test can open the public verification page of a validation that exists. Returns its ID.
async function seedValidation(opts: { orgEmail?: string; qualify?: boolean } = {}): Promise<{ verificationId: string; funderEmail: string; validatorEmail: string }> {
  const load = async (n: string) => (await import(new URL(`../../netlify/functions/${n}.mts`, import.meta.url).href)).default
  const [directory, engagements, reviews, firms] = await Promise.all([load('directory'), load('engagements'), load('validation-reviews'), load('firms')])
  const call = async (email: string, h: (r: Request) => Promise<Response>, method: string, path: string, body?: unknown) => {
    const response: Response = await als.run({ id: `e2e-${email}`, email, name: email }, () => h(new Request(`${WEB_ORIGIN}/api/${path}`, {
      method, headers: { 'content-type': 'application/json', origin: WEB_ORIGIN }, body: body === undefined ? undefined : JSON.stringify(body),
    })))
    const text = await response.text()
    if (!response.ok) throw new Error(`seed ${method} ${path} -> ${response.status} ${text}`)
    return text ? JSON.parse(text) : null
  }
  const ORG = opts.orgEmail ?? 'e2e@acme.example'
  const VAL = 'e2e-validator@validators.example'
  const FUNDER = 'e2e-funder@capital.example'
  // A browser session's tenant is self_<email>; use it so the page and the server agree on the organisation.
  const ORG_ID = opts.orgEmail ? `self_${opts.orgEmail.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'org_e2e'
  await rows(`INSERT INTO organizations(id,name,country,sector,email) VALUES('${ORG_ID}','Riverbend Cooperative','Kenya','Agriculture','info@riverbend.example') ON CONFLICT (id) DO NOTHING`)
  await rows(`INSERT INTO users(id,email,org_id,role) VALUES('e2e-org','${ORG}','${ORG_ID}','admin') ON CONFLICT (email) DO UPDATE SET org_id = EXCLUDED.org_id, role = 'admin'`)
  await call(FUNDER, firms, 'POST', 'firms', { name: 'Savannah Capital', kind: 'funding_partner', nature: 'DFI' })
  const { id: valId } = await call(VAL, directory, 'PUT', 'directory/me/validator', { name: 'Valerie Okafor' })
  await call(VAL, directory, 'POST', 'directory/me/credentials', { body: 'ICAN', membershipNumber: 'ICAN-4411' })
  await rows("UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year'")
  const { id } = await call(ORG, engagements, 'POST', 'engagements', { side: 'organization', type: 'independent_validation', validatorId: valId })
  await call(VAL, engagements, 'POST', `engagements/${id}/respond`, { side: 'validator', decision: 'accept' })
  await call(VAL, engagements, 'POST', `engagements/${id}/declaration`, { confirmed: true, signedName: 'Valerie Okafor' })
  await call(VAL, reviews, 'PUT', `validation-reviews/${id}/setup`, { method: 'site_visit', fieldworkStart: '2026-01-05', fieldworkEnd: '2026-01-09' })
  const { FRAMEWORKS } = await import('../../src/lib/validationReview.ts')
  for (const ind of FRAMEWORKS['capital-readiness'].indicators) {
    await call(VAL, reviews, 'PUT', `validation-reviews/${id}/scores/${ind.id}`, { score: 4, sufficiency: 'sufficient', comment: 'PRIVATE-COMMENT' })
  }
  if (opts.qualify) await call(VAL, reviews, 'POST', `validation-reviews/${id}/qualifications`, { text: 'Board minutes are incomplete', indicatorIds: [FRAMEWORKS['capital-readiness'].indicators[1].id] })
  await call(VAL, reviews, 'POST', `validation-reviews/${id}/finalise`, { outcome: opts.qualify ? 'validated_with_qualifications' : 'validated' })
  return { verificationId: (await rows('SELECT verification_id FROM validations ORDER BY created_at DESC'))[0].verification_id, funderEmail: FUNDER, validatorEmail: VAL }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
    if (url.pathname === '/__test/reset' && req.method === 'POST') {
      await truncateAll()
      res.writeHead(204).end()
      return
    }
    if (url.pathname === '/__test/seed-validation' && req.method === 'POST') {
      const seeded = await seedValidation({ orgEmail: url.searchParams.get('org') ?? undefined, qualify: url.searchParams.get('qualify') === '1' })
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(seeded))
      return
    }
    if (url.pathname === '/__test/seed-panel' && req.method === 'POST') {
      // A convenor from the programme team and two accredited reviewers on the volunteer roster.
      const load = async (n: string) => (await import(new URL(`../../netlify/functions/${n}.mts`, import.meta.url).href)).default
      const directory = await load('directory')
      for (const [email, name] of [['e2e-reviewer1@panel.example', 'Rita Reviewer'], ['e2e-reviewer2@panel.example', 'Ravi Reviewer']]) {
        await als.run({ id: `e2e-${email}`, email, name: email }, () => directory(new Request(`${WEB_ORIGIN}/api/directory/me/validator`, {
          method: 'PUT', headers: { 'content-type': 'application/json', origin: WEB_ORIGIN }, body: JSON.stringify({ name }),
        })))
        await rows(`UPDATE validator_profiles SET accreditation_status='accredited', accredited_until = now() + interval '1 year' WHERE email=$1`, [email])
        await rows(`INSERT INTO panel_roster(email, name, kind, added_by) VALUES($1,$2,'senior_validator','e2e') ON CONFLICT (email) DO NOTHING`, [email, name])
      }
      await rows(`INSERT INTO training_staff(email, role, added_by) VALUES('e2e-convenor@craft.example','programme_team','e2e') ON CONFLICT (email) DO NOTHING`)
      res.writeHead(204).end()
      return
    }
    if (url.pathname === '/__test/seed-onboarding' && req.method === 'POST') {
      // People who started onboarding and stopped, for the Super Admin analytics spec.
      await rows(`INSERT INTO organizations(id,name,country) VALUES('self_amina','Riverbend Cooperative','Kenya') ON CONFLICT (id) DO NOTHING`)
      await rows(`INSERT INTO users(id,email,name,org_id,role) VALUES('e2e-amina','amina@riverbend.example','Amina Okoro','self_amina','assessor') ON CONFLICT (email) DO NOTHING`)
      await rows(`INSERT INTO onboarding_progress(email,step,step_name,started_at,last_activity_at) VALUES('amina@riverbend.example',2,'Donor Alignment', now() - interval '10 days', now() - interval '6 days') ON CONFLICT (email) DO NOTHING`)
      res.writeHead(204).end()
      return
    }
    if (url.pathname === '/__test/seed-lifecycle' && req.method === 'POST') {
      // A one-month email that was sent to someone, and the signed survey link inside it (the real token code).
      const { surveyToken, preferencesUrl } = await import('../../netlify/lib/lifecycle.ts')
      await rows(`INSERT INTO organizations(id,name,country) VALUES('self_amina','Riverbend Cooperative','Kenya') ON CONFLICT (id) DO NOTHING`)
      await rows(`INSERT INTO users(id,email,name,org_id,role) VALUES('e2e-amina','amina@riverbend.example','Amina Okoro','self_amina','assessor') ON CONFLICT (email) DO NOTHING`)
      await rows(`INSERT INTO onboarding_progress(email,step,step_name,completed_at) VALUES('amina@riverbend.example',3,'Team & Import', now() - interval '31 days') ON CONFLICT (email) DO NOTHING`)
      await rows(`INSERT INTO lifecycle_emails(id,idempotency_key,user_id,email,org_id,kind,occurrence,variant,outcome,sent_at) VALUES('lce_e2e','lifecycle-e2e-amina-feedback_1m-1','e2e-amina','amina@riverbend.example','self_amina','feedback_1m',1,'active','accepted', now()) ON CONFLICT DO NOTHING`)
      const token = surveyToken(process.env.ONBOARDING_OPTOUT_SECRET!, 'amina@riverbend.example', 'feedback_1m', 'lce_e2e', new Date())
      const prefsToken = preferencesUrl('', process.env.ONBOARDING_OPTOUT_SECRET!, 'amina@riverbend.example').split('?t=')[1]
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ token, prefsToken }))
      return
    }
    if (url.pathname === '/__test/ready') {
      res.writeHead(200).end('ok')
      return
    }
    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404).end('not found')
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
    headers.set('x-nf-client-connection-ip', '127.0.0.1')
    const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined
    const request = new Request(`${WEB_ORIGIN}${req.url}`, { method: req.method, headers, body })
    const routeHandler = url.pathname.startsWith('/api/public/validation/') ? publicValidation
      : url.pathname === '/api/validations' || url.pathname.startsWith('/api/validations/') ? validationsHandler
        : url.pathname === '/api/admin-analytics' || url.pathname.startsWith('/api/admin-analytics/') ? analyticsHandler
        : url.pathname.startsWith('/api/lifecycle/') ? lifecyclePublicHandler
        : url.pathname === '/api/admin-lifecycle' || url.pathname.startsWith('/api/admin-lifecycle/') ? lifecycleAdminHandler
        : url.pathname === '/api/onboarding-progress' ? progressHandler
        : url.pathname === '/api/directory' || url.pathname.startsWith('/api/directory/') ? directoryHandler
          : url.pathname === '/api/review-panel' || url.pathname.startsWith('/api/review-panel/') ? panelHandler
          : url.pathname === '/api/validator-quality' || url.pathname.startsWith('/api/validator-quality/') ? qualityHandler
            : (legacyHandlers.get(url.pathname) ?? handler)
    const response: Response = await als.run(identityFromCookie(req.headers.cookie), () => routeHandler(request))
    const out: Record<string, string> = {}
    response.headers.forEach((v, k) => { out[k] = v })
    res.writeHead(response.status, out).end(Buffer.from(await response.arrayBuffer()))
  } catch (err) {
    console.error('e2e api server error', err)
    res.writeHead(500).end('server error')
  }
})
server.listen(PORT, '127.0.0.1', () => console.log(`e2e api server listening on ${PORT}`))
