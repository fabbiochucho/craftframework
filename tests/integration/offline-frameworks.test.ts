import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { beforeEach, test } from 'node:test'
import { ADMIN, ASSESSOR, OUTSIDER, OWNER, VIEWER, as, createOrg, expectStatus, rows, truncateAll, uploadEvidence } from './harness.ts'
// @ts-ignore -- test-only identity stub loaded by the integration harness
import { identityStorage } from './stubs/identity.mjs'

const userId = (email: string) => `identity:${email}`
const signed = <T>(email: string, run: () => Promise<T>) => identityStorage.run({ id: userId(email), email, name: email }, run)
const data = { name: 'Offline framework', description: 'Editable diagnostic', questions: [{ id: 'q1', domain: 'Governance', text: 'Question' }], evidenceRefs: [] as number[] }
beforeEach(truncateAll)

test('scoped create/update/delete, encrypted persistence and exact idempotent receipt replay', async () => {
  const { orgId, wsId } = await createOrg()
  const scope = { userId: userId(ADMIN), orgId, workspaceId: wsId }
  const path = `/workspaces/${wsId}/offline-frameworks`
  const frameworkId = randomUUID()
  const create = { operationId: randomUUID(), frameworkId, action: 'create', baseVersion: 0, data }
  const send = (operation: unknown) => signed(ADMIN, () => as(ADMIN).post(`${path}/mutations`, { scope, operation }))
  const created = expectStatus(await send(create), 200)
  assert.equal(created.body.record.version, 1)
  assert.deepEqual((await send(create)).body, created.body)
  const update = { operationId: randomUUID(), frameworkId, action: 'update', baseVersion: 1, data: { ...data, name: 'Changed' } }
  expectStatus(await send(update), 200)
  const deleted = expectStatus(await send({ operationId: randomUUID(), frameworkId, action: 'delete', baseVersion: 2 }), 200)
  assert.equal(deleted.body.record.deleted, true)
  assert.equal(deleted.body.record.version, 3)
  assert.deepEqual((await send(create)).body, created.body, 'Lost create acknowledgements replay original receipt, not newer data')
  const changedKey = await send({ ...create, data: { ...data, name: 'Different content' } })
  assert.equal(changedKey.status, 409)
  const stored = await rows('SELECT * FROM offline_frameworks')
  assert.ok(!stored[0].payload.includes(data.name))
  assert.equal((await rows('SELECT * FROM offline_framework_receipts')).length, 3)
  assert.equal((await rows("SELECT * FROM ws_audit_log WHERE resource_type = 'custom_framework'")).length, 3)
  const listed = expectStatus(await signed(ADMIN, () => as(ADMIN).get(path)), 200)
  assert.deepEqual(listed.body.scope, scope)
  assert.equal(listed.body.records[0].deleted, true)
})

test('stale versions return current server record and never overwrite newer data', async () => {
  const { orgId, wsId } = await createOrg()
  const scope = { userId: userId(OWNER), orgId, workspaceId: wsId }
  const frameworkId = randomUUID()
  const send = (operation: unknown) => signed(OWNER, () => as(OWNER).post(`/workspaces/${wsId}/offline-frameworks/mutations`, { scope, operation }))
  expectStatus(await send({ operationId: randomUUID(), frameworkId, action: 'create', baseVersion: 0, data }), 200)
  expectStatus(await send({ operationId: randomUUID(), frameworkId, action: 'update', baseVersion: 1, data: { ...data, name: 'Server newest' } }), 200)
  const conflict = expectStatus(await send({ operationId: randomUUID(), frameworkId, action: 'delete', baseVersion: 1 }), 409)
  assert.equal(conflict.body.current.version, 2)
  assert.equal(conflict.body.current.data.name, 'Server newest')
  assert.equal((await rows('SELECT version FROM offline_frameworks'))[0].version, 2)
})

test('anonymous, nonmembers, viewer/assessor, and mismatched user/org/workspace cannot mutate', async () => {
  const { orgId, wsId } = await createOrg()
  const operation = { operationId: randomUUID(), frameworkId: randomUUID(), action: 'create', baseVersion: 0, data }
  const path = `/workspaces/${wsId}/offline-frameworks/mutations`
  assert.equal((await as(null).post(path, {})).status, 401)
  for (const email of [VIEWER, ASSESSOR, OUTSIDER]) {
    const response = await signed(email, () => as(email).post(path, { scope: { userId: userId(email), orgId, workspaceId: wsId }, operation }))
    assert.equal(response.status, email === OUTSIDER ? 404 : 403)
  }
  const scope = { userId: userId(ADMIN), orgId, workspaceId: wsId }
  for (const wrong of [{ ...scope, userId: userId(OWNER) }, { ...scope, orgId: orgId + 1 }, { ...scope, workspaceId: wsId + 1 }]) {
    assert.equal((await signed(ADMIN, () => as(ADMIN).post(path, { scope: wrong, operation }))).status, 403)
  }
  assert.equal((await rows('SELECT * FROM offline_frameworks')).length, 0)
})

test('evidence references are validated against this workspace, not arbitrary document IDs', async () => {
  const a = await createOrg()
  const b = await createOrg('Other', 'owner@other.example', {})
  const evidence = await uploadEvidence(a.wsId)
  const scope = { userId: userId(OWNER), orgId: a.orgId, workspaceId: a.wsId }
  const send = (workspaceId: number, requestScope: typeof scope) => signed(OWNER, () => as(OWNER).post(`/workspaces/${workspaceId}/offline-frameworks/mutations`, {
    scope: requestScope, operation: { operationId: randomUUID(), frameworkId: randomUUID(), action: 'create', baseVersion: 0, data: { ...data, evidenceRefs: [evidence] } },
  }))
  expectStatus(await send(a.wsId, scope), 200)
  const foreignScope = { userId: userId('owner@other.example'), orgId: b.orgId, workspaceId: b.wsId }
  const foreign = await signed('owner@other.example', () => as('owner@other.example').post(`/workspaces/${b.wsId}/offline-frameworks/mutations`, {
    scope: foreignScope, operation: { operationId: randomUUID(), frameworkId: randomUUID(), action: 'create', baseVersion: 0, data: { ...data, evidenceRefs: [evidence] } },
  }))
  assert.equal(foreign.status, 422)
})
