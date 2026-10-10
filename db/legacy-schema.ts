import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const legacyWorkspaceState = pgTable('legacy_workspace_state', {
  orgId: text('org_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.orgId, table.key] })])
