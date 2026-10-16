// ============================================================================
// Public verification of an issued validation (validator system PR 6).
// ----------------------------------------------------------------------------
// Builds the one public view of a validation (the page and the PDF share it) and
// the statement PDF with its QR code. The view carries ONLY what the spec allows
// on the public page: never indicator scores, evidence, validator comments or
// contact details. Organisation-chosen extras (rung history, qualifications,
// DevMapper link, registration number) appear only if the organisation opted in.
// ============================================================================

import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { encode } from 'uqr'
import { db } from '../../db/index.js'
import {
  engagementMembers, firms, organizations, validationEngagements, validationReviews, validationStatements, validations, validatorCredentials,
  validatorProfiles, type ValidationRow,
} from '../../db/schema.js'
import { scopeText, type EngagementScope } from '../../src/lib/engagements.js'
import { credentialLabel, effectiveAccreditation } from '../../src/lib/validatorDirectory.js'
import { STATUS_LABEL, type Status } from '../../src/lib/validationLifecycle.js'
import { generateVerificationId, standardWording } from '../../src/lib/validationStatement.js'
import { FRAMEWORKS, METHOD_LABEL, OUTCOME_LABEL, type Method, type Outcome } from '../../src/lib/validationReview.js'
import { describeValidation } from './validation-lifecycle.js'

export const publicBaseUrl = () => (process.env.PUBLIC_SITE_URL || process.env.URL || 'https://craftframework.becomechange.institute').replace(/\/+$/, '')
export const publicUrlFor = (verificationId: string) => `${publicBaseUrl()}/validation/${verificationId}`

/** Give a validation its random ID (rows issued before PR 6 get one on first need). */
export async function ensureVerificationId(v: Pick<ValidationRow, 'id' | 'verificationId'>): Promise<string> {
  if (v.verificationId) return v.verificationId
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const set = await db.update(validations).set({ verificationId: generateVerificationId() })
        .where(and(eq(validations.id, v.id), isNull(validations.verificationId))).returning({ verificationId: validations.verificationId })
      if (set[0]?.verificationId) return set[0].verificationId
      const [row] = await db.select({ verificationId: validations.verificationId }).from(validations).where(eq(validations.id, v.id))
      if (row?.verificationId) return row.verificationId
    } catch { /* the one-in-a-trillion unique collision: draw again */ }
  }
  throw new Error('Could not allocate a verification ID')
}

export type PublicView = {
  verificationId: string
  status: Status
  statusLabel: string
  lastChangedAt: string
  organization: { name: string; country: string; registrationNumber: string | null }
  framework: { name: string; version: string }
  scope: string
  label: string
  statement: string
  outcome: Outcome
  outcomeLabel: string
  validatedRung: number
  rungName: string
  validators: Array<{ name: string; role: string; accreditation: string; credentials: Array<{ body: string; number: string; status: string }> }>
  firm: string | null
  validatorType: string
  engagedBy: string
  independence: { statement: string; declarations: Array<{ name: string; version: string; signedAt: string }>; disclosure: string }
  method: string
  fieldwork: { start: string | null; end: string | null }
  issuedAt: string
  expiresAt: string
  validityMonths: number
  nextVerificationPoint: string | null
  wording: { means: string; doesNot: string; changes: string }
  rungHistory?: Array<{ rung: number; issuedAt: string; status: string }>
  qualifications?: string[]
  devmapperUrl?: string
}

