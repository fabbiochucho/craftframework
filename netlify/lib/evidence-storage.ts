import { decryptField, encryptField, isEncryptedField } from './crypto.ts'

const MAGIC = 'CRAFT-EVIDENCE-ENC-1\n'

export function encodeEvidence(bytes: ArrayBuffer): ArrayBuffer {
  const encoded = encryptField(Buffer.from(bytes).toString('base64'))
  if (!isEncryptedField(encoded)) throw new Error('FIELD_ENCRYPTION_KEY is required for evidence storage')
  const buffer = Buffer.from(MAGIC + encoded, 'utf8')
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

export function decodeEvidence(bytes: ArrayBuffer): ArrayBuffer {
  const buffer = Buffer.from(bytes)
  if (!buffer.subarray(0, MAGIC.length).equals(Buffer.from(MAGIC))) return bytes
  const encoded = buffer.subarray(MAGIC.length).toString('utf8')
  if (!isEncryptedField(encoded)) throw new Error('Invalid encrypted evidence envelope')
  const decoded = Buffer.from(decryptField(encoded), 'base64')
  return decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength)
}
