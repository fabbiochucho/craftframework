// Shared harness for the workspace-api integration tests. It builds real
// `Request` objects and calls the real route-table handler against a real
// Postgres (see hooks.mjs for how the platform modules are swapped out).
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// The runtime hooks redirect this import to the test pool; TS cannot see that.
// @ts-ignore -- resolved by tests/integration/hooks.mjs
import { pool } from './testDb.ts'

// Keys are generated at runtime so no credential-shaped value is ever committed.
process.env.FIELD_ENCRYPTION_KEY ??= randomBytes(32).toString('base64')
delete process.env.SENDGRID_API_KEY
delete process.env.SENDGRID_FROM_EMAIL
delete process.env.GITHUB_TOKEN
delete process.env.RESEND_API_KEY

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const migrationsDir = path.join(repoRoot, 'netlify/database/migrations')
export { pool }

// --- database lifecycle -------------------------------------------------------
export async function applyMigrations(): Promise<number> {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
  await pool.query('CREATE SCHEMA public')
  const dirs = readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  for (const dir of dirs) {
    const sql = readFileSync(path.join(migrationsDir, dir, 'migration.sql'), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await pool.query(statement)
    }
  }
  return dirs.length
}

export async function truncateAll(): Promise<void> {
  const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
  const tables = rows.map((r: { tablename: string }) => `"${r.tablename}"`).join(', ')
  if (tables) await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`)
  blobStores().clear()
}

export async function rows<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows
}

export const blobStores = (): Map<string, Map<string, { bytes: Buffer; metadata?: unknown }>> =>
  ((globalThis as any).__craftTestBlobs ??= new Map())

// --- handler invocation -------------------------------------------------------
type Handler = (req: Request) => Promise<Response>
const instances = new Map<string, Handler>()
const handlerUrl = new URL('../../netlify/functions/workspace-api.mts', import.meta.url).href

// A distinct `instance` re-evaluates the handler module, i.e. a separate
// function instance with its own module-level state (used to prove the rate
// limiter is Postgres-backed rather than in-memory).
export async function loadHandler(instance = 'default'): Promise<Handler> {
  let h = instances.get(instance)
  if (!h) {
    h = (await import(`${handlerUrl}?instance=${instance}`)).default as Handler
    instances.set(instance, h)
  }
  return h
}

export type Res = { status: number; headers: Headers; body: any; text: string; raw: ArrayBuffer }
export type CallOpts = { json?: unknown; form?: FormData; ip?: string; instance?: string; headers?: Record<string, string> }

export async function call(user: string | null, method: string, apiPath: string, opts: CallOpts = {}): Promise<Res> {
  ;(globalThis as any).__craftTestIdentity = user ? { email: user, name: user } : null
  const headers: Record<string, string> = { 'x-nf-client-connection-ip': opts.ip ?? '203.0.113.7', ...opts.headers }
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.json)
  }
  const handler = await loadHandler(opts.instance)
  const res = await handler(new Request(`http://localhost/api${apiPath}`, { method, headers, body }))
  const raw = await res.arrayBuffer()
  const text = Buffer.from(raw).toString('utf8')
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* binary or csv */ }
  return { status: res.status, headers: res.headers, body: parsed, text, raw }
}

export function as(user: string | null, defaults: { ip?: string } = {}) {
  const run = (method: string, p: string, opts: CallOpts = {}) => call(user, method, p, { ...defaults, ...opts })
  return {
    get: (p: string, o?: CallOpts) => run('GET', p, o),
    post: (p: string, json?: unknown, o?: CallOpts) => run('POST', p, { ...o, json }),
    put: (p: string, json?: unknown, o?: CallOpts) => run('PUT', p, { ...o, json }),
    del: (p: string, o?: CallOpts) => run('DELETE', p, o),
    upload: (p: string, file: File, fields: Record<string, string> = {}) => {
      const form = new FormData()
      form.set('file', file)
      for (const [k, v] of Object.entries(fields)) form.set(k, v)
      return run('POST', p, { form })
    },
  }
}

export function expectStatus(res: Res, status: number, label = ''): Res {
  assert.equal(res.status, status, `${label} expected ${status}, got ${res.status}: ${res.text.slice(0, 300)}`)
  return res
}

// --- fetch guard ----------------------------------------------------------------
// Real outbound HTTP is never allowed in tests; tests that exercise SendGrid
// install a mock explicitly.
const realFetch = globalThis.fetch
export type FetchCall = { url: string; init?: RequestInit }
export function installFetchMock(respond: (c: FetchCall) => Response = () => new Response('{}', { status: 202 })) {
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const call = { url: String(input?.url ?? input), init }
    calls.push(call)
    return respond(call)
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = guardedFetch } }
}
const guardedFetch = (async (input: any) => {
  throw new Error(`Unexpected outbound fetch in integration test: ${String(input?.url ?? input)}`)
}) as typeof fetch
globalThis.fetch = guardedFetch
export { realFetch }

// --- fixtures --------------------------------------------------------------------
export const OWNER = 'owner@acme.example'
export const ADMIN = 'admin@acme.example'
export const ASSESSOR = 'assessor@acme.example'
export const VIEWER = 'viewer@acme.example'
export const OUTSIDER = 'outsider@other.example'

export type OrgFixture = { orgId: number; wsId: number }

// Creates an org through the API (so the creator becomes owner), then adds the
// admin/assessor/viewer members through the owner-only member route.
export async function createOrg(name = 'Acme Org', owner = OWNER, members: Record<string, string> = {
  [ADMIN]: 'admin', [ASSESSOR]: 'assessor', [VIEWER]: 'viewer',
}): Promise<OrgFixture> {
  const res = expectStatus(await as(owner).post('/orgs', { name, type: 'ngo', country: 'KE' }), 201, 'create org')
  const orgId = res.body.id as number
  for (const [email, role] of Object.entries(members)) {
    expectStatus(await as(owner).post(`/orgs/${orgId}/members`, { email, role }), 201, `add ${role}`)
  }
  return { orgId, wsId: res.body.defaultWorkspaceId as number }
}

export async function createAssessment(wsId: number, user = ASSESSOR): Promise<number> {
  return expectStatus(await as(user).post(`/workspaces/${wsId}/assessments`, { assessmentType: 'G2G' }), 201, 'create assessment').body.id
}

export async function createCap(wsId: number, user = ASSESSOR, extra: Record<string, unknown> = {}): Promise<number> {
  return expectStatus(await as(user).post(`/workspaces/${wsId}/cap`, {
    sourceType: 'manual', findingDescription: 'Missing procurement policy', severity: 'high', correctiveAction: 'Adopt policy', ...extra,
  }), 201, 'create cap').body.id
}

export const pdfFile = (name = 'policy.pdf', size = 64) =>
  new File([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size, 0x20)])], name, { type: 'application/pdf' })

export async function uploadEvidence(wsId: number, user = ASSESSOR, file = pdfFile()): Promise<number> {
  return expectStatus(await as(user).upload(`/workspaces/${wsId}/evidence/upload`, file, { documentType: 'policy' }), 201, 'upload').body.id
}

export async function auditCount(where: string, params: unknown[] = []): Promise<number> {
  return Number((await rows(`SELECT count(*)::int AS n FROM ws_audit_log WHERE ${where}`, params))[0].n)
}
