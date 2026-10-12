// Evidence content check through the real upload, re-check and approval routes, against Postgres.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { ADMIN, ASSESSOR, OWNER, VIEWER, as, createOrg, expectStatus, rows, truncateAll } from './harness.ts'

let wsId = 0
const P = () => `/workspaces/${wsId}`

async function textPdf(name: string, lines: string[]): Promise<File> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  lines.forEach((l, i) => page.drawText(l, { x: 40, y: 800 - i * 16, size: 10, font }))
  return new File([Buffer.from(await doc.save())], name, { type: 'application/pdf' })
}
const charter = ['Board Charter of Acme Plc 2025', 'This charter sets out the responsibilities of the Board of Directors.', 'Quorum: a majority of directors. The Chairperson presides over meetings.']
const register = ['Risk Register FY2025', 'Risk | Likelihood | Impact | Inherent risk | Mitigation | Residual risk | Risk owner', 'R1 | Procurement fraud | High | High | 16 | Segregation of duties | 8 | CFO']

describe('evidence content check', () => {
  beforeEach(async () => {
    await truncateAll()
    ;({ wsId } = await createOrg())
  })

  it('reads uploads, flags a document that is not what it is named, and requires a reason to approve it', async () => {
    const good = expectStatus(await as(ASSESSOR).upload(`${P()}/evidence/upload`, await textPdf('Board Charter 2025.pdf', charter)), 201).body
    assert.equal(good.contentCheck.status, 'match')
    assert.equal(good.contentCheck.expectedKind, 'board_charter')

    const bad = expectStatus(await as(ASSESSOR).upload(`${P()}/evidence/upload`, await textPdf('Board Charter 2025.pdf', register)), 201).body
    assert.equal(bad.contentCheck.status, 'possible_mismatch')
    assert.equal(bad.contentCheck.detectedKind, 'risk_register')
    // The extracted text itself is never stored.
    const [stored] = await rows('SELECT content_check::text AS c FROM evidence_registry WHERE id = $1', [bad.id])
    assert.ok(!stored.c.includes('Procurement fraud'))

    const blocked = await as(OWNER).post(`${P()}/evidence/${bad.id}/approve`, { status: 'approved' })
    assert.equal(blocked.status, 409, 'a flagged document needs a reason')
    assert.match(blocked.body.error, /content check flagged/)
    expectStatus(await as(OWNER).post(`${P()}/evidence/${bad.id}/approve`, { status: 'rejected' }), 200, 'rejecting needs no reason')
    expectStatus(await as(OWNER).post(`${P()}/evidence/${good.id}/approve`, { status: 'approved' }), 200)
  })

  it('uses the declared kind, lists kinds, and re-checks stored documents', async () => {
    const kinds = expectStatus(await as(VIEWER).get(`${P()}/evidence/document-kinds`), 200).body
    assert.ok(kinds.some((k: any) => k.id === 'risk_register'))
    assert.equal((await as(ASSESSOR).upload(`${P()}/evidence/upload`, await textPdf('doc.pdf', register), { documentKind: 'nonsense' })).status, 400)

    const e = expectStatus(await as(ASSESSOR).upload(`${P()}/evidence/upload`, await textPdf('scan0001.pdf', register)), 201).body
    assert.equal(e.contentCheck.status, 'not_checked')
    assert.equal(e.contentCheck.detectedKind, 'risk_register')
    // Declaring what it should be re-reads the stored (encoded) file.
    const re = expectStatus(await as(ASSESSOR).post(`${P()}/evidence/${e.id}/content-check`, { documentKind: 'risk_register' }), 200).body
    assert.equal(re.contentCheck.status, 'match')
    assert.equal(re.declaredKind, 'risk_register')
    const wrongKind = expectStatus(await as(ADMIN).post(`${P()}/evidence/${e.id}/content-check`, { documentKind: 'audited_financials' }), 200).body
    assert.equal(wrongKind.contentCheck.status, 'possible_mismatch')
    assert.equal((await as(VIEWER).post(`${P()}/evidence/${e.id}/content-check`, {})).status, 403)

    // Images have no text layer: flagged for a manual check, not blocked.
    const img = new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], 'Board Charter.png', { type: 'image/png' })
    const pic = expectStatus(await as(ASSESSOR).upload(`${P()}/evidence/upload`, img), 201).body
    assert.equal(pic.contentCheck.status, 'unreadable')
    expectStatus(await as(OWNER).post(`${P()}/evidence/${pic.id}/approve`, { status: 'approved' }), 200)
  })
})
