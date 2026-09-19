// ============================================================================
// CRAFT (ICARF) — Netlify Database schema (Drizzle ORM)
// ----------------------------------------------------------------------------
// This is the single source of truth for the platform's persistent data. Every
// table here maps onto a concept that previously lived only in mock data /
// in-memory React context (see src/lib/data.ts, context.tsx). Migrations are
// generated from this file with `drizzle-kit generate` and applied
// automatically by Netlify at deploy time.
//
// Column names are snake_case (Postgres convention); the Drizzle variable names
// stay camelCase so application code reads naturally.
// ============================================================================

import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core'

// --- organizations ----------------------------------------------------------
// A tenant: the institution being assessed. Multi-tenant isolation is enforced
// by scoping every read/write below by `org_id`.
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  country: text('country').notNull().default(''),
  targetDonor: text('target_donor').notNull().default(''),
  email: text('email').notNull().default(''),
  // Email of the Portfolio Reviewer accountable for this institution (if any).
  reviewer: text('reviewer'),
  // Email of the reviewer/admin who created the org — used to scope admin lists.
  createdBy: text('created_by'),
  archetype: text('archetype'),
  sector: text('sector'),
  subsector: text('subsector'),
  // Soft-archive flag: 'active' | 'archived'. Archived institutions are retained
  // (with all their data) but hidden from working surfaces and can be restored.
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).defaultNow(),
})

// --- users ------------------------------------------------------------------
// People with access to a workspace. Carries the view level (role) and the
// scope it applies to. Maps onto AuthUser + TeamMember in the front end.
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    title: text('title').notNull().default(''),
    orgId: text('org_id'),
    // 'assessor' | 'portfolio' | 'admin'
    role: text('role').notNull().default('assessor'),
    scopeId: text('scope_id'),
    scopeLabel: text('scope_label').notNull().default(''),
    portfolioId: text('portfolio_id'),
    // 'active' | 'invited'
    status: text('status').notNull().default('active'),
    invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    // Last time this person authenticated. Recorded on every sign-in so the
    // Super Admin directory can surface everyone who has ever signed in (not
    // only explicitly-assigned staff) and see who is currently active.
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => [unique('users_email_unique').on(t.email)],
)

// --- questions --------------------------------------------------------------
// The canonical assessment question bank (the 450-question CRAFT master bank
// plus lens/archetype extensions). Seeded from src/lib/data.ts. The `id` is the
// human-readable question code, e.g. 'GOV-01', 'FIN-13', 'CLIM-04'.
export const questions = pgTable(
  'questions',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull(),
    tier: integer('tier').notNull(),
    tierName: text('tier_name').notNull().default(''),
    question: text('question').notNull(),
    insight: text('insight').notNull().default(''),
    evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
    verificationMethod: text('verification_method').notNull().default(''),
    maxScore: integer('max_score').notNull().default(5),
    riskIfWeak: text('risk_if_weak').notNull().default('Moderate'),
    capacityAction: text('capacity_action').notNull().default(''),
    donorLink: text('donor_link').notNull().default(''),
    nationalLink: text('national_link').notNull().default(''),
    priority: text('priority').notNull().default('Moderate'),
    riskCategory: text('risk_category'),
    // Thematic lens: 'climate' | 'emergency' | 'research' | null (Core Foundation).
    lens: text('lens'),
    // Archetypes the question applies to; empty = universal.
    archetypes: jsonb('archetypes').$type<string[]>().notNull().default([]),
    scoringGuide: text('scoring_guide'),
    requiredDataRoomDoc: text('required_data_room_doc'),
  },
  (t) => [index('questions_domain_idx').on(t.domain), index('questions_tier_idx').on(t.tier)],
)

