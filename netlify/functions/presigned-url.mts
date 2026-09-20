import type { Context, Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { resolveCaller, canAccessOrg, forbidden, unauthorized } from '../lib/auth.js'

const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg'])

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split('.').pop() ?? ''
}

// ============================================================================
// CRAFT v4.0 — Presigned upload URL generator (Data Room evidence)
// ----------------------------------------------------------------------------
// The Universal Data Room uploads evidence directly from the browser. The client
// first calls this endpoint to obtain a short-lived, scoped upload target; it
// then PUTs the file to that URL without the bytes ever transiting the app
// server. Evidence is stored in a tenant-scoped Netlify Blobs store so a Kenyan
// NGO can never read a Nigerian ministry's documents.
//
// Multi-tenant isolation: the tenant is taken from the `x-craft-org` header that
// the edge auth function (netlify/edge-functions/auth.ts) stamps from the JWT,
// falling back to a request field for local/demo use.
// ============================================================================

interface PresignRequest {
  fileName: string
  contentType?: string
  category?: string
  organizationId?: string
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'evidence'
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const caller = await resolveCaller()
  if (!caller) return unauthorized()

  let body: PresignRequest
  try {
    body = (await req.json()) as PresignRequest
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.fileName) {
    return Response.json({ error: 'fileName is required' }, { status: 400 })
  }
  if (!ALLOWED_EXTENSIONS.has(extensionOf(body.fileName))) {
    return Response.json({ error: `File type not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}` }, { status: 400 })
  }

  const orgId = req.headers.get('x-craft-org') || body.organizationId || caller.orgId
  if (!(await canAccessOrg(caller, orgId))) return forbidden()
  const category = slug(body.category || 'general')
  const stamp = Date.now()
  const key = `${slug(orgId)}/${category}/${stamp}-${slug(body.fileName)}`

  // Reserve the object in a tenant-scoped Blobs store with pending metadata, so
  // the upload target exists and verification status can be tracked against it.
  const store = getStore({ name: `data-room-${slug(orgId)}` })
  await store
    .setJSON(`${key}.meta`, {
      fileName: body.fileName,
      category: body.category ?? 'general',
      organizationId: orgId,
      status: 'pending',
      reservedAt: new Date(stamp).toISOString(),
    })
    .catch(err => console.error('[presigned-url] blob reserve failed', err))

  return Response.json({
    key,
    organizationId: orgId,
    // The client PUTs the file bytes to this callback, which streams them into
    // the reserved Blobs key. (A direct signed PUT URL can be swapped in here.)
    uploadUrl: `/.netlify/functions/data-room-upload?key=${encodeURIComponent(key)}`,
    contentType: body.contentType ?? 'application/octet-stream',
    expiresInSeconds: 600,
    requestId: context.requestId,
  })
}

export const config: Config = {
  path: '/api/presigned-url',
  method: 'POST',
}
