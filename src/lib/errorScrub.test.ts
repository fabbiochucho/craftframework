// Self-check — run directly with `node src/lib/errorScrub.test.ts`.
import assert from 'node:assert/strict'
import { NO_DATA_COLLECTION, isExpectedError, parameterizePath, sanitizeUrl, scrubBreadcrumb, scrubEvent, scrubText } from './errorScrub.ts'

const ctx = { sensitiveRoute: false }

// --- route parameterisation -------------------------------------------------------------------
assert.equal(parameterizePath('/engagements/123456'), '/engagements/$id', 'known route patterns win')
assert.equal(parameterizePath('/engagements/123456/review?token=abc#x'), '/engagements/$id/review')
assert.equal(parameterizePath('/accept/Zk3jQ9tokenvalue'), '/accept/$token')
assert.equal(parameterizePath('/app/workspaces/42/evidence/7'), '/app/workspaces/:id/evidence/:id', 'unknown paths: id-like segments replaced')
assert.equal(parameterizePath('/api/orgs/12/members/jo%40x.org'), '/api/orgs/:id/members/:id')
assert.equal(parameterizePath('/'), '/')
assert.equal(parameterizePath('/privacy/'), '/privacy')
assert.equal(sanitizeUrl('https://craftframework.becomechange.institute/app/workspaces/42/dashboard?email=a@b.org#frag'), 'https://craftframework.becomechange.institute/app/workspaces/:id/dashboard')
assert.equal(sanitizeUrl('/directory/validators/abc123?q=jane'), '/directory/$kind/$id')

// --- text scrubbing ---------------------------------------------------------------------------
assert.equal(scrubText('Failed for jane.doe+x@example.co.uk now'), 'Failed for [email] now')
assert.equal(scrubText('phone 2348012345678 id 12345 ok 1234'), 'phone [number] id [number] ok 1234')
assert.equal(scrubText('GET /api/orgs/55/members?email=a@b.org failed'), 'GET /api/orgs/:id/members failed')
assert.equal(scrubText('see https://x.example/app/workspaces/9/findings?token=abc#t'), 'see https://x.example/app/workspaces/:id/findings')
assert.equal(scrubText('uuid 3f2b8c1e-9d4a-4e7b-8a1c-0f6d5e4c3b2a'), 'uuid [id]')
assert.equal(scrubText('Authorization: Bearer abc.DEF-123_xyz'), 'Authorization: Bearer [token]')
assert.equal(scrubText('token a1b2c3d4e5f6a1b2c3d4e5f6a1b2'), 'token [token]')
assert.equal(scrubText('duplicate key value violates unique constraint "u"\nKey (name)=(Acme Health Ltd) already exists.').includes('Acme Health'), false)
assert.equal(scrubText('Failed query: insert into t values ($1, $2)\nparams: Acme Ltd,secret'), 'Failed query: insert into t values ($1, $2)\nparams: [redacted]')
assert.ok(scrubText('x'.repeat(2000)).length <= 500)

// --- breadcrumbs ------------------------------------------------------------------------------
assert.equal(scrubBreadcrumb({ category: 'console', message: 'hi a@b.org' }, { sensitiveRoute: true }), null, 'no console breadcrumbs on sensitive routes')
assert.equal(scrubBreadcrumb({ category: 'console', message: 'hi a@b.org 1234567' }, ctx)?.message, 'hi [email] [number]')
assert.equal(scrubBreadcrumb({ category: 'ui.input', message: 'input' }, ctx), null)
const click = scrubBreadcrumb({ category: 'ui.click', message: 'div > button.btn[aria-label="Delete Acme Ltd"] "Delete Acme"', data: { text: 'Delete Acme' } }, ctx)!
assert.equal(click.message, 'div > button.btn')
assert.equal(click.data, undefined, 'no DOM text or attributes in click breadcrumbs')
const fetchCrumb = scrubBreadcrumb({ category: 'fetch', data: { url: '/api/orgs/5/evidence?name=Acme', method: 'GET', status_code: 500, request_body: 'x', response_body_size: 3 } }, ctx)!
assert.deepEqual(fetchCrumb.data, { method: 'GET', status_code: 500, url: '/api/orgs/:id/evidence' })
assert.deepEqual(scrubBreadcrumb({ category: 'navigation', data: { from: '/app/workspaces/3/qa/9?x=1', to: '/app/workspaces/3/reports' } }, ctx)!.data, { from: '/app/workspaces/:id/qa/:id', to: '/app/workspaces/:id/reports' })

