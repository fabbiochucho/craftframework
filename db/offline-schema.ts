import { pgTable, text, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const offlineFrameworks = pgTable('offline_frameworks', {
  orgId: integer('org_id').notNull(),
  workspaceId: integer('workspace_id').notNull(),
  id: text('id').notNull(),
  version: integer('version').notNull(),
  deleted: integer('deleted').notNull().default(0),
  payload: text('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.orgId, t.workspaceId, t.id] })])

export const offlineFrameworkReceipts = pgTable('offline_framework_receipts', {
  orgId: integer('org_id').notNull(),
  workspaceId: integer('workspace_id').notNull(),
  userId: text('user_id').notNull(),
  operationId: text('operation_id').notNull(),
  fingerprint: text('fingerprint').notNull(),
  response: text('response').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.orgId, t.workspaceId, t.userId, t.operationId] })])
