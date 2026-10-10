import assert from 'node:assert/strict'
import { decryptField, decryptFieldWithKeys, encryptFieldWithKey, encryptField, fieldLookupHashes } from './crypto.ts'
import { encodeEvidence, decodeEvidence } from './evidence-storage.ts'

const firstKey = Buffer.alloc(32, 1)
const secondKey = Buffer.alloc(32, 2)
const legacy = encryptFieldWithKey('sensitive value', firstKey, 'v1')
assert.equal(decryptFieldWithKeys(legacy, { v1: firstKey }), 'sensitive value')
const tampered = legacy.split(':')
tampered[4] = `${tampered[4][0] === 'A' ? 'B' : 'A'}${tampered[4].slice(1)}`
assert.throws(() => decryptFieldWithKeys(tampered.join(':'), { v1: firstKey }))
assert.throws(() => decryptFieldWithKeys(legacy, { v1: secondKey }))

const rotated = encryptFieldWithKey('sensitive value', secondKey, 'v2')
assert.equal(decryptFieldWithKeys(legacy, { v1: firstKey, v2: secondKey }), 'sensitive value')
assert.equal(decryptFieldWithKeys(rotated, { v1: firstKey, v2: secondKey }), 'sensitive value')
assert.throws(() => decryptFieldWithKeys(legacy, { v2: secondKey }))

const saved = {
  key: process.env.FIELD_ENCRYPTION_KEY,
  version: process.env.FIELD_ENCRYPTION_KEY_VERSION,
  previous: process.env.FIELD_ENCRYPTION_PREVIOUS_KEYS,
  nodeEnv: process.env.NODE_ENV,
}
process.env.FIELD_ENCRYPTION_KEY = firstKey.toString('base64')
process.env.FIELD_ENCRYPTION_KEY_VERSION = 'v1'
delete process.env.FIELD_ENCRYPTION_PREVIOUS_KEYS
const stableHash = fieldLookupHashes('USER@example.org')[0]
const envCiphertext = encryptField('member@example.org')
const evidence = new TextEncoder().encode('%PDF private evidence').buffer
const storedEvidence = encodeEvidence(evidence)
assert.ok(!Buffer.from(storedEvidence).includes(Buffer.from('%PDF private evidence')))
assert.deepEqual(Buffer.from(decodeEvidence(storedEvidence)), Buffer.from(evidence))
assert.equal(decodeEvidence(evidence), evidence, 'historical plaintext bytes remain readable')
const corruptEvidence = Buffer.from(new Uint8Array(storedEvidence))
corruptEvidence[corruptEvidence.length - 4] = corruptEvidence[corruptEvidence.length - 4] === 65 ? 66 : 65
assert.throws(() => decodeEvidence(corruptEvidence.buffer.slice(corruptEvidence.byteOffset, corruptEvidence.byteOffset + corruptEvidence.byteLength) as ArrayBuffer), 'tampered evidence cannot be downloaded')
process.env.FIELD_ENCRYPTION_KEY = secondKey.toString('base64')
process.env.FIELD_ENCRYPTION_KEY_VERSION = 'v2'
process.env.FIELD_ENCRYPTION_PREVIOUS_KEYS = JSON.stringify({ v1: firstKey.toString('base64') })
assert.ok(fieldLookupHashes('user@example.org').includes(stableHash!))
assert.notEqual(fieldLookupHashes('user@example.org')[0], stableHash)
assert.equal(decryptField(envCiphertext), 'member@example.org')
assert.deepEqual(Buffer.from(decodeEvidence(storedEvidence)), Buffer.from(evidence), 'previous keys decrypt historical evidence')
delete process.env.FIELD_ENCRYPTION_KEY
assert.throws(() => encodeEvidence(evidence), /FIELD_ENCRYPTION_KEY/)
process.env.NODE_ENV = 'production'
assert.throws(() => encryptField('requires key'), /FIELD_ENCRYPTION_KEY/)
if (saved.key === undefined) delete process.env.FIELD_ENCRYPTION_KEY; else process.env.FIELD_ENCRYPTION_KEY = saved.key
if (saved.version === undefined) delete process.env.FIELD_ENCRYPTION_KEY_VERSION; else process.env.FIELD_ENCRYPTION_KEY_VERSION = saved.version
if (saved.previous === undefined) delete process.env.FIELD_ENCRYPTION_PREVIOUS_KEYS; else process.env.FIELD_ENCRYPTION_PREVIOUS_KEYS = saved.previous
if (saved.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.nodeEnv

console.log('crypto.test.ts: all assertions passed')
