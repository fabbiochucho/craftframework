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
  boolean,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core'

export { offlineFrameworks, offlineFrameworkReceipts } from './offline-schema.ts'

// --- organizations ----------------------------------------------------------
// A tenant: the institution being assessed. Multi-tenant isolation is enforced
// by scoping every read/write below by `org_id`.
export const organizations = pgTable(
  'organizations',
  {
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
  },
  // Both columns are filtered on directly in the access-control path
  // (filterAuthorizedOrgIds / the admin org list) — previously unindexed.
  (t) => [index('organizations_created_by_idx').on(t.createdBy), index('organizations_reviewer_idx').on(t.reviewer)],
)

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

// ============================================================================
// Workspace platform (governance, ESG, CAP, evidence, reports, audit)
// ----------------------------------------------------------------------------
// Every workspace-scoped table carries `org_id` so tenant isolation (row-level
// security) can be enforced uniformly: each query is filtered by the org id
// resolved from the verified session — never trusted from the request.
// Tables are prefixed `ws_` to avoid clashing with the legacy tables above.
// ============================================================================

export const wsOrganizations = pgTable('ws_organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  // 'government' | 'ngo' | 'private'
  type: text('type').notNull().default('private'),
  country: text('country').notNull().default(''),
  region: text('region').notNull().default(''),
  contactEmail: text('contact_email').notNull().default(''),
  contactPhone: text('contact_phone').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const wsOrgMembers = pgTable(
  'ws_org_members',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    userIdHash: text('user_id_hash'),
    orgId: integer('org_id').notNull(),
    // 'owner' | 'admin' | 'assessor' | 'viewer'
    role: text('role').notNull().default('viewer'),
    permissions: integer('permissions').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('ws_org_members_user_org_uq').on(t.userId, t.orgId),
    unique('ws_org_members_user_hash_org_uq').on(t.userIdHash, t.orgId),
    index('ws_org_members_org_idx').on(t.orgId),
  ],
)

export const workspaces = pgTable(
  'workspaces',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceName: text('workspace_name').notNull(),
    description: text('description').notNull().default(''),
    // 'active' | 'archived'
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('workspaces_org_idx').on(t.orgId), unique('workspaces_org_id_id_unique').on(t.orgId, t.id)],
)

// --- governance -------------------------------------------------------------
export const governanceAssessments = pgTable(
  'governance_assessments',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    // 'G2G' | 'ISO' | 'COSO'
    assessmentType: text('assessment_type').notNull().default('G2G'),
    version: integer('version').notNull().default(1),
    // 'draft' | 'in_review' | 'approved'
    status: text('status').notNull().default('draft'),
    createdBy: text('created_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    findingsCount: integer('findings_count').notNull().default(0),
  },
  (t) => [index('governance_assessments_ws_idx').on(t.orgId, t.workspaceId)],
)

export const governanceScores = pgTable(
  'governance_scores',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    assessmentId: integer('assessment_id').notNull(),
    pillar: text('pillar').notNull(),
    domain: text('domain').notNull(),
    // Tier 1-5 derived from the 0-5 slider score
    tierLevel: integer('tier_level').notNull().default(1),
    evidenceUploaded: boolean('evidence_uploaded').notNull().default(false),
    reviewerNotes: text('reviewer_notes').notNull().default(''),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (t) => [unique('governance_scores_uq').on(t.assessmentId, t.pillar, t.domain)],
)

export const governanceFindings = pgTable(
  'governance_findings',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    assessmentId: integer('assessment_id').notNull(),
    domain: text('domain').notNull(),
    // 'critical' | 'high' | 'medium' | 'low'
    severity: text('severity').notNull().default('medium'),
    description: text('description').notNull(),
    sensitive: boolean('sensitive').notNull().default(false),
    recommendation: text('recommendation').notNull().default(''),
    evidenceLink: text('evidence_link'),
    ownerAssignment: text('owner_assignment'),
    dueDate: date('due_date'),
    // 'open' | 'in_progress' | 'resolved'
    status: text('status').notNull().default('open'),
  },
  (t) => [index('governance_findings_assessment_idx').on(t.orgId, t.assessmentId)],
)

