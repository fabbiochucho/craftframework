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
  numeric,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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
  // Directory profile (validator system). null kind = an original consulting
  // firm (client book only, never listed); 'validator_firm' | 'funding_partner'
  // makes it a directory profile whose firm_members are its team / staff.
  kind: text('kind'),
  // Validator firm nature or funding-partner type (src/lib/validatorDirectory.ts).
  nature: text('nature'),
  summary: text('summary').notNull().default(''),
  competencies: jsonb('competencies').$type<string[]>().notNull().default([]),
  countries: jsonb('countries').$type<string[]>().notNull().default([]),
  sectors: jsonb('sectors').$type<string[]>().notNull().default([]),
  ticketSize: text('ticket_size'),
}, (t) => [index('firms_kind_idx').on(t.kind)])

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

// --- validator_profiles -----------------------------------------------------
// A person's validator profile (open onboarding). The public id is used in
// directory URLs so the email (a contact detail) is never exposed.
// A platform admin can only suspend / reinstate (recorded reason); accreditation itself is earned (accredited_until).
export const validatorProfiles = pgTable('validator_profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  bio: text('bio').notNull().default(''),
  competencies: jsonb('competencies').$type<string[]>().notNull().default([]),
  frameworks: jsonb('frameworks').$type<string[]>().notNull().default([]),
  countries: jsonb('countries').$type<string[]>().notNull().default([]),
  languages: jsonb('languages').$type<string[]>().notNull().default([]),
  // 'registered' | 'accredited' | 'suspended'
  accreditationStatus: text('accreditation_status').notNull().default('registered'),
  accreditationReason: text('accreditation_reason'),
  pilotAccredited: boolean('pilot_accredited').notNull().default(false),
  accreditationChangedBy: text('accreditation_changed_by'),
  accreditationChangedAt: timestamp('accreditation_changed_at', { withTimezone: true }),
  // Training and accreditation (PR 4): set ONLY server-side, by passing the programme
  // (now + 1 year) or by annual renewal. Null = never accredited. Past = lapsed.
  accreditedUntil: timestamp('accredited_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Professional memberships: self-declared until a platform admin verifies one
// against the body's public register. Editing = delete + re-add, so a changed
// number can never keep an old verification.
export const validatorCredentials = pgTable(
  'validator_credentials',
  {
    id: text('id').primaryKey(),
    validatorId: text('validator_id').notNull().references(() => validatorProfiles.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    membershipNumber: text('membership_number').notNull(),
    verifiedBy: text('verified_by'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('validator_credentials_validator_idx').on(t.validatorId)],
)

// An organisation's opt-in directory listing (off by default). Name, country
// and sector come from `organizations`; never scores, evidence or comments.
// The random `id` is used in directory URLs because legacy org ids can embed an email.
export const orgDirectoryProfiles = pgTable('org_directory_profiles', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().unique().references(() => organizations.id, { onDelete: 'cascade' }),
  listed: boolean('listed').notNull().default(false),
  summary: text('summary').notNull().default(''),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- validation_engagements -------------------------------------------------
// Validator system PR 2. An engagement ties an organisation's CRAFT results to
// an independent validation (or a funder's own review). Created by the
// organisation, a funding partner (with the organisation's consent) or a
// validator / validator firm; every required party accepts and the
// organisation always consents. Framework-agnostic: `framework` is a key.
export const validationEngagements = pgTable(
  'validation_engagements',
  {
    id: text('id').primaryKey(),
    framework: text('framework').notNull().default('capital-readiness'),
    scope: jsonb('scope').$type<{ kind: 'whole' } | { kind: 'levels'; levels: number[] }>().notNull().default({ kind: 'whole' }),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    // 'independent_validation' | 'funder_review'
    type: text('type').notNull(),
    createdBy: text('created_by').notNull(),
    // 'organization' | 'validator' | 'funder'
    createdBySide: text('created_by_side').notNull(),
    validatorFirmId: text('validator_firm_id').references(() => firms.id, { onDelete: 'set null' }),
    // Lead validator when engaged as an individual rather than through a firm.
    validatorEmail: text('validator_email'),
    funderFirmId: text('funder_firm_id').references(() => firms.id, { onDelete: 'set null' }),
    // Each: 'pending' | 'accepted' | 'declined' | 'not_required'
    orgStatus: text('org_status').notNull().default('pending'),
    validatorStatus: text('validator_status').notNull().default('pending'),
    funderStatus: text('funder_status').notNull().default('pending'),
    orgConsentedBy: text('org_consented_by'),
    orgConsentedAt: timestamp('org_consented_at', { withTimezone: true }),
    declinedSide: text('declined_side'),
    declinedBy: text('declined_by'),
    declineReason: text('decline_reason'),
    requiresRereview: boolean('requires_rereview').notNull().default(false),
    accessDays: integer('access_days').notNull().default(90),
    // 'proposed' | 'active' | 'declined' | 'cancelled' | 'expired'
    status: text('status').notNull().default('proposed'),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }).notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by'),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('validation_engagements_org_idx').on(t.orgId),
    index('validation_engagements_validator_firm_idx').on(t.validatorFirmId),
    index('validation_engagements_funder_firm_idx').on(t.funderFirmId),
  ],
)

// Named team members. Firm membership alone grants nothing: a person gets a
// time-limited read-only access_grants row only while they are `named`, the
// organisation has approved them, they signed the declaration and the
// engagement is active (netlify/lib/engagement-access.ts).
export const engagementMembers = pgTable(
  'engagement_members',
  {
    id: text('id').primaryKey(),
    engagementId: text('engagement_id').notNull().references(() => validationEngagements.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // 'lead' | 'member'
    role: text('role').notNull().default('member'),
    // 'named' | 'declined' | 'removed'
    status: text('status').notNull().default('named'),
    orgApproved: boolean('org_approved').notNull().default(false),
    addedBy: text('added_by').notNull(),
    grantId: text('grant_id'),
    grantedAt: timestamp('granted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('engagement_members_engagement_email_unique').on(t.engagementId, t.email),
    index('engagement_members_email_idx').on(t.email),
  ],
)

// The signed, versioned independence / conflict-of-interest declaration. The
// full text is stored with each signature so a later wording change never
// rewrites what was signed.
export const engagementDeclarations = pgTable(
  'engagement_declarations',
  {
    id: text('id').primaryKey(),
    engagementId: text('engagement_id').notNull().references(() => validationEngagements.id, { onDelete: 'cascade' }),
    memberEmail: text('member_email').notNull(),
    version: text('version').notNull(),
    text: text('text').notNull(),
    fundedDisclosure: boolean('funded_disclosure').notNull().default(false),
    disclosure: text('disclosure').notNull().default(''),
    signedName: text('signed_name').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('engagement_declarations_unique').on(t.engagementId, t.memberEmail, t.version)],
)

// A consultant's PROPOSED directory listing for an organisation they hold an
// access grant to. Never live until the organisation's own staff approve it;
// one pending proposal per organisation (partial unique index in the migration).
export const orgListingProposals = pgTable(
  'org_listing_proposals',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    proposedBy: text('proposed_by').notNull(),
    summary: text('summary').notNull().default(''),
    // 'pending' | 'approved' | 'rejected' | 'withdrawn'
    status: text('status').notNull().default('pending'),
    decidedBy: text('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('org_listing_proposals_org_idx').on(t.orgId),
    index('org_listing_proposals_proposer_idx').on(t.proposedBy),
    uniqueIndex('org_listing_proposals_one_pending').on(t.orgId).where(sql`${t.status} = 'pending'`),
  ],
)

// --- validation_reviews -----------------------------------------------------
// Validator system PR 3. One review per engagement: the validator's own 0-5
// scores per indicator, method, fieldwork dates, optional debrief, outcome and
// qualifications. Finalising freezes a snapshot (and its SHA-256); later
// self-score changes never alter it, and a finalised review is never edited.
export const validationReviews = pgTable('validation_reviews', {
  id: text('id').primaryKey(),
  engagementId: text('engagement_id').notNull().unique().references(() => validationEngagements.id, { onDelete: 'cascade' }),
  // 'document_review' | 'sample_testing' | 'interviews' | 'site_visit' | 'combined'
  method: text('method'),
  fieldworkStart: date('fieldwork_start', { mode: 'string' }),
  fieldworkEnd: date('fieldwork_end', { mode: 'string' }),
  // 'draft' | 'debrief' | 'finalised'
  status: text('status').notNull().default('draft'),
  // 'validated' | 'validated_with_qualifications' | 'not_validated'
  outcome: text('outcome'),
  outcomeSummary: text('outcome_summary').notNull().default(''),
  validatedRung: integer('validated_rung'),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>(),
  snapshotSha256: text('snapshot_sha256'),
  finalisedAt: timestamp('finalised_at', { withTimezone: true }),
  finalisedBy: text('finalised_by'),
  // Set once the organisation was emailed that the debrief is open.
  debriefNotifiedAt: timestamp('debrief_notified_at', { withTimezone: true }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const validationScores = pgTable(
  'validation_scores',
  {
    reviewId: text('review_id').notNull().references(() => validationReviews.id, { onDelete: 'cascade' }),
    indicatorId: text('indicator_id').notNull(),
    score: integer('score').notNull(),
    // 'sufficient' | 'partial' | 'insufficient'
    sufficiency: text('sufficiency').notNull().default('sufficient'),
    comment: text('comment').notNull().default(''),
    evidenceRef: text('evidence_ref').notNull().default(''),
    scoredBy: text('scored_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.indicatorId] })],
)

export const validationDebriefs = pgTable(
  'validation_debriefs',
  {
    reviewId: text('review_id').notNull().references(() => validationReviews.id, { onDelete: 'cascade' }),
    indicatorId: text('indicator_id').notNull(),
    orgResponse: text('org_response').notNull().default(''),
    respondedBy: text('responded_by'),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    negotiatedScore: integer('negotiated_score'),
    negotiatedBy: text('negotiated_by'),
    negotiatedAt: timestamp('negotiated_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.indicatorId] })],
)

export const validationQualifications = pgTable(
  'validation_qualifications',
  {
    id: text('id').primaryKey(),
    reviewId: text('review_id').notNull().references(() => validationReviews.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    indicatorIds: jsonb('indicator_ids').$type<string[]>().notNull().default([]),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('validation_qualifications_review_idx').on(t.reviewId)],
)

// --- validations (lifecycle) --------------------------------------------------
// Validator system PR 5. The issued validation that a finalised review produces:
// its validity, follow-up schedule and stored status decisions. 'Follow-up
// overdue' and 'expired' are never stored: they follow the calendar
// (src/lib/validationLifecycle.ts). Reviews and snapshots stay frozen.
export const validations = pgTable(
  'validations',
  {
    id: text('id').primaryKey(),
    reviewId: text('review_id').notNull().unique().references(() => validationReviews.id, { onDelete: 'cascade' }),
    engagementId: text('engagement_id').notNull().references(() => validationEngagements.id, { onDelete: 'cascade' }),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    framework: text('framework').notNull(),
    // 'validated' | 'validated_with_qualifications'
    outcome: text('outcome').notNull(),
    validatedRung: integer('validated_rung').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    validityMonths: integer('validity_months').notNull(),
    validityReason: text('validity_reason').notNull().default(''),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    surveillanceDueAt: timestamp('surveillance_due_at', { withTimezone: true }),
    surveillanceDoneAt: timestamp('surveillance_done_at', { withTimezone: true }),
    trackedIndicators: jsonb('tracked_indicators').$type<string[]>().notNull().default([]),
    // 'milestone' | 'fixed_3' | 'fixed_6' | 'end_of_plan'
    followUpMode: text('follow_up_mode').notNull().default('milestone'),
    followUpSetBy: text('follow_up_set_by'),
    followUpSetAt: timestamp('follow_up_set_at', { withTimezone: true }),
    // 'current' | 'suspended' | 'withdrawn' | 'superseded'
    status: text('status').notNull().default('current'),
    statusReason: text('status_reason'),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
    statusChangedBy: text('status_changed_by'),
    supersededBy: text('superseded_by'),
    // Public verification (PR 6): random CRAFT-V-XXXXXXXX, and what the organisation chooses to publish.
    verificationId: text('verification_id'),
    publicOptions: jsonb('public_options').$type<{ registrationNumber?: string; showRungHistory?: boolean; showQualifications?: boolean; devmapperUrl?: string }>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('validations_org_idx').on(t.orgId, t.framework), index('validations_engagement_idx').on(t.engagementId)],
)

export const validationEvents = pgTable(
  'validation_events',
  {
    id: text('id').primaryKey(),
    validationId: text('validation_id').notNull().references(() => validations.id, { onDelete: 'cascade' }),
    eventKey: text('event_key').notNull(),
    details: text('details').notNull().default(''),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
    reportedBy: text('reported_by').notNull(),
    // 'organization' | 'programme'
    reportedBySide: text('reported_by_side').notNull(),
    deadlineOn: date('deadline_on', { mode: 'string' }).notNull(),
    late: boolean('late').notNull().default(false),
    // 'open' | 'reinstated' | 're_scoped' | 'withdrawn'
    status: text('status').notNull().default('open'),
    orgResponse: text('org_response').notNull().default(''),
    orgRespondedAt: timestamp('org_responded_at', { withTimezone: true }),
    decidedBy: text('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note').notNull().default(''),
  },
  (t) => [index('validation_events_validation_idx').on(t.validationId)],
)

export const validationFollowUps = pgTable(
  'validation_follow_ups',
  {
    id: text('id').primaryKey(),
    validationId: text('validation_id').notNull().references(() => validations.id, { onDelete: 'cascade' }),
    dueOn: date('due_on', { mode: 'string' }).notNull(),
    // 'confirmed' | 'concerns'
    result: text('result').notNull(),
    note: text('note').notNull().default(''),
    completedBy: text('completed_by').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('validation_follow_ups_due_unique').on(t.validationId, t.dueOn)],
)

export const validationNotifications = pgTable(
  'validation_notifications',
  {
    id: serial('id').primaryKey(),
    validationId: text('validation_id').notNull().references(() => validations.id, { onDelete: 'cascade' }),
    // 'follow_up' | 'expiry' | 'surveillance'
    kind: text('kind').notNull(),
    dueOn: date('due_on', { mode: 'string' }).notNull(),
    offsetDays: integer('offset_days').notNull(),
    recipient: text('recipient').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('validation_notifications_unique').on(t.validationId, t.kind, t.dueOn, t.offsetDays, t.recipient)],
)

// --- CIP follow-up, funder consent, status history and checkpoints -----------------------
// The organisation's improvement actions for a validation. A done action always has an
// owner, a due date and proof (also enforced by a CHECK). They drive the follow-up schedule:
// the CIP can bring a check forward, never extend validity (src/lib/validationLifecycle.ts).
export const validationCipActions = pgTable(
  'validation_cip_actions',
  {
    id: text('id').primaryKey(),
    validationId: text('validation_id').notNull().references(() => validations.id, { onDelete: 'cascade' }),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    indicatorIds: jsonb('indicator_ids').$type<string[]>().notNull().default([]),
    owner: text('owner'),
    dueDate: date('due_date', { mode: 'string' }),
    // 'open' | 'done'
    status: text('status').notNull().default('open'),
    proof: text('proof').notNull().default(''),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneBy: text('done_by'),
    // The qualification this action answers, when it was created from one.
    qualificationId: text('qualification_id'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('validation_cip_actions_validation_idx').on(t.validationId), index('validation_cip_actions_org_idx').on(t.orgId)],
)

// The organisation lets a funding partner see schedule and progress (counts, dates, status), nothing more.
export const validationFunderConsents = pgTable(
  'validation_funder_consents',
  {
    id: text('id').primaryKey(),
    validationId: text('validation_id').notNull().references(() => validations.id, { onDelete: 'cascade' }),
    funderFirmId: text('funder_firm_id').notNull().references(() => firms.id, { onDelete: 'cascade' }),
    grantedBy: text('granted_by').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: text('revoked_by'),
  },
  (t) => [unique('validation_funder_consents_unique').on(t.validationId, t.funderFirmId), index('validation_funder_consents_firm_idx').on(t.funderFirmId)],
)

export const validationStatusHistory = pgTable(
  'validation_status_history',
  {
    id: text('id').primaryKey(),
    validationId: text('validation_id').notNull().references(() => validations.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    reason: text('reason').notNull().default(''),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('validation_status_history_validation_idx').on(t.validationId, t.createdAt)],
)

export const validationCheckpoints = pgTable(
  'validation_checkpoints',
  {
    id: text('id').primaryKey(),
    validationId: text('validation_id').notNull().references(() => validations.id, { onDelete: 'cascade' }),
    // 'surveillance' | 'follow_up'
    kind: text('kind').notNull(),
    dueOn: date('due_on', { mode: 'string' }).notNull(),
    indicatorIds: jsonb('indicator_ids').$type<string[]>().notNull().default([]),
    // 'pending' | 'done'
    state: text('state').notNull().default('pending'),
    // 'confirmed' | 'concerns'
    result: text('result'),
    note: text('note').notNull().default(''),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneBy: text('done_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('validation_checkpoints_unique').on(t.validationId, t.kind, t.dueOn), index('validation_checkpoints_validation_idx').on(t.validationId)],
)

export const validationStatements = pgTable('validation_statements', {
  validationId: text('validation_id').primaryKey().references(() => validations.id, { onDelete: 'cascade' }),
  pdfBase64: text('pdf_base64').notNull(),
  sha256: text('sha256').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const validationConcerns = pgTable(
  'validation_concerns',
  {
    id: text('id').primaryKey(),
    validationId: text('validation_id').notNull().references(() => validations.id, { onDelete: 'cascade' }),
    // 'inaccurate' | 'conduct' | 'material_event' | 'other'
    category: text('category').notNull(),
    message: text('message').notNull(),
    contactName: text('contact_name').notNull().default(''),
    contactEmail: text('contact_email').notNull().default(''),
    // 'new' | 'in_review' | 'closed'
    status: text('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    handledBy: text('handled_by'),
    handledAt: timestamp('handled_at', { withTimezone: true }),
  },
  (t) => [index('validation_concerns_validation_idx').on(t.validationId)],
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
export type ValidatorProfileRow = typeof validatorProfiles.$inferSelect
export type ValidatorCredentialRow = typeof validatorCredentials.$inferSelect
export type ValidationEngagementRow = typeof validationEngagements.$inferSelect
export type ValidationReviewRow = typeof validationReviews.$inferSelect
export type ValidationRow = typeof validations.$inferSelect
// --- validation_ratings -------------------------------------------------------
// Validator system PR 7. Feedback on the lead validator from a party to a finalised independent
// validation (the organisation, the engaging funding partner): once per party per engagement.
// The validator may reply publicly; a removal (false or abusive feedback) keeps the row and the reason.
export const validationRatings = pgTable(
  'validation_ratings',
  {
    id: text('id').primaryKey(),
    engagementId: text('engagement_id').notNull().references(() => validationEngagements.id, { onDelete: 'cascade' }),
    validationId: text('validation_id').references(() => validations.id, { onDelete: 'set null' }),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    // 'organisation' | 'funder'
    party: text('party').notNull(),
    raterEmail: text('rater_email').notNull(),
    validatorEmail: text('validator_email').notNull(),
    validatorFirmId: text('validator_firm_id').references(() => firms.id, { onDelete: 'set null' }),
    stars: integer('stars').notNull(),
    comment: text('comment').notNull().default(''),
    reply: text('reply').notNull().default(''),
    replyBy: text('reply_by'),
    replyAt: timestamp('reply_at', { withTimezone: true }),
    // 'published' | 'removed'
    status: text('status').notNull().default('published'),
    removedBy: text('removed_by'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removalGround: text('removal_ground'),
    removalReason: text('removal_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('validation_ratings_one_per_party').on(t.engagementId, t.party),
    index('validation_ratings_validator_idx').on(t.validatorEmail),
    index('validation_ratings_firm_idx').on(t.validatorFirmId),
  ],
)

export type CipActionRow = typeof validationCipActions.$inferSelect
export type CheckpointRow = typeof validationCheckpoints.$inferSelect
export type ValidationEventRow = typeof validationEvents.$inferSelect
export type EngagementMemberRow = typeof engagementMembers.$inferSelect
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
  // Verification of a restricted organisation type (NPHI): 'not_required' | 'pending' | 'verified' | 'rejected'.
  typeVerification: text('type_verification').notNull().default('not_required'),
  // 'email_domain' (admin's email on a registered NPHI domain) | 'manual' (confirmed by a platform operator)
  typeVerificationMethod: text('type_verification_method'),
  typeVerifiedBy: text('type_verified_by'),
  typeVerifiedAt: timestamp('type_verified_at', { withTimezone: true }),
  typeVerificationNote: text('type_verification_note').notNull().default(''),
  // Members must use multi-factor sign-in to reach this organisation's data.
  requireMfa: boolean('require_mfa').notNull().default(false),
})

// Multi-factor sign-in (TOTP) per user. The secret is field-encrypted; recovery codes are stored as hashes.
export const userMfa = pgTable('user_mfa', {
  userKey: text('user_key').primaryKey(), // sha256 of the normalised email (netlify/lib/mfa.ts mfaUserKey)
  secret: text('secret'),
  pendingSecret: text('pending_secret'),
  enabled: boolean('enabled').notNull().default(false),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  lastStep: integer('last_step').notNull().default(-1),
  recoveryCodes: jsonb('recovery_codes').$type<string[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
    // 'G2G' | 'ISO' | 'COSO' | 'CRAFT' (ten-pillar CRAFT Governance Scorecard)
    assessmentType: text('assessment_type').notNull().default('G2G'),
    reportingPeriod: text('reporting_period').notNull().default(''),
    // CRAFT scorecard: institution funds or supports innovation → founder-protection criteria apply
    innovationSupport: boolean('innovation_support').notNull().default(false),
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
    // Not applicable is distinct from "not answered"; it requires a reason.
    notApplicable: boolean('not_applicable').notNull().default(false),
    naReason: text('na_reason').notNull().default(''),
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

// Re-verification of regulatory sources (src/lib/regulatory-sources.ts) before each reporting cycle.
export const regulatorySourceChecks = pgTable(
  'regulatory_source_checks',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    sourceKey: text('source_key').notNull(),
    // 'confirmed' | 'changed' | 'unreachable'
    outcome: text('outcome').notNull(),
    note: text('note').notNull().default(''),
    checkedBy: text('checked_by').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('regulatory_source_checks_ws_idx').on(t.orgId, t.workspaceId, t.sourceKey)],
)

// Organisational design & diagnosis reviews (CRAFT-OD): answers per section; finalised reviews are frozen.
export const orgDesignReviews = pgTable(
  'org_design_reviews',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    title: text('title').notNull(),
    methodologyVersion: text('methodology_version').notNull(),
    // sectionId → { fieldKey → value } (validated by src/lib/org-design.ts cleanSection)
    data: jsonb('data').$type<Record<string, Record<string, unknown>>>().notNull().default({}),
    // 'draft' | 'final'
    status: text('status').notNull().default('draft'),
    preparedBy: text('prepared_by').notNull(),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('org_design_reviews_ws_idx').on(t.orgId, t.workspaceId)],
)

// Independent (external) validation of an approved CRAFT Governance Scorecard assessment.
export const governanceValidations = pgTable(
  'governance_validations',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    assessmentId: integer('assessment_id').notNull(),
    validatorEmail: text('validator_email').notNull(),
    validatorName: text('validator_name').notNull(),
    validatorOrganisation: text('validator_organisation').notNull().default(''),
    independenceDeclared: boolean('independence_declared').notNull().default(false),
    scope: text('scope').notNull().default(''),
    // 'document_review' | 'sample_testing' | 'interviews' | 'site_visit' | 'combined'
    method: text('method').notNull(),
    // 'validated' | 'validated_with_qualifications' | 'not_validated'
    outcome: text('outcome').notNull(),
    notes: text('notes').notNull().default(''),
    // Optional independent re-scores: criterionId → { score 1–5, evidence, comment }
    scores: jsonb('scores').$type<Record<string, { score: number; evidence: boolean; comment?: string }>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('governance_validations_assessment_idx').on(t.orgId, t.assessmentId)],
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
    // Plan-generator inputs (e.g. SEC Nigeria plan: entity type, horizon, first reporting year)
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
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
    // Planner: workstream grouping, dependencies (other plan ids in the workspace) and budget.
    workstream: text('workstream').notNull().default(''),
    dependsOn: jsonb('depends_on').$type<number[]>().notNull().default([]),
    budgetEstimate: numeric('budget_estimate', { precision: 14, scale: 2 }),
    budgetActual: numeric('budget_actual', { precision: 14, scale: 2 }),
    budgetCurrency: text('budget_currency').notNull().default(''),
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
    rootCause: text('root_cause').notNull().default(''),
    expectedOutcome: text('expected_outcome').notNull().default(''),
    resources: text('resources').notNull().default(''),
    dependencies: text('dependencies').notNull().default(''),
    residualRisk: text('residual_risk').notNull().default(''),
    // 'not_required' | 'pending' | 'effective' | 'not_effective'
    effectivenessStatus: text('effectiveness_status').notNull().default('not_required'),
    effectivenessDue: date('effectiveness_due'),
    effectivenessNotes: text('effectiveness_notes').notNull().default(''),
    effectivenessReviewedBy: text('effectiveness_reviewed_by'),
    effectivenessReviewedAt: timestamp('effectiveness_reviewed_at', { withTimezone: true }),
    reopenedCount: integer('reopened_count').notNull().default(0),
    // Correction (fix this instance now) vs corrective action (remove the cause) vs preventive action (stop it elsewhere).
    immediateCorrection: text('immediate_correction').notNull().default(''),
    preventiveAction: text('preventive_action').notNull().default(''),
    // Duplicate merging: a merged CAP points at the CAP it was merged into; the survivor keeps the provenance.
    mergedInto: integer('merged_into'),
    mergedFrom: jsonb('merged_from').$type<{ capId: number; sourceType: string; sourceId: number | null; findingDescription: string; severity: string; mergedAt: string; mergedBy: string }[]>().notNull().default([]),
    // Escalation: 0 none, 1 workspace admins, 2 organisation owner / executive, 3 board or governing body.
    escalationLevel: integer('escalation_level').notNull().default(0),
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    escalatedTo: text('escalated_to'),
    escalationReason: text('escalation_reason').notNull().default(''),
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
    // What the uploader says the document is (evidence-content DOCUMENT_KINDS id), if chosen.
    declaredKind: text('declared_kind'),
    // Result of reading the document's contents against its name / declared kind (no text stored).
    contentCheck: jsonb('content_check').$type<Record<string, unknown>>(),
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
// --- ESG Report Quality Checklist ----------------------------------------------
// One row per organisation reporting period; the organisation persists across years.
export const qaPeriods = pgTable(
  'qa_periods',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    workspaceId: integer('workspace_id').notNull(),
    label: text('label').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    // QaProfile: jurisdiction, entity category, SEC/MOFI scope, financial activities…
    profile: jsonb('profile').$type<Record<string, unknown>>().notNull().default({}),
    checklistVersion: text('checklist_version').notNull(),
    // 'draft' | 'final' — finalised periods are frozen snapshots
    status: text('status').notNull().default('draft'),
    preparedBy: text('prepared_by').notNull(),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>(),
    // Corrections to a finalised period create a revised version linked to the original.
    revisionOf: integer('revision_of'),
    revisionReason: text('revision_reason').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('qa_periods_ws_idx').on(t.orgId, t.workspaceId)],
)

export const qaCheckInstances = pgTable(
  'qa_check_instances',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull(),
    periodId: integer('period_id').notNull(),
    checkId: text('check_id').notNull(),
    // 'not_started' | 'in_progress' | 'met' | 'partially_met' | 'not_applicable' | 'blocked'
    status: text('status').notNull().default('not_started'),
    owner: text('owner'),
    reviewer: text('reviewer'),
    dueDate: date('due_date'),
    notes: text('notes').notNull().default(''),
    blocker: text('blocker').notNull().default(''),
    evidenceId: integer('evidence_id'),
    naReason: text('na_reason').notNull().default(''),
    naSetBy: text('na_set_by'),
    naApprovedBy: text('na_approved_by'),
    naApprovedAt: timestamp('na_approved_at', { withTimezone: true }),
    updatedBy: text('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('qa_check_instances_uq').on(t.periodId, t.checkId), index('qa_check_instances_period_idx').on(t.orgId, t.periodId)],
)

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

// --- validator training and accreditation (PR 4) ------------------------------
// Programme content is DATA the CRAFT programme team edits without a code change.
// Seeded once from src/lib/trainingSeed.ts (the 2026-10-16 training-content spec).

// Who may edit content / mark besides the platform admin: 'programme_team' edits and marks;
// 'lead_validator' only marks (until Lead Validator can be derived from validation history).
export const trainingStaff = pgTable('training_staff', {
  email: text('email').primaryKey(),
  role: text('role').notNull(),
  addedBy: text('added_by').notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
})

export const trainingSettings = pgTable('training_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export type TrainingExercise = Record<string, unknown> & { type: string; title: string }
export type TrainingScenario = { prompt: string; choices: Array<{ text: string; consequence: string; feedback: string; best: boolean }> }

export const trainingModules = pgTable('training_modules', {
  id: text('id').primaryKey(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  outcome: text('outcome').notNull().default(''),
  script: text('script').notNull().default(''),
  // Unlisted video on youtube.com/@DiBadiliTV; null until recorded (the script is shown).
  youtubeUrl: text('youtube_url'),
  // Bumped when the script or video changes; renewal needs the current revision re-watched.
  revision: integer('revision').notNull().default(1),
  exercises: jsonb('exercises').$type<TrainingExercise[]>().notNull().default([]),
  scenario: jsonb('scenario').$type<TrainingScenario | null>(),
  reflectionPrompt: text('reflection_prompt').notNull().default(''),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const trainingQuestions = pgTable('training_questions', {
  id: text('id').primaryKey(),
  moduleId: text('module_id'),
  topic: text('topic').notNull().default(''),
  prompt: text('prompt').notNull(),
  options: jsonb('options').$type<string[]>().notNull(),
  correctIndex: integer('correct_index').notNull(),
  explanation: text('explanation').notNull().default(''),
  forCheck: boolean('for_check').notNull().default(false),
  forExam: boolean('for_exam').notNull().default(false),
  active: boolean('active').notNull().default(true),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const trainingCases = pgTable('training_cases', {
  id: text('id').primaryKey(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  topic: text('topic').notNull().default(''),
  prompt: text('prompt').notNull(),
  modelAnswer: text('model_answer').notNull().default(''),
  active: boolean('active').notNull().default(true),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const trainingCapstones = pgTable('training_capstones', {
  id: text('id').primaryKey(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  brief: text('brief').notNull(),
  evidence: jsonb('evidence').$type<Array<{ title: string; body: string }>>().notNull().default([]),
  referenceScores: jsonb('reference_scores').$type<Record<string, number>>().notNull().default({}),
  modelAnswer: text('model_answer').notNull().default(''),
  rubric: jsonb('rubric').$type<Array<{ key: string; name: string; weight: string; mustMeet: boolean; meets: string }>>().notNull(),
  active: boolean('active').notNull().default(true),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const trainingCalibrationItems = pgTable('training_calibration_items', {
  id: text('id').primaryKey(),
  statement: text('statement').notNull(),
  referenceScore: integer('reference_score').notNull(),
  active: boolean('active').notNull().default(true),
})

export const trainingBadges = pgTable('training_badges', {
  key: text('key').primaryKey(),
  position: integer('position').notNull(),
  name: text('name').notNull(),
  criteria: text('criteria').notNull().default(''),
  active: boolean('active').notNull().default(true),
})

// A completed step: 'watch' | 'try' | 'decide' | 'check' | 'reflect' (plus 'try:<n>' per exercise).
export const trainingProgress = pgTable('training_progress', {
  email: text('email').notNull(),
  moduleId: text('module_id').notNull(),
  step: text('step').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  revision: integer('revision').notNull().default(1),
  detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [primaryKey({ columns: [t.email, t.moduleId, t.step] })])

export const trainingActivity = pgTable('training_activity', {
  email: text('email').notNull(),
  day: date('day').notNull(),
}, (t) => [primaryKey({ columns: [t.email, t.day] })])

export const trainingDrills = pgTable('training_drills', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  purpose: text('purpose').notNull(),
  within: integer('within').notNull(),
  total: integer('total').notNull(),
  pct: integer('pct').notNull(),
  takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('training_drills_email_idx').on(t.email)])

export const trainingExamAttempts = pgTable('training_exam_attempts', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  questionIds: jsonb('question_ids').$type<string[]>().notNull(),
  answers: jsonb('answers').$type<Record<string, number>>().notNull().default({}),
  // 'in_progress' | 'submitted' | 'expired'
  status: text('status').notNull().default('in_progress'),
  score: integer('score'),
  total: integer('total').notNull(),
  passed: boolean('passed').notNull().default(false),
  // Set when the bank had fewer than 40 questions and all were drawn.
  note: text('note'),
}, (t) => [index('training_exam_attempts_email_idx').on(t.email)])

// A written case (kind 'case', contentId = case id) or a capstone (kind 'capstone').
export const trainingSubmissions = pgTable('training_submissions', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  kind: text('kind').notNull(),
  contentId: text('content_id').notNull(),
  attempt: integer('attempt').notNull(),
  body: jsonb('body').$type<Record<string, unknown>>().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  // 'pending' | 'passed' | 'failed'
  status: text('status').notNull().default('pending'),
  resultPercent: numeric('result_percent', { precision: 5, scale: 1 }),
}, (t) => [unique('training_submissions_attempt_unique').on(t.email, t.kind, t.contentId, t.attempt), index('training_submissions_status_idx').on(t.status)])

export const trainingMarks = pgTable('training_marks', {
  id: serial('id').primaryKey(),
  submissionId: text('submission_id').notNull().references(() => trainingSubmissions.id, { onDelete: 'cascade' }),
  marker: text('marker').notNull(),
  // case: { percent }; capstone: { criteria: { key: 0..3 } }
  scores: jsonb('scores').$type<Record<string, unknown>>().notNull(),
  comment: text('comment').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('training_marks_submission_marker_unique').on(t.submissionId, t.marker)])

export const trainingCpd = pgTable('training_cpd', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  hours: numeric('hours', { precision: 5, scale: 1 }).notNull(),
  activity: text('activity').notNull(),
  occurredOn: date('occurred_on').notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('training_cpd_email_idx').on(t.email)])

export const trainingDeclarations = pgTable('training_declarations', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  clients: text('clients').notNull().default(''),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('training_declarations_email_idx').on(t.email)])
export type RatingRow = typeof validationRatings.$inferSelect
