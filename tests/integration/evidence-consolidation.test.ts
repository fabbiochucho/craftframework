import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import { ADMIN, ASSESSOR, VIEWER, as, blobStores, createOrg, expectStatus, pdfFile, rows, truncateAll, uploadEvidence } from './harness.ts'
import { consolidateEvidence } from '../../netlify/scripts/consolidate-evidence.mts'
import { decodeEvidence } from '../../netlify/lib/evidence-storage.ts'
const legacyUpload = (await import('../../netlify/functions/data-room-upload.mts')).default

describe('reviewed evidence consolidation', () => {
  let manifest: any
  let sourceBytes: Buffer
  beforeEach(async () => {
    await truncateAll()
    const { orgId, wsId } = await createOrg()
    await rows("INSERT INTO users(id,email,org_id,role) VALUES('reviewer',$1,'legacy-tenant','admin'),('uploader',$2,'legacy-tenant','assessor')", [ADMIN, ASSESSOR])
    sourceBytes = Buffer.from(await pdfFile().arrayBuffer())
    const sourceKey = 'legacy-tenant/policy/original.pdf'
    blobStores().set('data-room-legacy-tenant', new Map([
      [sourceKey, { bytes: sourceBytes }],
      [`${sourceKey}.meta`, { bytes: Buffer.from(JSON.stringify({
        organizationId: 'legacy-tenant', status: 'uploaded', fileName: 'original.pdf',
        contentType: 'application/pdf', uploadedAt: '2026-09-01T00:00:00Z',
      })) }],
    ]))
    manifest = { version: 1, reviewedBy: ADMIN, entries: [{
      legacyOrgId: 'legacy-tenant', sourceKey, orgId, workspaceId: wsId,
      uploadedBy: ASSESSOR, sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    }] }
  })

  it('dry-runs, imports encrypted bytes once, downloads with membership and rolls back without deleting sources', async () => {
    await consolidateEvidence(manifest)
    assert.equal((await rows('SELECT * FROM evidence_registry')).length, 0)
    assert.equal(blobStores().get('evidence')?.size ?? 0, 0)
    await Promise.all([consolidateEvidence(manifest, '--apply'), consolidateEvidence(manifest, '--apply')])
    const [imported] = await rows('SELECT * FROM evidence_registry')
    assert.equal(imported.status, 'pending_review')
    assert.equal(imported.uploaded_by, ASSESSOR)
    const encrypted = blobStores().get('evidence')!.get(imported.file_path)!.bytes
    assert.ok(!encrypted.includes(Buffer.from('%PDF')))
    await consolidateEvidence(manifest, '--apply')
    assert.equal((await rows('SELECT * FROM evidence_registry')).length, 1)
    const path = `/workspaces/${imported.workspace_id}/evidence/${imported.id}/download`
    const downloaded = expectStatus(await as(VIEWER).get(path), 200)
    assert.deepEqual(Buffer.from(downloaded.raw), sourceBytes)
    assert.equal((await as('outsider@other.example').get(path)).status, 404)
    await consolidateEvidence(manifest, '--rollback')
    await consolidateEvidence(manifest, '--rollback')
    const [retained] = await rows('SELECT * FROM evidence_registry')
    assert.equal(retained.id, imported.id)
    assert.ok(retained.archived_at)
    assert.deepEqual(blobStores().get('data-room-legacy-tenant')!.get(manifest.entries[0].sourceKey)!.bytes, sourceBytes)
    assert.ok(blobStores().get('evidence')!.has(imported.file_path))
    assert.equal((await as(VIEWER).get(path)).status, 404)
  })

  it('fails closed for ownership/checksum conflicts and refuses rollback of reviewed evidence', async () => {
    await assert.rejects(consolidateEvidence({ ...manifest, entries: [{ ...manifest.entries[0], sha256: '0'.repeat(64) }] }), /checksum/)
    await assert.rejects(consolidateEvidence({ ...manifest, entries: [{ ...manifest.entries[0], orgId: 999 }] }), /ownership/)
    await consolidateEvidence(manifest, '--apply')
    const [imported] = await rows('SELECT * FROM evidence_registry')
    expectStatus(await as(ADMIN).post(`/workspaces/${imported.workspace_id}/evidence/${imported.id}/approve`, { comments: 'Reviewed separately' }), 200)
    await assert.rejects(consolidateEvidence(manifest, '--rollback'), /downstream/)
    assert.equal((await rows('SELECT archived_at FROM evidence_registry'))[0].archived_at, null)
  })

  it('rejects source metadata tenant mismatches and conflicting reviewed destination mappings', async () => {
    const source = blobStores().get('data-room-legacy-tenant')!
    const metadata = source.get(`${manifest.entries[0].sourceKey}.meta`)!
    const original = Buffer.from(metadata.bytes)
    metadata.bytes = Buffer.from(JSON.stringify({ ...JSON.parse(original.toString()), organizationId: 'other-tenant' }))
    await assert.rejects(consolidateEvidence(manifest, '--apply'), /owned/)
    assert.equal((await rows('SELECT * FROM evidence_registry')).length, 0)
    metadata.bytes = original
    await consolidateEvidence(manifest, '--apply')
    const second = expectStatus(await as(ADMIN).post(`/orgs/${manifest.entries[0].orgId}/workspaces`, { workspaceName: 'Second workspace' }), 201)
    await assert.rejects(consolidateEvidence({ ...manifest, entries: [{ ...manifest.entries[0], workspaceId: second.body.id }] }, '--apply'), /different workspace/)
  })

  it('encrypts legacy upload bytes and keeps exact tenant metadata', async () => {
    const key = manifest.entries[0].sourceKey
    ;(globalThis as any).__craftTestIdentity = { email: ASSESSOR }
    const uploaded = await legacyUpload(new Request(`http://localhost/.netlify/functions/data-room-upload?key=${encodeURIComponent(key)}`, {
      method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: new Uint8Array(sourceBytes).buffer,
    }), {} as any)
    assert.equal(uploaded.status, 201)
    assert.ok(!blobStores().get('data-room-legacy-tenant')!.get(key)!.bytes.includes(Buffer.from('%PDF')))
    await consolidateEvidence(manifest, '--apply')
    assert.equal((await rows('SELECT status FROM evidence_registry'))[0].status, 'pending_review')
  })

  it('encrypts new canonical uploads and reads historical plaintext at stable keys', async () => {
    const id = await uploadEvidence(manifest.entries[0].workspaceId)
    const [e] = await rows('SELECT * FROM evidence_registry WHERE id=$1', [id])
    const stored = blobStores().get('evidence')!.get(e.file_path)!
    assert.ok(!stored.bytes.includes(Buffer.from('%PDF')))
    const array = stored.bytes.buffer.slice(stored.bytes.byteOffset, stored.bytes.byteOffset + stored.bytes.byteLength) as ArrayBuffer
    assert.deepEqual(Buffer.from(decodeEvidence(array)), sourceBytes)
    stored.bytes = sourceBytes
    assert.deepEqual(Buffer.from(expectStatus(await as(VIEWER).get(`/workspaces/${e.workspace_id}/evidence/${id}/download`), 200).raw), sourceBytes)
  })
})