// --- assessments ------------------------------------------------------------
// The container for a single evaluation cycle of an organization. Tracks which
// thematic lenses were active and the workflow status.
export const assessments = pgTable('assessments', {
  id: serial('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  version: text('version').notNull().default('v3.0'),
  // 'draft' | 'in_progress' | 'pending_review' | 'verified' | 'archived'
  status: text('status').notNull().default('in_progress'),
  activeLenses: jsonb('active_lenses').$type<string[]>().notNull().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// --- responses --------------------------------------------------------------
// The actual assessment data: one row per (organization, question). Holds the
// self-score, the independent assessor score, and the negotiated/validated
// score that drives the Trust Delta logic. Replaces the in-memory
// `scores: Record<orgId, Record<qId, number>>` structure.
export const responses = pgTable(
  'responses',
  {
    id: serial('id').primaryKey(),
    orgId: text('org_id').notNull(),
    questionId: text('question_id').notNull(),
    score: integer('score').notNull().default(0),
    assessorScore: integer('assessor_score'),
    negotiatedScore: integer('negotiated_score'),
    evidenceUrl: text('evidence_url'),
    evidenceName: text('evidence_name'),
    notes: text('notes'),
    updatedBy: text('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique('responses_org_question_unique').on(t.orgId, t.questionId),
    index('responses_org_idx').on(t.orgId),
  ],
)

// --- capacity_actions -------------------------------------------------------
// The Capacity Improvement Plan (CIP): remediation actions derived from weak
// scores / findings, with a tracked status. Replaces the in-memory
// `cipStatuses: Record<riskId, RiskStatus>` map and CIPItem mock data.
export const capacityActions = pgTable(
  'capacity_actions',
  {
    id: serial('id').primaryKey(),
    orgId: text('org_id').notNull(),
    // The finding / risk id this action remediates (e.g. 'FIN-22').
    riskId: text('risk_id').notNull(),
    questionId: text('question_id'),
    domain: text('domain'),
    gapDescription: text('gap_description'),
    capacityAction: text('capacity_action'),
    owner: text('owner'),
    dueDate: text('due_date'),
    // RiskStatus: 'To-be-Initiated' | 'In-Progress' | 'On-Track' | 'Off-Track' |
    // 'Completed-Validated' | 'Completed-Invalidated'
    status: text('status').notNull().default('To-be-Initiated'),
    evidenceLink: text('evidence_link'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique('capacity_actions_org_risk_unique').on(t.orgId, t.riskId),
    index('capacity_actions_org_idx').on(t.orgId),
  ],
)

// --- compliance_items -------------------------------------------------------
// The unified Obligations & Reporting Calendar: donor filings, regulatory
// expiries, and capacity milestones with due dates. Queried by the daily
// compliance-alerts scheduled function for 90/30/overdue warnings. Replaces the
// Obligation mock seed in src/lib/obligations.ts.
export const complianceItems = pgTable(
  'compliance_items',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    name: text('name').notNull(),
    // 'reporting' | 'regulatory' | 'capacity'
    stream: text('stream').notNull().default('reporting'),
    // ObligationType, e.g. 'donor_financial', 'regulatory_expiry'
    type: text('type').notNull().default('donor_financial'),
    donorOrAuthority: text('donor_or_authority').notNull().default(''),
    // 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'one-off'
    frequency: text('frequency').notNull().default('annual'),
    nextDueDate: text('next_due_date').notNull(),
    country: text('country').notNull().default(''),
    sector: text('sector').notNull().default(''),
    owner: text('owner').notNull().default('Unassigned'),
    // 'pending' | 'submitted' | 'overdue'
    status: text('status').notNull().default('pending'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('compliance_items_org_idx').on(t.orgId)],
)

// --- audit_logs -------------------------------------------------------------
// Append-only record of workspace activity for fiduciary integrity. Replaces
// the in-memory `auditLog: AuditEntry[]`.
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    orgId: text('org_id'),
    actor: text('actor').notNull().default('system'),
    action: text('action').notNull(),
    target: text('target').notNull().default(''),
    // AuditEntry category: 'Auth' | 'Assessment' | 'Config' | ...
    category: text('category').notNull().default('Config'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('audit_logs_org_idx').on(t.orgId)],
)

// --- financial_triangulations ----------------------------------------------
// Universal donor-agnostic reconciliation records, keyed by organization and
// report context. Lock fields preserve the independent assessor's final action.
export const financialTriangulations = pgTable(
  'financial_triangulations',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    contextKey: text('context_key').notNull(),
    donorId: text('donor_id').notNull(),
    grantId: text('grant_id').notNull(),
    reportTypeId: text('report_type_id').notNull(),
    streamId: text('stream_id').notNull(),
    periodId: text('period_id').notNull(),
    openingBalance: integer('opening_balance').notNull().default(0),
    incomeReceived: integer('income_received').notNull().default(0),
    expenditures: integer('expenditures').notNull().default(0),
    adjustments: integer('adjustments').notNull().default(0),
    actualBankBalance: integer('actual_bank_balance').notNull().default(0),
    financeOfficerNotes: text('finance_officer_notes').notNull().default(''),
    grantManagerCommentary: text('grant_manager_commentary').notNull().default(''),
    assessorNotes: text('assessor_notes').notNull().default(''),
    verificationStatus: text('verification_status').notNull().default('verified'),
    status: text('status').notNull().default('draft'),
    lockedBy: text('locked_by'),
    lockedAt: text('locked_at'),
    history: jsonb('history').$type<string[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique('financial_triangulations_org_context_unique').on(t.orgId, t.contextKey),
    index('financial_triangulations_org_idx').on(t.orgId),
  ],
)

// --- portfolios -------------------------------------------------------------
// A named grouping of institutions a Portfolio Reviewer (or a consulting firm)
// administers. Persists what previously lived only in the in-memory
// `portfolios` state, so a reviewer's book of clients survives reloads. The
// membership is stored in the portfolio_orgs join table below.
export const portfolios = pgTable('portfolios', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // Email of the reviewer who owns the portfolio (unset for admin-created ones).
  reviewer: text('reviewer'),
  // Optional owning firm — when set, any member of the firm can see it (Phase 5).
  firmId: text('firm_id'),
  createdBy: text('created_by'),
  // Soft-archive flag: 'active' | 'archived' (mirrors organizations.status).
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).defaultNow(),
})

// --- portfolio_orgs ---------------------------------------------------------
// Join table: which institutions belong to which portfolio. Cascades on delete
// so removing a portfolio (or an org) cleans up its memberships.
export const portfolioOrgs = pgTable(
  'portfolio_orgs',
  {
    portfolioId: text('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
  },
  (t) => [
    unique('portfolio_orgs_pf_org_unique').on(t.portfolioId, t.orgId),
    index('portfolio_orgs_pf_idx').on(t.portfolioId),
  ],
)

// --- access_grants ----------------------------------------------------------
// The cross-tenant access model. An institution (org_id) grants a firm/reviewer
// (grantee email) scoped, revocable access to its results. Multi-tenant
// isolation is preserved: a reviewer may read a client's rows only while an
// `active` grant exists for (org_id, grantee). Revocation is a status flip, so
// data sovereignty always stays with the client.
export const accessGrants = pgTable(
  'access_grants',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    // Email of the firm/reviewer being granted access.
    grantee: text('grantee').notNull(),
    // Email of the client who granted (or will grant) access.
    grantedBy: text('granted_by'),
    // Optional owning firm — grants can be held by a firm rather than one email.
    firmId: text('firm_id'),
    // 'read' | 'write'
    level: text('level').notNull().default('read'),
    // Specialized ecosystem role for time-bound regulator/auditor grants, e.g.
    // 'cbn_examiner' | 'frcn_auditor' | 'sec_analyst' | 'sharia_board_member' |
    // 'rating_agency_analyst' | 'eu_csd_assessor'. Null for ordinary grants.
    role: text('role'),
    // When a time-bound grant expires (null = no expiry).
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    // 'pending' | 'active' | 'revoked'
    status: text('status').notNull().default('pending'),
    // The portfolio the client is added to on accept.
    portfolioId: text('portfolio_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    unique('access_grants_org_grantee_unique').on(t.orgId, t.grantee),
    index('access_grants_org_idx').on(t.orgId),
    index('access_grants_grantee_idx').on(t.grantee),
  ],
)

// --- invitations ------------------------------------------------------------
// Short-lived, tokenised invitations. When a firm invites a client, a row is
// created here and a branded welcome email (with the accept link carrying the
// token) is dispatched. On accept, the invitee provisions their own tenant and
// an access_grant is created back to the inviting reviewer.
export const invitations = pgTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull(),
    email: text('email').notNull(),
    inviter: text('inviter'),
    inviterName: text('inviter_name'),
    portfolioId: text('portfolio_id'),
    // 'assessor' | 'portfolio' | 'admin'
    role: text('role').notNull().default('assessor'),
    scopeLabel: text('scope_label').notNull().default(''),
    message: text('message'),
    // 'pending' | 'accepted' | 'expired' | 'revoked'
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    unique('invitations_token_unique').on(t.token),
    index('invitations_email_idx').on(t.email),
    index('invitations_inviter_idx').on(t.inviter),
  ],
)

// --- firms ------------------------------------------------------------------
// A first-class consulting firm: several consultants sharing one client book,
// instead of a single reviewer email. Portfolios and access grants can be held
// by a firm (firm_id) so any member sees the shared portfolio and its clients.
export const firms = pgTable('firms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// --- firm_members -----------------------------------------------------------
// Membership of a firm, with a role and independently-revocable status.
export const firmMembers = pgTable(
  'firm_members',
  {
    firmId: text('firm_id')
      .notNull()
      .references(() => firms.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // 'owner' | 'consultant'
    role: text('role').notNull().default('consultant'),
    // 'active' | 'invited' | 'revoked'
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique('firm_members_firm_email_unique').on(t.firmId, t.email),
    index('firm_members_firm_idx').on(t.firmId),
    index('firm_members_email_idx').on(t.email),
  ],
)

// --- response_notes ---------------------------------------------------------
// Threaded, multi-author commentary on an assessment answer: one row per note,
// scoped by (org_id, question_id) and OWNED by its author. Unlike the single
// consensus note on `responses.notes`, notes here never overwrite one another,
// so a self-assessor, an independent reviewer, a portfolio reviewer and an admin
// can each explain a score in their own voice — turning an opinionated number
// into attributed, defensible evidence.
//
// Privacy is enforced server-side, not by org scoping alone (staff and an
// external consultant intentionally share one tenant). `author_email` is set
// from the VERIFIED Netlify Identity session on write, and `visibility`
// ('private' | 'shared') plus author ownership drive read filtering, so a
// same-org colleague never sees another person's private note. New notes default
// to private; nothing is exposed by omission.
export const responseNotes = pgTable(
  'response_notes',
  {
    id: serial('id').primaryKey(),
    orgId: text('org_id').notNull(),
    questionId: text('question_id').notNull(),
    authorEmail: text('author_email').notNull().default(''),
    authorName: text('author_name').notNull().default(''),
    // ViewLevel at time of writing: 'assessor' | 'independent' | 'portfolio' | 'admin'
    authorRole: text('author_role').notNull().default('assessor'),
    body: text('body').notNull().default(''),
    // 'private' (author-only, the default) | 'shared' (visible to the whole org)
    visibility: text('visibility').notNull().default('private'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('response_notes_org_idx').on(t.orgId),
    index('response_notes_org_question_idx').on(t.orgId, t.questionId),
  ],
)

export type OrganizationRow = typeof organizations.$inferSelect
export type UserRow = typeof users.$inferSelect
export type QuestionRow = typeof questions.$inferSelect
export type AssessmentRow = typeof assessments.$inferSelect
export type ResponseRow = typeof responses.$inferSelect
export type CapacityActionRow = typeof capacityActions.$inferSelect
export type ComplianceItemRow = typeof complianceItems.$inferSelect
export type AuditLogRow = typeof auditLogs.$inferSelect
export type FinancialTriangulationRow = typeof financialTriangulations.$inferSelect
export type PortfolioRow = typeof portfolios.$inferSelect
export type PortfolioOrgRow = typeof portfolioOrgs.$inferSelect
export type AccessGrantRow = typeof accessGrants.$inferSelect
export type InvitationRow = typeof invitations.$inferSelect
export type FirmRow = typeof firms.$inferSelect
export type FirmMemberRow = typeof firmMembers.$inferSelect
export type ResponseNoteRow = typeof responseNotes.$inferSelect

// --- section 11 disclosures -------------------------------------------------
// Persisted verification state for the "Section 11: Integrated Reporting &
// Statutory Disclosures" vault (Feature 5). One row per (org, sub-folder), so
// the regulator/auditor vault survives reloads rather than resetting to a demo
// seed. Status mirrors the vault UI: 'Pending' | 'Assessor Verified' |
// 'Rejected (Requires Resubmission)'.
export const section11Disclosures = pgTable(
  'section11_disclosures',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    folderKey: text('folder_key').notNull(),
    status: text('status').notNull().default('Pending'),
    updatedBy: text('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique('section11_org_folder_unique').on(t.orgId, t.folderKey),
    index('section11_org_idx').on(t.orgId),
  ],
)

export type Section11DisclosureRow = typeof section11Disclosures.$inferSelect
