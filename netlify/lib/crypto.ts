import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const PREFIX = 'enc:'

function parseKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')) {
    throw new Error('Field encryption keys must be base64-encoded 32-byte values')
  }
  return key
}

export function encryptFieldWithKey(value: string, key: Buffer, version = VERSION): string {
  if (key.length !== 32) throw new Error('AES-256-GCM requires a 32-byte key')
  if (!/^v[1-9]\d*$/.test(version)) throw new Error('Encryption key versions must use vN format')
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${PREFIX}${version}:${nonce.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptFieldWithKeys(value: string, keys: Record<string, Buffer>): string {
  const [prefix, version, nonceText, tagText, encryptedText, ...extra] = value.split(':')
  if (prefix !== 'enc' || !version || !nonceText || !tagText || encryptedText == null || extra.length) {
    throw new Error('Invalid encrypted field format')
  }
  const key = keys[version]
  if (!key) throw new Error(`Encryption key ${version} is unavailable`)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonceText, 'base64'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]).toString('utf8')
}

function configuredKeys(): { activeVersion: string; keys: Record<string, Buffer> } | null {
  const active = process.env.FIELD_ENCRYPTION_KEY
  if (!active) {
    if (process.env.NODE_ENV === 'production') throw new Error('FIELD_ENCRYPTION_KEY is required in production')
    return null
  }
  const activeVersion = process.env.FIELD_ENCRYPTION_KEY_VERSION || VERSION
  const keys: Record<string, Buffer> = { [activeVersion]: parseKey(active) }
  const previous = process.env.FIELD_ENCRYPTION_PREVIOUS_KEYS
  if (previous) {
    const parsed: unknown = JSON.parse(previous)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('FIELD_ENCRYPTION_PREVIOUS_KEYS must be a JSON object')
    for (const [version, key] of Object.entries(parsed)) {
      if (version !== activeVersion && typeof key === 'string') keys[version] = parseKey(key)
    }
  }
  return { activeVersion, keys }
}

export function encryptField(value: string): string {
  if (!value) return value
  const configured = configuredKeys()
  if (!configured) return value
  return encryptFieldWithKey(value, configured.keys[configured.activeVersion], configured.activeVersion)
}

export function decryptField(value: string): string {
  if (!value.startsWith(PREFIX)) return value
  const configured = configuredKeys()
  if (!configured) throw new Error('Encryption key is required to read encrypted data')
  return decryptFieldWithKeys(value, configured.keys)
}

export function isEncryptedField(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function fieldLookupHashes(value: string): string[] {
  const configured = configuredKeys()
  if (!configured) return []
  return Object.values(configured.keys).map((key) =>
    createHmac('sha256', key).update(value.trim().toLowerCase()).digest('hex'))
}

export function pseudonymizeIdentifier(value: string, scope: string): string {
  const configured = configuredKeys()
  if (!configured) return `erased:${createHash('sha256').update(`${scope}:${value.toLowerCase()}`).digest('hex').slice(0, 24)}`
  return `erased:${createHmac('sha256', configured.keys[configured.activeVersion])
    .update(`${scope}:${value.trim().toLowerCase()}`).digest('hex').slice(0, 24)}`
}
