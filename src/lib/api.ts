// ============================================================================
// Client-side data access - thin fetch wrappers over the /api/* server routes
// backed by the Netlify Database (Drizzle). Every call is resilient: on any
// failure it logs and returns a safe fallback so the UI keeps working even when
// the database is briefly unreachable. These run only in the browser (event
// handlers / effects), never during SSR.
// ============================================================================

import type { Organization, AuditEntry, RiskStatus, Question, Portfolio } from './data'
import type { Obligation } from './obligations'

export async function fetchLegacyState<T>(orgId: string, key: string, signal?: AbortSignal): Promise<T | null> {
  const response = await jsonOrThrow(await fetch(`/api/legacy-state?orgId=${encodeURIComponent(orgId)}&key=${encodeURIComponent(key)}`, { cache: 'no-store', signal }))
  return response.value as T | null
}

export async function saveLegacyState<T>(orgId: string, key: string, value: T, signal?: AbortSignal): Promise<void> {
  await jsonOrThrow(await fetch('/api/legacy-state', {
    method: 'PUT',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orgId, key, value }),
  }))
}

export async function fetchResponseRecords(orgId: string): Promise<{ scores: Record<string, number>; details: Record<string, ResponseDetail> }> {
  return jsonOrThrow(await fetch(`/api/responses?orgId=${encodeURIComponent(orgId)}`, { cache: 'no-store' }))
}

async function jsonOrThrow(res: Response) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// --- Questions --------------------------------------------------------------
export async function fetchQuestions(): Promise<Question[] | null> {
  try {
    return (await jsonOrThrow(await fetch('/api/questions'))) as Question[]
  } catch (err) {
    console.warn('[api] fetchQuestions failed, using in-code bank', err)
    return null
  }
}

// --- Organizations ----------------------------------------------------------
export async function fetchOrganizations(createdBy?: string): Promise<Organization[]> {
  try {
    const qs = createdBy ? `?createdBy=${encodeURIComponent(createdBy)}` : ''
    const rows = (await jsonOrThrow(await fetch(`/api/organizations${qs}`))) as any[]
    return rows.map(normalizeOrg)
  } catch (err) {
    console.warn('[api] fetchOrganizations failed', err)
    return []
  }
}

