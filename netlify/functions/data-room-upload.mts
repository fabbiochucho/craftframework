import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { resolveCaller, canAccessOrg, forbidden, unauthorized } from '../lib/auth.js'
import { MAX_UPLOAD_BYTES } from '../lib/uploads.js'
import { stripImageMetadata } from '../lib/stripImageMetadata.js'
import { logger } from '../lib/logger.js'
import { encodeEvidence } from '../lib/evidence-storage.js'

// ============================================================================
// CRAFT v4.0 — Data Room evidence upload sink
// ----------------------------------------------------------------------------
// The companion to presigned-url.mts. After the client obtains a reserved key
// from /api/presigned-url it PUTs the file bytes here. This function streams
// them into the same tenant-scoped Netlify Blobs store the key was reserved in,
// then flips the reserved `<key>.meta` record from `pending` to `uploaded` so
// the Data Room can track verification status against a real object.
//
// Multi-tenant isolation: the store name is derived from the org slug embedded
// in the key (the first path segment), which presigned-url took from the trusted
// `x-craft-org` edge header — a Kenyan NGO can never write into a Nigerian
// ministry's store.
// ============================================================================

function storeNameForKey(key: string): string {
  // Keys are `${orgSlug}/${category}/${stamp}-${fileName}` — the org slug is the
  // first segment and selects the tenant-scoped store.
  const orgSlug = key.split('/')[0] || 'unscoped'
  return `data-room-${orgSlug}`
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const caller = await resolveCaller()
  if (!caller) return unauthorized()

  const key = new URL(req.url).searchParams.get('key')
  if (!key) {
    return Response.json({ error: 'key query parameter is required' }, { status: 400 })
  }

  const store = getStore({ name: storeNameForKey(key) })

  // The key must have been reserved first (presigned-url writes `<key>.meta`),
  // which also confirms the caller went through the scoped reservation step.
  const meta = (await store.get(`${key}.meta`, { type: 'json' }).catch(() => null)) as
    | { fileName?: string; category?: string; organizationId?: string; expiresAt?: string }
    | null
  if (!meta) {
    return Response.json({ error: 'Unknown or expired upload key' }, { status: 404 })
  }
  if (meta.expiresAt && Date.now() > Date.parse(meta.expiresAt)) {
    return Response.json({ error: 'Upload key has expired — request a new one' }, { status: 410 })
  }
  if (!meta.organizationId || !(await canAccessOrg(caller, meta.organizationId))) return forbidden()

  const declaredLength = Number(req.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_UPLOAD_BYTES) {
    return Response.json({ error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit` }, { status: 413 })
  }

  try {
    let buf = await req.arrayBuffer()
    if (!buf.byteLength) {
      return Response.json({ error: 'Empty upload body' }, { status: 400 })
    }
    if (buf.byteLength > MAX_UPLOAD_BYTES) {
      return Response.json({ error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit` }, { status: 413 })
    }
    const contentType = req.headers.get('content-type') || 'application/octet-stream'
    // Evidence is often photographed on-site — strip EXIF/GPS and embedded
    // editor metadata from images before they're stored.
    buf = stripImageMetadata(buf, contentType)

    await store.set(key, encodeEvidence(buf), {
      metadata: {
        fileName: meta.fileName ?? '',
        category: meta.category ?? 'general',
        organizationId: meta.organizationId ?? '',
        contentType,
      },
    })
    await store.setJSON(`${key}.meta`, {
      ...meta,
      status: 'uploaded',
      contentType,
      size: buf.byteLength,
      uploadedAt: new Date().toISOString(),
    })

    return Response.json({ key, status: 'uploaded', size: buf.byteLength }, { status: 201 })
  } catch (err) {
    logger.error("data-room-upload", "failed", err)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