export async function buildPublicView(v: ValidationRow, now = new Date()): Promise<PublicView | null> {
  const fw = FRAMEWORKS[v.framework]
  const [review] = await db.select().from(validationReviews).where(eq(validationReviews.id, v.reviewId))
  const snap = review?.snapshot as Record<string, any> | null | undefined
  if (!fw || !snap) return null
  const [e] = await db.select().from(validationEngagements).where(eq(validationEngagements.id, v.engagementId))
  const [org] = await db.select({ name: organizations.name, country: organizations.country }).from(organizations).where(eq(organizations.id, v.orgId))
  const members = await db.select().from(engagementMembers).where(and(eq(engagementMembers.engagementId, v.engagementId), eq(engagementMembers.status, 'named')))
  const profiles = members.length ? await db.select().from(validatorProfiles).where(inArray(validatorProfiles.email, members.map((m) => m.email))) : []
  const creds = profiles.length ? await db.select().from(validatorCredentials).where(inArray(validatorCredentials.validatorId, profiles.map((p) => p.id))) : []
  const firmIds = [e?.validatorFirmId, e?.funderFirmId].filter((x): x is string => !!x)
  const firmRows = firmIds.length ? await db.select({ id: firms.id, name: firms.name, nature: firms.nature }).from(firms).where(inArray(firms.id, firmIds)) : []
  const vFirm = firmRows.find((f) => f.id === e?.validatorFirmId)
  const fFirm = firmRows.find((f) => f.id === e?.funderFirmId)
  const d = await describeValidation(v, now)
  const type = (snap.engagement?.type ?? e?.type ?? 'independent_validation') as 'independent_validation' | 'funder_review'
  const options = v.publicOptions ?? {}

  const validators = members.map((m) => {
    const p = profiles.find((x) => x.email === m.email)
    return {
      name: p?.name ?? 'Validator', role: m.role === 'lead' ? 'Lead' : 'Team member', accreditation: p ? effectiveAccreditation(p) : 'registered',
      credentials: p ? creds.filter((c) => c.validatorId === p.id).map((c) => ({ body: c.body, number: c.membershipNumber, status: credentialLabel(c) })) : [],
    }
  }).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'Lead' ? -1 : 1))

  const team: Array<{ name: string; declaration: { version: string; signedAt: string; fundedDisclosure: boolean; disclosure: string } | null }> = snap.team ?? []
  const disclosures = team.filter((t) => t.declaration?.fundedDisclosure).map((t) => `${t.name}: ${t.declaration!.disclosure}`)
  const independence = type === 'funder_review'
    ? `The reviewers are employed by ${fFirm?.name ?? 'the funding partner'} and are not independent of it.`
    : 'Each named validator declared no ownership, employment or advisory ties to the organisation, and no part in preparing its self-assessment, before seeing any of its results.'

  // Latest change: the issue, a recorded status decision, or the calendar reaching expiry / a missed follow-up.
  const dates = [v.issuedAt, v.statusChangedAt].filter((x): x is Date => !!x)
  if (d.status === 'expired') dates.push(d.expiresAt)
  if (d.status === 'follow_up_overdue' && d.followUp.dueOn) dates.push(new Date(`${d.followUp.dueOn}T00:00:00Z`))
  const lastChangedAt = new Date(Math.max(...dates.map((x) => x.getTime())))

  const view: PublicView = {
    verificationId: v.verificationId ?? '',
    status: d.status, statusLabel: STATUS_LABEL[d.status], lastChangedAt: lastChangedAt.toISOString(),
    organization: { name: org?.name ?? snap.organization?.name ?? '', country: org?.country ?? snap.organization?.country ?? '', registrationNumber: options.registrationNumber ?? null },
    framework: { name: fw.name, version: fw.version }, scope: scopeText((snap.scope ?? e?.scope ?? { kind: 'whole' }) as EngagementScope),
    label: snap.engagement?.label ?? 'Independent validation', statement: snap.engagement?.statement ?? '',
    outcome: v.outcome as Outcome, outcomeLabel: OUTCOME_LABEL[v.outcome as Outcome], validatedRung: v.validatedRung,
    rungName: fw.levels.find((l) => l.level === v.validatedRung)?.name ?? '',
    validators, firm: type === 'funder_review' ? (fFirm?.name ?? null) : (vFirm?.name ?? null),
    validatorType: type === 'funder_review' ? `Funding partner${fFirm?.nature ? ` (${fFirm.nature})` : ''}` : vFirm ? (vFirm.nature ?? 'Validator firm') : 'Independent consultant',
    engagedBy: snap.engagement?.engagedBy ?? '',
    independence: {
      statement: independence,
      declarations: team.filter((t) => t.declaration).map((t) => ({ name: t.name, version: t.declaration!.version, signedAt: String(t.declaration!.signedAt) })),
      disclosure: disclosures.length ? disclosures.join('; ') : type === 'funder_review' ? 'The review was carried out by the funder\'s own staff.' : 'No engagement or payment by a funder was disclosed.',
    },
    method: METHOD_LABEL[(snap.method ?? 'combined') as Method] ?? String(snap.method ?? ''),
    fieldwork: { start: snap.fieldwork?.start ?? null, end: snap.fieldwork?.end ?? null },
    issuedAt: v.issuedAt.toISOString(), expiresAt: d.expiresAt.toISOString(), validityMonths: v.validityMonths,
    nextVerificationPoint: nextPoint(v, d.followUp.dueOn),
    wording: standardWording({ type, frameworkName: fw.name, frameworkVersion: fw.version, funderName: fFirm?.name }),
  }
  if (options.showQualifications) view.qualifications = ((snap.qualifications ?? []) as Array<{ text: string }>).map((q) => q.text)
  if (options.devmapperUrl) view.devmapperUrl = options.devmapperUrl
  if (options.showRungHistory) {
    const others = await db.select().from(validations).where(and(eq(validations.orgId, v.orgId), eq(validations.framework, v.framework), ne(validations.id, v.id)))
    view.rungHistory = [...others, v].sort((a, b) => +a.issuedAt - +b.issuedAt).map((x) => ({ rung: x.validatedRung, issuedAt: x.issuedAt.toISOString(), status: x.id === v.id ? d.statusLabel : x.status }))
  }
  return view
}