// --- whole events -----------------------------------------------------------------------------
const event = scrubEvent({
  message: 'Boom for jo@example.org',
  user: { id: '1', email: 'jo@example.org', ip_address: '1.2.3.4' },
  extra: { score: 91, evidence: 'secret', comment: 'private' },
  server_name: 'host',
  request: {
    url: 'https://craftframework.becomechange.institute/app/workspaces/42/evidence/7?token=abc#frag',
    method: 'POST',
    query_string: 'token=abc',
    cookies: { nf_jwt: 'secret' },
    data: { orgName: 'Acme Ltd', score: 80 },
    headers: { Cookie: 'nf_jwt=secret', Authorization: 'Bearer x', 'User-Agent': 'UA/1.0', Referer: 'https://x/?email=a@b.org' },
  },
  exception: { values: [{ type: 'Error', value: 'Cannot read org "Acme" for jo@example.org (id 99887766)', stacktrace: { frames: [{ filename: 'https://x/assets/a.js?v=1', abs_path: 'https://x/assets/a.js?v=1', vars: { secret: 1 } }] } }] },
  breadcrumbs: [{ category: 'console', message: 'jo@example.org' }, { category: 'ui.click', message: 'button.go' }],
  tags: { scope: '/api/x', organisation: 'Acme', browser: 'x' },
  contexts: { browser: { name: 'Chrome' }, culture: { timezone: 'Africa/Lagos' }, trace: { trace_id: 't', data: { 'http.query': '?a=b' } } },
  transaction: '/app/workspaces/42/dashboard',
  transaction_info: { source: 'url' },
  spans: [{ description: 'GET https://h.example/api/orgs/12?x=1', op: 'http.client', data: { 'http.query': '?x=1', url: 'x' } }],
}, { sensitiveRoute: true })
const json = JSON.stringify(event)
for (const leak of ['jo@example.org', '1.2.3.4', 'secret', 'Acme', 'token=abc', '#frag', 'Bearer', 'Referer', 'Authorization', 'Cookie', 'Lagos', '99887766', 'http.query', '?x=1', 'private']) {
  assert.ok(!json.includes(leak), `event still contains ${leak}: ${json}`)
}
assert.equal(event.request.url, 'https://craftframework.becomechange.institute/app/workspaces/:id/evidence/:id')
assert.deepEqual(event.request.headers, { 'User-Agent': 'UA/1.0' })
assert.equal(event.user, undefined)
assert.equal(event.breadcrumbs.length, 1)
assert.equal(event.transaction, '/app/workspaces/:id/dashboard')
assert.deepEqual(event.tags, { scope: '/api/x' })
assert.equal(event.contexts.browser.name, 'Chrome')
assert.equal(event.spans[0].description, 'GET https://h.example/api/orgs/:id')
assert.equal(event.exception.values[0].stacktrace.frames[0].filename, 'https://x/assets/a.js')

// --- expected client errors -------------------------------------------------------------------
for (const status of [400, 401, 403, 404, 429]) assert.equal(isExpectedError(Object.assign(new Error('x'), { status })), true, `${status} is expected`)
assert.equal(isExpectedError(Object.assign(new Error('x'), { statusCode: 422 })), true)
assert.equal(isExpectedError(Object.assign(new Error('x'), { name: 'ZodError' })), true)
assert.equal(isExpectedError(Object.assign(new Error('x'), { status: 500 })), false)
assert.equal(isExpectedError(new TypeError('real bug')), false)
assert.equal(isExpectedError(undefined), false)

// --- nothing collected by default -------------------------------------------------------------
assert.equal(NO_DATA_COLLECTION.userInfo, false)
assert.equal(NO_DATA_COLLECTION.cookies, false)
assert.equal(NO_DATA_COLLECTION.httpHeaders, false)
assert.deepEqual(NO_DATA_COLLECTION.httpBodies, [])
assert.equal(NO_DATA_COLLECTION.urlQueryParams, false)
assert.equal(NO_DATA_COLLECTION.stackFrameVariables, false)
console.log('errorScrub.test.ts: all assertions passed')