// --- ESG --------------------------------------------------------------------
export const esgFrameworks = pgTable(
  'esg_frameworks',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    // 'ESRS' | 'ISSB' | 'GRI' | custom
    frameworkName: text('framework_name').notNull(),
    jurisdiction: text('jurisdiction').notNull().default('global'),
    // 'all' | 'sector_specific'
    applicability: text('applicability').notNull().default('all'),
    // 'available' | 'adopted'
    adoptionStatus: text('adoption_status').notNull().default('available'),
  },
  (t) => [index('esg_frameworks_ws_idx').on(t.orgId, t.workspaceId)],
)

export const esgRequirements = pgTable(
  'esg_requirements',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    frameworkId: integer('framework_id').notNull(),
    requirementId: text('requirement_id').notNull(),
    requirementText: text('requirement_text').notNull(),
    // 'environmental' | 'social' | 'governance'
    category: text('category').notNull().default('governance'),
    priority: text('priority').notNull().default('medium'),
    implementationDeadline: date('implementation_deadline'),
  },
  (t) => [index('esg_requirements_framework_idx').on(t.orgId, t.frameworkId)],
)

export const esgImplementationPlans = pgTable(
  'esg_implementation_plans',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    requirementId: integer('requirement_id').notNull(),
    owner: text('owner'),
    // 'not_started' | 'in_progress' | 'completed'
    status: text('status').notNull().default('not_started'),
    timelineStart: date('timeline_start'),
    timelineEnd: date('timeline_end'),
    milestone1: text('milestone_1'),
    milestone2: text('milestone_2'),
    milestone3: text('milestone_3'),
    evidenceCount: integer('evidence_count').notNull().default(0),
  },
  (t) => [index('esg_plans_ws_idx').on(t.orgId, t.workspaceId)],
)

export const esgMilestones = pgTable(
  'esg_milestones',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    planId: integer('plan_id').notNull(),
    milestoneNum: integer('milestone_num').notNull(),
    description: text('description').notNull().default(''),
    targetDate: date('target_date'),
    status: text('status').notNull().default('not_started'),
    completionEvidenceLink: text('completion_evidence_link'),
  },
  (t) => [index('esg_milestones_plan_idx').on(t.orgId, t.planId)],
)

// --- Corrective Action Plans -------------------------------------------------
export const capRecords = pgTable(
  'cap_records',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    // 'governance_finding' | 'esg_requirement' | 'disclosure_finding' | 'manual'
    sourceType: text('source_type').notNull().default('manual'),
    sourceId: integer('source_id'),
    findingDescription: text('finding_description').notNull(),
    severity: text('severity').notNull().default('medium'),
    correctiveAction: text('corrective_action').notNull().default(''),
    assignedTo: text('assigned_to'),
    dueDate: date('due_date'),
    // 'open' | 'in_progress' | 'completed' | 'overdue'
    status: text('status').notNull().default('open'),
    completionDate: timestamp('completion_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('cap_records_ws_idx').on(t.orgId, t.workspaceId)],
)

export const actionItems = pgTable(
  'action_items',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    capId: integer('cap_id').notNull(),
    sequenceNum: integer('sequence_num').notNull().default(1),
    actionDescription: text('action_description').notNull(),
    owner: text('owner'),
    targetDate: date('target_date'),
    status: text('status').notNull().default('open'),
    evidenceUploadedAt: timestamp('evidence_uploaded_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [index('action_items_cap_idx').on(t.orgId, t.capId)],
)

export const actionLogs = pgTable(
  'action_logs',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    actionId: integer('action_id').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    actorId: text('actor_id').notNull(),
    // 'created' | 'updated' | 'assigned' | 'completed'
    event: text('event').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
  },
  (t) => [index('action_logs_action_idx').on(t.orgId, t.actionId)],
)

// --- Evidence registry --------------------------------------------------------
export const evidenceRegistry = pgTable(
  'evidence_registry',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    documentName: text('document_name').notNull(),
    // 'assessment' | 'policy' | 'evidence' | 'certification'
    documentType: text('document_type').notNull().default('evidence'),
    uploadedBy: text('uploaded_by').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
    // Netlify Blobs key (or S3 path)
    filePath: text('file_path').notNull(),
    fileSizeKb: integer('file_size_kb').notNull().default(0),
    mimeType: text('mime_type').notNull().default('application/octet-stream'),
    expiryDate: date('expiry_date'),
    // 'pending_review' | 'approved' | 'rejected' | 'expired'
    status: text('status').notNull().default('pending_review'),
    // Soft delete
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [index('evidence_registry_ws_idx').on(t.orgId, t.workspaceId)],
)

export const evidenceLinks = pgTable(
  'evidence_links',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    evidenceId: integer('evidence_id').notNull(),
    // Polymorphic target: 'cap' | 'assessment' | 'requirement'
    targetType: text('target_type').notNull(),
    targetId: integer('target_id').notNull(),
    // 'supports' | 'verifies'
    linkType: text('link_type').notNull().default('supports'),
    reviewerNotes: text('reviewer_notes').notNull().default(''),
    approvedBy: text('approved_by'),
    approvalDate: timestamp('approval_date', { withTimezone: true }),
  },
  (t) => [index('evidence_links_evidence_idx').on(t.orgId, t.evidenceId), index('evidence_links_target_idx').on(t.targetType, t.targetId)],
)