export async function upsertOrganization(input: {
  id: string
  name: string
  country?: string
  targetDonor?: string
  email?: string
  reviewer?: string
  createdBy?: string
}): Promise<Organization | null> {
  try {
    const row = await jsonOrThrow(
      await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
    return normalizeOrg(row)
  } catch (err) {
    console.warn('[api] upsertOrganization failed', err)
    return null
  }
}

export async function updateOrganization(input: {
  id: string
  name?: string
  country?: string
  targetDonor?: string
  email?: string
  reviewer?: string
}): Promise<Organization | null> {
  try {
    const row = await jsonOrThrow(
      await fetch('/api/organizations', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
    return row ? normalizeOrg(row) : null
  } catch (err) {
    console.warn('[api] updateOrganization failed', err)
    return null
  }
}

export function deleteOrganization(id: string): void {
  void fetch(`/api/organizations?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(err =>
    console.warn('[api] deleteOrganization failed', err),
  )
}

function normalizeOrg(row: any): Organization {
  const date = (v: any) => (typeof v === 'string' ? v.slice(0, 10) : '')
  return {
    id: row.id,
    name: row.name,
    country: row.country ?? '',
    targetDonor: row.targetDonor ?? row.target_donor ?? '',
    email: row.email ?? '',
    createdAt: date(row.createdAt ?? row.created_at),
    lastUpdated: date(row.lastUpdated ?? row.last_updated),
    scores: {},
    reviewer: row.reviewer ?? undefined,
    status: (row.status as 'active' | 'archived') ?? 'active',
  }
}

// PATCH an institution's soft-archive status ('active' | 'archived'). Retains
// the record and its data; used by the archive/restore controls.
export function setOrganizationStatus(id: string, status: 'active' | 'archived'): void {
  void fetch('/api/organizations', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, status }),
  }).catch(err => console.warn('[api] setOrganizationStatus failed', err))
}

// --- User directory ---------------------------------------------------------
// The persistent "who is who" table (backed by /api/users). A person's org and
// role are assigned here, and sign-in reads it — see IdentityBridge.
export interface UserDirectoryRow {
  id: string
  email: string
  name: string
  title: string
  orgId: string | null
  role: string
  scopeId: string | null
  scopeLabel: string
  portfolioId: string | null
  status: string
  // ISO timestamp of the person's most recent sign-in (null if never recorded).
  lastSeenAt?: string | null
}

export async function fetchUserByEmail(email: string): Promise<UserDirectoryRow | null> {
  try {
    const row = await jsonOrThrow(await fetch(`/api/users?email=${encodeURIComponent(email)}`))
    return (row as UserDirectoryRow) ?? null
  } catch (err) {
    console.warn('[api] fetchUserByEmail failed', err)
    return null
  }
}

export async function fetchUsers(): Promise<UserDirectoryRow[]> {
  try {
    return (await jsonOrThrow(await fetch('/api/users'))) as UserDirectoryRow[]
  } catch (err) {
    console.warn('[api] fetchUsers failed', err)
    return []
  }
}

export async function upsertUser(input: {
  id?: string
  email: string
  name?: string
  title?: string
  orgId?: string | null
  role?: string
  scopeId?: string | null
  scopeLabel?: string
  portfolioId?: string | null
  status?: string
}): Promise<UserDirectoryRow | null> {
  try {
    const row = await jsonOrThrow(
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
    return row as UserDirectoryRow
  } catch (err) {
    console.warn('[api] upsertUser failed', err)
    return null
  }
}

export function deleteUser(email: string): void {
  void fetch(`/api/users?email=${encodeURIComponent(email)}`, { method: 'DELETE' }).catch(err =>
    console.warn('[api] deleteUser failed', err),
  )
}

// Record a sign-in in the user directory. Called by the IdentityBridge on every
// authenticated session so the Super Admin can see everyone who has signed in —
// not only people explicitly assigned. This never overwrites an admin's role/org
// assignment: the server only stamps last_seen_at (and backfills a blank name),
// or inserts a fresh unassigned row for a first-time signer.
export function recordSignIn(input: { email: string; name?: string; role?: string }): void {
  void fetch('/api/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, touch: true }),
  }).catch(err => console.warn('[api] recordSignIn failed', err))
}

// --- Responses (scores) -----------------------------------------------------
export async function fetchScores(orgId: string): Promise<Record<string, number>> {
  try {
    const data = await jsonOrThrow(await fetch(`/api/responses?orgId=${encodeURIComponent(orgId)}`))
    return (data?.scores as Record<string, number>) ?? {}
  } catch (err) {
    console.warn('[api] fetchScores failed', err)
    return {}
  }
}

// The Trust Delta detail fields stored alongside each self-score: the
// independent assessor score, the negotiated/validated score, and the
// mandatory consensus note recorded during a Facilitated Debrief.
export interface ResponseDetail {
  assessorScore?: number
  negotiatedScore?: number
  notes?: string
  evidenceUrl?: string
  evidenceName?: string
  // Attribution: the email of whoever last set the score for this question.
  updatedBy?: string
}

export async function fetchResponseDetails(orgId: string): Promise<Record<string, ResponseDetail>> {
  try {
    const data = await jsonOrThrow(await fetch(`/api/responses?orgId=${encodeURIComponent(orgId)}`))
    return (data?.details as Record<string, ResponseDetail>) ?? {}
  } catch (err) {
    console.warn('[api] fetchResponseDetails failed', err)
    return {}
  }
}

// Persist Trust Delta / debrief detail for a single question without disturbing
// the self-score (the server only writes the keys present in the body).
export async function saveResponseDetail(
  orgId: string,
  questionId: string,
  detail: ResponseDetail,
  updatedBy?: string,
): Promise<void> {
  await jsonOrThrow(await fetch('/api/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orgId, questionId, ...detail, updatedBy }),
  }))
}

export function saveScore(orgId: string, questionId: string, score: number, updatedBy?: string): void {
  void fetch('/api/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orgId, questionId, score, updatedBy }),
  }).catch((err) => console.warn('[api] saveScore failed', err))
}

export function saveScoresBulk(orgId: string, scores: Record<string, number>): void {
  void fetch('/api/responses', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orgId, scores }),
  }).catch((err) => console.warn('[api] saveScoresBulk failed', err))
}

// Batch score read — load every institution's scores for a Portfolio Reviewer in
// a single round-trip. Server-side access grants gate which orgs are returned, so
// `requester` (the reviewer's email) must be supplied for cross-tenant reads.
export async function fetchScoresForOrgs(
  orgIds: string[],
  requester?: string,
): Promise<Record<string, Record<string, number>>> {
  if (!orgIds.length) return {}
  try {
    const qs = new URLSearchParams({ orgIds: orgIds.join(',') })
    if (requester) qs.set('requester', requester)
    const data = await jsonOrThrow(await fetch(`/api/responses?${qs.toString()}`))
    return (data?.scoresByOrg as Record<string, Record<string, number>>) ?? {}
  } catch (err) {
    console.warn('[api] fetchScoresForOrgs failed', err)
    return {}
  }
}

// --- Audit log --------------------------------------------------------------
export async function fetchAudit(orgId: string): Promise<AuditEntry[]> {
  try {
    return (await jsonOrThrow(await fetch(`/api/audit?orgId=${encodeURIComponent(orgId)}`))) as AuditEntry[]
  } catch (err) {
    console.warn('[api] fetchAudit failed', err)
    return []
  }
}

export function postAudit(entry: {
  orgId?: string
  actor: string
  action: string
  target: string
  category: string
}): void {
  void fetch('/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch((err) => console.warn('[api] postAudit failed', err))
}

// --- Response notes (threaded, multi-author rationale) ----------------------
// Per-answer commentary, one row per note, owned by its author. The server
// derives the author from the verified Netlify Identity session (sent via the
// same-origin `nf_jwt` cookie), so these helpers never pass an author: a read
// returns only the caller's own notes plus notes explicitly shared, and a write
// is always attributed to the signed-in caller. Resilient like the rest of api.
export interface ResponseNote {
  id: number
  questionId: string
  authorEmail: string
  authorName: string
  authorRole: string
  body: string
  visibility: 'private' | 'shared'
  createdAt: string
}

export async function fetchResponseNotes(orgId: string, questionId?: string): Promise<ResponseNote[]> {
  try {
    const qs = new URLSearchParams({ orgId })
    if (questionId) qs.set('questionId', questionId)
    return (await jsonOrThrow(await fetch(`/api/response-notes?${qs.toString()}`))) as ResponseNote[]
  } catch (err) {
    console.warn('[api] fetchResponseNotes failed', err)
    return []
  }
}

export async function postResponseNote(input: {
  orgId: string
  questionId: string
  body: string
  visibility?: 'private' | 'shared'
}): Promise<ResponseNote | null> {
  try {
    return (await jsonOrThrow(
      await fetch('/api/response-notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )) as ResponseNote
  } catch (err) {
    console.warn('[api] postResponseNote failed', err)
    return null
  }
}

// --- Capacity Improvement Plan ---------------------------------------------
export async function fetchCapacityStatuses(orgId: string): Promise<Record<string, RiskStatus>> {
  try {
    const data = await jsonOrThrow(await fetch(`/api/capacity-actions?orgId=${encodeURIComponent(orgId)}`))
    return (data?.statuses as Record<string, RiskStatus>) ?? {}
  } catch (err) {
    console.warn('[api] fetchCapacityStatuses failed', err)
    return {}
  }
}

export function saveCapacityStatus(orgId: string, riskId: string, status: RiskStatus): void {
  void fetch('/api/capacity-actions', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orgId, riskId, status }),
  }).catch((err) => console.warn('[api] saveCapacityStatus failed', err))
}

// --- Compliance / Obligations ----------------------------------------------
export async function fetchCompliance(orgId: string): Promise<Obligation[]> {
  try {
    const rows = (await jsonOrThrow(await fetch(`/api/compliance?orgId=${encodeURIComponent(orgId)}`))) as any[]
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      stream: r.stream,
      type: r.type,
      donorOrAuthority: r.donorOrAuthority ?? r.donor_or_authority ?? '',
      frequency: r.frequency,
      nextDueDate: r.nextDueDate ?? r.next_due_date,
      country: r.country ?? '',
      sector: r.sector ?? '',
      owner: r.owner ?? 'Unassigned',
      status: r.status,
      notes: r.notes ?? undefined,
    })) as Obligation[]
  } catch (err) {
    console.warn('[api] fetchCompliance failed', err)
    return []
  }
}

export function saveCompliance(items: (Obligation & { orgId: string })[]): void {
  void fetch('/api/compliance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  }).catch((err) => console.warn('[api] saveCompliance failed', err))
}

export function updateComplianceStatus(id: string, status: string, nextDueDate?: string): void {
  void fetch('/api/compliance', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, status, nextDueDate }),
  }).catch((err) => console.warn('[api] updateComplianceStatus failed', err))
}

// --- Financial Triangulation -----------------------------------------------
export interface FinancialTriangulationPayload {
  id: string
  orgId?: string
  contextKey?: string
  donorId?: string
  grantId?: string
  reportTypeId?: string
  streamId?: string
  periodId?: string
  openingBalance: number
  incomeReceived: number
  expenditures: number
  adjustments: number
  actualBankBalance: number
  financeOfficerNotes: string
  grantManagerCommentary: string
  assessorNotes: string
  verificationStatus: 'verified' | 'qualified' | 'rejected'
  status: 'draft' | 'pending_review' | 'pending_assessor' | 'locked'
  lockedBy?: string
  lockedAt?: string
  history: string[]
}

export async function fetchFinancialTriangulation(orgId: string, contextKey: string, strict = false): Promise<FinancialTriangulationPayload | null> {
  try {
    const qs = `?orgId=${encodeURIComponent(orgId)}&contextKey=${encodeURIComponent(contextKey)}`
    return (await jsonOrThrow(await fetch(`/api/financial-triangulation${qs}`))) as FinancialTriangulationPayload | null
  } catch (err) {
    if (strict) throw err
    console.warn('[api] fetchFinancialTriangulation failed', err)
    return null
  }
}

export async function saveFinancialTriangulation(input: FinancialTriangulationPayload): Promise<FinancialTriangulationPayload | null> {
  try {
    return (await jsonOrThrow(
      await fetch('/api/financial-triangulation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )) as FinancialTriangulationPayload
  } catch (err) {
    console.warn('[api] saveFinancialTriangulation failed', err)
    return null
  }
}

// --- Portfolios -------------------------------------------------------------
export async function fetchPortfolios(reviewer?: string): Promise<Portfolio[]> {
  try {
    const qs = reviewer ? `?reviewer=${encodeURIComponent(reviewer)}` : ''
    const rows = (await jsonOrThrow(await fetch(`/api/portfolios${qs}`))) as any[]
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      orgIds: Array.isArray(r.orgIds) ? r.orgIds : [],
      reviewer: r.reviewer ?? undefined,
      firmId: r.firmId ?? undefined,
      status: (r.status as 'active' | 'archived') ?? 'active',
    })) as Portfolio[]
  } catch (err) {
    console.warn('[api] fetchPortfolios failed', err)
    return []
  }
}

export async function savePortfolio(input: {
  id?: string
  name: string
  orgIds: string[]
  reviewer?: string
  firmId?: string
  createdBy?: string
}): Promise<Portfolio | null> {
  try {
    const row = await jsonOrThrow(
      await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
    return {
      id: row.id,
      name: row.name,
      orgIds: Array.isArray(row.orgIds) ? row.orgIds : input.orgIds,
      reviewer: row.reviewer ?? undefined,
    } as Portfolio
  } catch (err) {
    console.warn('[api] savePortfolio failed', err)
    return null
  }
}

export function deletePortfolio(id: string): void {
  void fetch(`/api/portfolios?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((err) =>
    console.warn('[api] deletePortfolio failed', err),
  )
}

// PATCH a portfolio's name and/or soft-archive status without disturbing its
// institution membership (used by the rename and archive/restore controls).
export function updatePortfolio(input: { id: string; name?: string; status?: 'active' | 'archived' }): void {
  void fetch('/api/portfolios', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch((err) => console.warn('[api] updatePortfolio failed', err))
}

// --- Access grants ----------------------------------------------------------
export interface AccessGrant {
  id: string
  orgId: string
  grantee: string
  grantedBy?: string
  firmId?: string
  level: 'read' | 'write'
  status: 'pending' | 'active' | 'revoked'
  portfolioId?: string
}

export async function fetchAccessGrants(query: { grantee?: string; orgId?: string }): Promise<AccessGrant[]> {
  try {
    const qs = new URLSearchParams()
    if (query.grantee) qs.set('grantee', query.grantee)
    if (query.orgId) qs.set('orgId', query.orgId)
    return (await jsonOrThrow(await fetch(`/api/access-grants?${qs.toString()}`))) as AccessGrant[]
  } catch (err) {
    console.warn('[api] fetchAccessGrants failed', err)
    return []
  }
}

export async function saveAccessGrant(input: {
  orgId: string
  grantee: string
  grantedBy?: string
  firmId?: string
  level?: 'read' | 'write'
  status?: 'pending' | 'active' | 'revoked'
  portfolioId?: string
}): Promise<AccessGrant | null> {
  try {
    return (await jsonOrThrow(
      await fetch('/api/access-grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )) as AccessGrant
  } catch (err) {
    console.warn('[api] saveAccessGrant failed', err)
    return null
  }
}

export function updateAccessGrantStatus(orgId: string, grantee: string, status: 'active' | 'revoked'): void {
  void fetch('/api/access-grants', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orgId, grantee, status }),
  }).catch((err) => console.warn('[api] updateAccessGrantStatus failed', err))
}

// --- Invitations ------------------------------------------------------------
export interface Invitation {
  id: string
  token?: string
  email: string
  inviter?: string
  inviterName?: string
  portfolioId?: string
  role: string
  scopeLabel: string
  message?: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
}

export async function fetchInvitationByToken(token: string): Promise<Invitation | null> {
  try {
    return (await jsonOrThrow(await fetch(`/api/invitations?token=${encodeURIComponent(token)}`))) as Invitation | null
  } catch (err) {
    console.warn('[api] fetchInvitationByToken failed', err)
    return null
  }
}

export async function fetchInvitations(inviter: string): Promise<Invitation[]> {
  try {
    return (await jsonOrThrow(await fetch(`/api/invitations?inviter=${encodeURIComponent(inviter)}`))) as Invitation[]
  } catch (err) {
    console.warn('[api] fetchInvitations failed', err)
    return []
  }
}

export async function createInvitation(input: {
  email: string
  inviter?: string
  inviterName?: string
  portfolioId?: string
  role?: string
  scopeLabel?: string
  message?: string
}): Promise<Invitation | null> {
  try {
    return (await jsonOrThrow(
      await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )) as Invitation
  } catch (err) {
    console.warn('[api] createInvitation failed', err)
    return null
  }
}

export function updateInvitationStatus(token: string, status: 'accepted' | 'revoked'): void {
  void fetch('/api/invitations', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, status }),
  }).catch((err) => console.warn('[api] updateInvitationStatus failed', err))
}

// Dispatch the branded welcome email. Degrades gracefully when no mail provider
// is configured server-side (the invitation record is still created).
export function sendInviteEmail(input: { to: string; subject: string; html: string }): void {
  void fetch('/api/send-invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch((err) => console.warn('[api] sendInviteEmail failed', err))
}

// --- Firms ------------------------------------------------------------------
export interface FirmSeat {
  email: string
  role: 'owner' | 'consultant'
  status: 'active' | 'invited' | 'revoked'
}
export interface Firm {
  id: string
  name: string
  createdBy?: string
  members: FirmSeat[]
}

export async function fetchFirms(email: string): Promise<Firm[]> {
  try {
    return (await jsonOrThrow(await fetch(`/api/firms?email=${encodeURIComponent(email)}`))) as Firm[]
  } catch (err) {
    console.warn('[api] fetchFirms failed', err)
    return []
  }
}

export async function createFirm(name: string, createdBy: string): Promise<Firm | null> {
  try {
    const row = await jsonOrThrow(
      await fetch('/api/firms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, createdBy }),
      }),
    )
    return { id: row.id, name: row.name, createdBy: row.createdBy ?? undefined, members: [] }
  } catch (err) {
    console.warn('[api] createFirm failed', err)
    return null
  }
}

export function saveFirmMember(input: {
  firmId: string
  email: string
  role?: 'owner' | 'consultant'
  status?: 'active' | 'invited' | 'revoked'
}): void {
  void fetch('/api/firms', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch((err) => console.warn('[api] saveFirmMember failed', err))
}

export function deleteFirmMember(firmId: string, email: string): void {
  void fetch(`/api/firms?firmId=${encodeURIComponent(firmId)}&email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }).catch((err) => console.warn('[api] deleteFirmMember failed', err))
}

// Derive a stable, per-tenant organization id for an authenticated "self"
// workspace. Netlify Identity logins all arrive as SELF_ORG_ID, so without this
// every signed-in institution would collide on one shared tenant. Hashing the
// email into the id gives each account its own isolated row set in the database.
export function tenantOrgId(email: string): string {
  return `self_${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}
