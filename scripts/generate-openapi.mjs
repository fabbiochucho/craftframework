import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourcePath = resolve(root, 'netlify/functions/workspace-api.mts')
const outputPath = resolve(root, 'docs/api/openapi.yaml')
const source = readFileSync(sourcePath, 'utf8')
const routes = []

for (const match of source.matchAll(/\{\s*method:\s*'(GET|POST|PUT|DELETE)',\s*pattern:\s*([^,]+),\s*access:\s*([^,]+)(?:,\s*scope:\s*'[^']+')?/g)) {
  const [, method, expression, accessExpression] = match
  let pattern = expression.trim()
  if (pattern === 'A') pattern = '`${W}/assessments/:id`'
  if (pattern.startsWith("'") || pattern.startsWith('"')) pattern = pattern.slice(1, -1)
  else if (pattern.startsWith('`')) pattern = pattern.slice(1, -1).replaceAll('${W}', '/workspaces/:ws').replaceAll('${A}', '/workspaces/:ws/assessments/:id')
  else continue
  if (pattern.includes('${slug}')) continue
  const access = accessExpression.trim().replace(/^'/, '').replace(/'$/, '')
  routes.push({ method: method.toLowerCase(), path: pattern, access })
}

const reportMap = source.match(/\.\.\.\(\['([^']+)'((?:,\s*'[^']+')*)\] as const\)\.map\(\(slug\)/)
if (reportMap) {
  const slugs = [reportMap[1], ...[...reportMap[2].matchAll(/'([^']+)'/g)].map((m) => m[1])]
  for (const slug of slugs) routes.push({ method: 'post', path: `/workspaces/:ws/reports/${slug}`, access: slug === 'audit-trail' ? 'admin' : 'assessor' })
}

if (!routes.length) throw new Error('No routes found in workspace API route table')
const pathParameters = {
  ws: 'workspace_id', org: 'org_id', id: 'id', fid: 'finding_id', aid: 'action_id', member: 'member_id',
}
const paths = new Map()
for (const route of routes) {
  const path = route.path.replace(/:([a-z]+)/g, (_, name) => `{${pathParameters[name] ?? name}}`)
  const operations = paths.get(path) ?? new Map()
  operations.set(route.method, route)
  paths.set(path, operations)
}

const lines = [
  'openapi: 3.0.3',
  'info:',
  '  title: CRAFT Workspace Platform API',
  '  version: 1.1.0',
  '  description: Generated from the route table in netlify/functions/workspace-api.mts. Every operation declares its minimum access role.',
  'paths:',
]
for (const [path, operations] of [...paths].sort(([a], [b]) => a.localeCompare(b))) {
  lines.push(`  ${path}:`)
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)]
  if (parameters.length) lines.push('    parameters:')
  for (const name of parameters) {
    lines.push(`      - name: ${name[1]}`, '        in: path', '        required: true', '        schema: { type: string }')
  }
  for (const [method, route] of [...operations].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`    ${method}:`, `      x-min-role: ${route.access}`, '      responses:', "        '200': { description: OK }", "        '201': { description: Created }", "        '400': { description: Invalid request }", "        '401': { description: Unauthorized }", "        '403': { description: Forbidden }", "        '404': { description: Not found }", "        '429': { description: Too many requests }")
  }
}
const output = `${lines.join('\n')}\n`
if (process.argv.includes('--check')) {
  if (readFileSync(outputPath, 'utf8') !== output) {
    console.error('docs/api/openapi.yaml is out of date; run npm run docs:api')
    process.exitCode = 1
  }
} else {
  writeFileSync(outputPath, output)
  console.log(`Generated ${outputPath}`)
}