export const documentApprovals = pgTable(
  'document_approvals',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    evidenceId: integer('evidence_id').notNull(),
    reviewerId: text('reviewer_id').notNull(),
    reviewDate: timestamp('review_date', { withTimezone: true }).defaultNow().notNull(),
    // 'approved' | 'rejected'
    status: text('status').notNull(),
    comments: text('comments').notNull().default(''),
  },
  (t) => [index('document_approvals_evidence_idx').on(t.orgId, t.evidenceId)],
)

// --- Reports ----------------------------------------------------------------------
export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    // 'governance_scorecard' | 'esg_status' | 'cap_summary' | 'compliance_dashboard' | 'audit_trail'
    reportType: text('report_type').notNull(),
    generatedBy: text('generated_by').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    dataAsOfDate: date('data_as_of_date').notNull(),
    // { open_findings_by_severity, cap_progress, compliance_percent, expiry_alerts }
    statusSnapshot: jsonb('status_snapshot').notNull().default({}),
  },
  (t) => [index('reports_ws_idx').on(t.orgId, t.workspaceId)],
)

export const reportVersions = pgTable(
  'report_versions',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    reportId: integer('report_id').notNull(),
    versionNum: integer('version_num').notNull().default(1),
    pdfUrl: text('pdf_url'),
    jsonExportUrl: text('json_export_url'),
    emailSentTo: text('email_sent_to'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
  },
  (t) => [index('report_versions_report_idx').on(t.orgId, t.reportId)],
)

// --- Audit & support ------------------------------------------------------------------
export const wsAuditLog = pgTable(
  'ws_audit_log',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id'),
    actorId: text('actor_id').notNull(),
    // 'assessment' | 'cap' | 'evidence' | 'org' | ...
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    // 'create' | 'read' | 'update' | 'delete'
    action: text('action').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    details: jsonb('details').notNull().default({}),
  },
  (t) => [index('ws_audit_log_org_idx').on(t.orgId, t.workspaceId)],
)

export const supportIssues = pgTable(
  'support_issues',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id'),
    workspaceId: integer('workspace_id'),
    // 'bug' | 'feature' | 'question' | 'documentation'
    category: text('category').notNull().default('question'),
    description: text('description').notNull(),
    contactEmail: text('contact_email').notNull().default(''),
    githubIssueUrl: text('github_issue_url'),
    capId: integer('cap_id'),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
)

export const supportEscalations = pgTable('support_escalations', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  message: text('message').notNull(),
  contactEmail: text('contact_email').notNull(),
  category: text('category').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const supportIssueResponses = pgTable(
  'support_issue_responses',
  {
    id: serial('id').primaryKey(),
    issueId: integer('issue_id').notNull(),
    responder: text('responder').notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('support_issue_responses_issue_idx').on(t.issueId)],
)

export const reportSchedules = pgTable(
  'report_schedules',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    reportType: text('report_type').notNull(),
    cadence: text('cadence').notNull(),
    recipients: jsonb('recipients').$type<string[]>().notNull().default([]),
    format: text('format').notNull().default('pdf'),
    paused: boolean('paused').notNull().default(false),
    scheduleDay: integer('schedule_day').notNull().default(1),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('report_schedules_due_idx').on(t.paused, t.nextRunAt), index('report_schedules_workspace_idx').on(t.orgId, t.workspaceId)],
)

export const gdprRequests = pgTable(
  'gdpr_requests',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    requestedBy: text('requested_by').notNull(),
    requestType: text('request_type').notNull(),
    status: text('status').notNull().default('pending'),
    approvedBy: text('approved_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (t) => [index('gdpr_requests_org_idx').on(t.orgId, t.status)],
)

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
)
