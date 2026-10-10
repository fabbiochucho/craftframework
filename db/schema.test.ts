// Self-check — run directly with `node db/schema.test.ts`.
// Verifies tenant isolation foundation: every workspace-platform table that is
// not the org root carries an `orgId` column, and the migration creates them.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { getTableColumns, getTableName } from 'drizzle-orm'
import * as schema from './schema.ts'

const exempt = new Set(['ws_organizations', 'support_issue_responses'])
const tables = Object.values(schema).filter((v: any) => v && typeof v === 'object' && Symbol.for('drizzle:Name') in v) as any[]
const wsTables = tables.filter((t) => {
  const n = getTableName(t)
  return n.startsWith('ws_') || ['workspaces', 'governance_assessments', 'governance_scores', 'governance_findings', 'esg_frameworks',
    'esg_requirements', 'esg_implementation_plans', 'esg_milestones', 'cap_records', 'action_items', 'action_logs',
    'evidence_registry', 'evidence_links', 'document_approvals', 'reports', 'report_versions', 'support_issues', 'report_schedules', 'gdpr_requests'].includes(n)
})
assert.ok(wsTables.length >= 20, 'expected workspace tables')
for (const t of wsTables) {
  const name = getTableName(t)
  if (exempt.has(name)) continue
  assert.ok('orgId' in getTableColumns(t), `${name} must have org_id`)
}
assert.ok('userIdHash' in getTableColumns(schema.wsOrgMembers), 'workspace member email lookup must use its keyed hash')

const dir = 'netlify/database/migrations'
const sql = readdirSync(dir).map((d) => readFileSync(`${dir}/${d}/migration.sql`, 'utf8')).join('\n')
for (const t of wsTables) assert.ok(sql.includes(`"${getTableName(t)}"`), `migration missing ${getTableName(t)}`)
for (const t of [schema.rateLimits, schema.reportSchedules, schema.gdprRequests]) {
  assert.ok(sql.includes(`"${getTableName(t)}"`), `migration missing ${getTableName(t)}`)
}
console.log('schema.test.ts: all assertions passed')
