// Self-check — run directly with `node src/lib/analyticsRoutes.test.ts`.
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { ROUTE_CLASS_BY_FILE, classifyPath, classifyRouteFile, routeFilePattern, routePattern } from './analyticsRoutes.ts'

// Every route file must be classified, so a new page cannot be tracked by accident.
const files = readdirSync(new URL('../routes/', import.meta.url)).filter(f => f.endsWith('.tsx'))
assert.ok(files.length > 50)
const unclassified = files.filter(f => classifyRouteFile(f) === undefined)
assert.deepEqual(unclassified, [], `Classify these routes in src/lib/analyticsRoutes.ts: ${unclassified.join(', ')}`)
// ...and the table must not keep entries for deleted routes.
const names = new Set(files.map(f => f.replace(/\.tsx$/, '')))
const stale = Object.keys(ROUTE_CLASS_BY_FILE).filter(n => !names.has(n))
assert.deepEqual(stale, [], `Stale route classifications: ${stale.join(', ')}`)

// Every classified route's own URL resolves to its class (except /app/*, which is sensitive by prefix).
for (const f of files) {
  const name = f.replace(/\.tsx$/, '')
  if (name === '__root') continue
  const url = routeFilePattern(name).replace(/\$\w+/g, 'x1')
  assert.equal(classifyPath(url), classifyRouteFile(name), `${name} -> ${url}`)
}

// Allowed pages
for (const p of ['/', '/auth', '/onboarding', '/directory', '/directory/validators/abc', '/training', '/training/module/m1',
  '/training/assessment', '/validation', '/validation/CRAFT-V-1', '/privacy', '/subprocessors', '/terms', '/help', '/guide', '/methodology']) {
  assert.notEqual(classifyPath(p), 'sensitive', p)
}
assert.equal(classifyPath('/'), 'marketing')
assert.equal(classifyPath('/for/government'), 'marketing')
assert.equal(classifyPath('/privacy'), 'allowed')
assert.equal(classifyPath('/directory/'), 'allowed')
assert.equal(classifyPath('/directory?q=jane%40example.com'), 'allowed')

// Sensitive pages, and default-deny for anything unknown
for (const p of ['/assessment', '/assessment/gfa', '/evidence', '/data-room', '/findings', '/cip', '/reports', '/dashboard', '/engagements',
  '/engagements/4', '/engagements/4/review', '/review', '/validations', '/validations/3', '/panel', '/panel/2', '/admin', '/admin/portfolio',
  '/settings', '/vaults', '/finance-triangulation', '/training/manage', '/app', '/app/workspaces', '/app/workspaces/3/evidence',
  '/app/anything/new', '/accept/abc', '/contact', '/not-a-route', '/directoryx', '/privacy/extra']) {
  assert.equal(classifyPath(p), 'sensitive', p)
}

// Patterns hide ids and query strings; sensitive pages have none
assert.equal(routePattern('/directory/validators/abc?x=1'), '/directory/$kind/$id')
assert.equal(routePattern('/validation/CRAFT-V-9'), '/validation/$verificationId')
assert.equal(routePattern('/'), '/')
assert.equal(routePattern('/assessment'), null)
assert.equal(routePattern('/app/org/members'), null)

console.log('analyticsRoutes.test.ts: all assertions passed')