function nextPoint(v: ValidationRow, followUpDue: string | null): string | null {
  const points = [followUpDue, v.surveillanceDueAt && !v.surveillanceDoneAt ? v.surveillanceDueAt.toISOString().slice(0, 10) : null].filter((x): x is string => !!x).sort()
  return points[0] ?? null
}

// --- Statement PDF ---------------------------------------------------------------
const INK = rgb(0.06, 0.2, 0.15)
const GREY = rgb(0.35, 0.4, 0.4)

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word } else line = next
    }
    lines.push(line)
  }
  return lines
}

/** The statement PDF. It carries the facts at issue plus a QR code to the live verification page. */
export async function renderStatementPdf(view: PublicView, url: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`CRAFT validation statement ${view.verificationId}`)
  pdf.setProducer('CRAFT')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595, H = 842, M = 48, CW = W - 2 * M
  let page: PDFPage = pdf.addPage([W, H])
  let y = H - M
  const ensure = (need: number) => { if (y - need < M) { page = pdf.addPage([W, H]); y = H - M } }
  const text = (t: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) => {
    const size = o.size ?? 10
    for (const line of wrap(t, o.bold ? bold : font, size, CW - (o.indent ?? 0))) {
      ensure(size + 4)
      page.drawText(line, { x: M + (o.indent ?? 0), y: y - size, size, font: o.bold ? bold : font, color: o.color ?? INK })
      y -= size + 3
    }
    y -= o.gap ?? 0
  }
  const row = (k: string, v: string) => { ensure(14); page.drawText(`${k}`, { x: M, y: y - 10, size: 9, font: bold, color: GREY }); const lines = wrap(v, font, 10, CW - 150); lines.forEach((l, i) => { ensure(13); page.drawText(l, { x: M + 150, y: y - 10 - i * 13, size: 10, font, color: INK }) }); y -= Math.max(1, lines.length) * 13 + 3 }

  text('CRAFT validation statement', { size: 20, bold: true, gap: 2 })
  text(`${view.label} · ${view.framework.name} (${view.framework.version})`, { size: 11, color: GREY, gap: 10 })

  // QR to the live verification page (top right of the identity block).
  const qr = encode(url, { ecc: 'M', border: 1 })
  const cell = 3.2
  const qx = W - M - qr.size * cell
  const qy = y - qr.size * cell
  qr.data.forEach((r, ry) => r.forEach((on, rx) => { if (on) page.drawRectangle({ x: qx + rx * cell, y: qy + (qr.size - 1 - ry) * cell, width: cell, height: cell, color: rgb(0, 0, 0) }) }))
  const top = y
  text(`Verification ID  ${view.verificationId}`, { size: 12, bold: true })
  text(`Status when issued: ${view.statusLabel}. A validation is valid only while it shows as current at:`, { size: 9, color: GREY, indent: 0 })
  text(url, { size: 9, bold: true, gap: 4 })
  y = Math.min(y, top - qr.size * cell - 6)

  row('Organisation', `${view.organization.name}${view.organization.country ? `, ${view.organization.country}` : ''}`)
  row('Registration number', view.organization.registrationNumber ?? 'Not provided')
  row('Scope', view.scope)
  row('Outcome', `${view.outcomeLabel}${view.outcome === 'not_validated' ? '' : ` — rung ${view.validatedRung}: ${view.rungName}`}`)
  row('Label', view.statement)
  row('Validator(s)', view.validators.map((x) => `${x.name} (${x.role}; ${x.accreditation})`).join('; ') || '—')
  const cred = view.validators.flatMap((x) => x.credentials.map((c) => `${x.name}: ${c.body} ${c.number} (${c.status})`))
  if (cred.length) row('Credentials', cred.join('; '))
  row('Firm / type', `${view.firm ?? 'None'} · ${view.validatorType}`)
  row('Engaged by', view.engagedBy)
  row('Method', view.method)
  row('Fieldwork', `${view.fieldwork.start ?? '—'} to ${view.fieldwork.end ?? '—'}`)
  row('Issued', view.issuedAt.slice(0, 10))
  row('Valid until', `${view.expiresAt.slice(0, 10)} (${view.validityMonths} months)`)
  if (view.nextVerificationPoint) row('Next verification point', view.nextVerificationPoint)
  row('Independence', view.independence.statement)
  row('Disclosure', view.independence.disclosure)
  if (view.qualifications?.length) row('Qualifications', view.qualifications.join('; '))
  y -= 6
  text('What this validation means', { bold: true, size: 11 }); text(view.wording.means, { gap: 6 })
  text('What it does not mean', { bold: true, size: 11 }); text(view.wording.doesNot, { gap: 6 })
  text('Its status can change', { bold: true, size: 11 }); text(view.wording.changes, { gap: 6 })
  text(`Report a concern: ${url}`, { size: 9, color: GREY })
  return pdf.save()
}

export const sha256Hex = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** The issued statement: generated once, stored, and its SHA-256 is what the public page shows. */
export async function ensureStatement(v: ValidationRow): Promise<{ sha256: string; bytes: Uint8Array } | null> {
  const read = async () => {
    const [row] = await db.select().from(validationStatements).where(eq(validationStatements.validationId, v.id))
    return row ? { sha256: row.sha256, bytes: new Uint8Array(Buffer.from(row.pdfBase64, 'base64')) } : null
  }
  const existing = await read()
  if (existing) return existing
  const verificationId = await ensureVerificationId(v)
  const view = await buildPublicView({ ...v, verificationId })
  if (!view) return null
  const bytes = await renderStatementPdf(view, publicUrlFor(verificationId))
  await db.insert(validationStatements).values({ validationId: v.id, pdfBase64: Buffer.from(bytes).toString('base64'), sha256: sha256Hex(bytes) }).onConflictDoNothing()
  return read()
}
