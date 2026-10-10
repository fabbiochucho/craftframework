# CRAFT Workspace Platform Guide

## Architecture
- **Hosting decision** — stabilize Netlify first, preserve existing legacy routes and data, then consolidate incrementally. `/app/*` integer organization IDs and legacy string tenant IDs remain distinct; no implicit data migration or DNS cutover is authorized by a frontend preview.
- **Schema** — `db/schema.ts` (tables prefixed `ws_`/domain names; every workspace table has `org_id`). Migrations: `netlify/database/migrations`.
- **API** — one route table in `netlify/functions/workspace-api.mts` serving `/api/orgs`, `/api/workspaces/*`, `/api/support-bot/*`, and `/api/privacy/*`. Pure rules (RBAC, scoring, CAP, evidence, fixed-window calculations) live in `netlify/lib/workspace.ts`; org authorization in `netlify/lib/orgAccess.ts`.
- **UI** — `/app/*` routes in `src/routes/app.*.tsx`, pages in `src/pages/workspace/`.
- **Scheduled** — `evidence-expiry-alerts.mts` (daily), `weekly-reports.mts` (daily polling for due weekly/monthly/quarterly report schedules).
- **Files** — evidence binaries are stored in Netlify Blobs (`evidence` store); only the key is kept in `evidence_registry.file_path`.
- **PDFs** — reports are rendered server-side with `pdf-lib`, stored in the private `reports` Blobs store, and served only by a workspace-authorized download route.

## Roles
| Role | Can |
|---|---|
| owner | everything incl. promoting/removing owners |
| admin | invite members (not owners), manage workspaces, approve assessments/evidence, close CAPs, audit log, reports |
| assessor | create/edit assessments, upload evidence, create CAPs/actions, ESG plans |
| viewer | read-only |

Non-members get `404`. Creators cannot approve their own assessment; uploaders cannot approve their own evidence.

## Canonical domain reconciliation

`src/lib/data.ts` is the source of truth: it defines 20 base domains and assigns their questions to five tiers. The former README count of 19 and the workspace's hand-maintained pillar/domain names were inconsistent, so the workspace now derives its labels from the bank rather than preserving a second taxonomy. The mapping is:

- T1 Organizational Maturity: Governance & Leadership; Legal & Regulatory; Strategy & Planning; Human Resources; Sustainability & Financing.
- T2 Fiduciary Assurance: Financial Management; Procurement & Supply Chain; Risk & Internal Controls; Audit & Assurance; Ethics & Anti-Fraud.
- T3 Grant Management: Grant Management; Program & Project Mgmt; Monitoring, Evaluation & Learning; Partnerships & Stakeholders.
- T4 Donor & USG Readiness: USG Compliance; International Donor Compliance.
- T5 Digital & Operational Readiness: Digital Systems & Cyber; Emergency Preparedness; Research & Innovation; PMO & Delivery.

The climate extension adds four additional labels outside this 20-domain base set. Existing scores under the retired hand-maintained labels are not automatically translated because their names do not provide a reliable one-to-one mapping; review those records before migration.

## User guide
1. **Org setup** — `/app/workspaces` → create organization (organizational email domain required), then workspaces.
2. **Assessment** — Governance assessments → New → *Scoring Wizard* (0–5 sliders, 20 canonical domains from `data.ts`) → *Findings* → *Submit*. An admin approves in *review* mode; submitted assessments are locked. The question bank assigns the domains to its five T1–T5 tiers; climate modules add four separate domain labels beyond the 20-domain base.
3. **CAP** — create from a finding or manually; add actions, link evidence, an admin verifies, then **Close** (blocked until every action has verified evidence).
4. **ESG** — adopt a framework, create plans from requirements, track milestones on the roadmap.
5. **Evidence** — upload (PDF/DOCX/XLSX/image/ZIP ≤10 MB), set expiry, admin approves/rejects.
6. **Reports** — generate a snapshot, download JSON/PDF, or email it. Admins can create, pause/resume, and delete recurring schedules; each schedule accepts up to 10 validated recipients. Email delivery returns `503 Email not configured` unless SendGrid credentials and a sender address are configured.
7. **Privacy** — authenticated users can download `/api/privacy/export`; submit `POST /api/privacy/erasure-requests` with `{ "orgId": 1 }` to request org-scoped anonymisation. A different org admin/owner must approve through `/api/privacy/erasure-requests/:id/approve`. Audit actors are pseudonymised and archived evidence blobs are purged.

## Admin guide
- Members: `/app/org/members`. Audit review: `/app/org/audit-log` (also `POST /api/workspaces/:id/audit-log/export` with `{ "format": "csv" }`).
- Seed demo data: `netlify dev:exec node db/seed-demo.ts`.

## Developer guide
- **Extend the model**: edit `db/schema.ts`, run `npx drizzle-kit generate --name <change>`, commit the migration.
- **Add an endpoint**: add an entry to `routes` in `workspace-api.mts` with `access` (minimum role) and `scope`; always filter by `orgId` from the handler args.
- **Add an ESG framework**: add to `ESG_CATALOGUE` (seeded lazily per workspace).
- **Tests**: `npm test` (schema and pure-logic self-checks with `node:assert`); `npm run test:integration` and `npm run test:e2e` (see *Integration and E2E tests*); `npm run typecheck`; `npm run docs:api` to regenerate OpenAPI from the route table.
- **Encrypted fields**: `FIELD_ENCRYPTION_KEY` is a base64-encoded 32-byte AES key, required in production. AES-256-GCM protects member email identifiers (indexed by a keyed lookup hash), organization contact email/phone, governance/evidence reviewer notes, evidence approval comments, support contact email, report recipients, delivery recipients, and findings explicitly marked sensitive. Set `FIELD_ENCRYPTION_KEY_VERSION`; during rotation configure old keys in `FIELD_ENCRYPTION_PREVIOUS_KEYS`, then run `npm run crypto:backfill -- --rotate` in a trusted environment. For initial deployment, run `npm run crypto:backfill` after setting the key. The backfill is idempotent; plaintext rows remain readable during migration.
- **Durable rate limits**: atomic fixed-window counts are stored in the shared `rate_limits` Postgres table, keyed by a SHA-256 digest of the authenticated user (or Netlify client IP) and minute. If Postgres rate-limit operations fail, requests fail open and the error is logged so a limiter outage does not take down the platform.

## Integration and E2E tests

Both suites need a throwaway Postgres whose database name contains `test` (the harness drops and recreates its `public` schema, then applies `netlify/database/migrations`). Locally: `docker compose -f docker-compose.test.yml up -d --wait`, then `export TEST_DATABASE_URL=postgres://craft@localhost:54329/craft_test`. CI uses a `services: postgres` container (`.github/workflows/validate.yml`).

- `npm run test:integration` runs the real, unmodified `workspace-api.mts` handler (and the `weekly-reports` scheduled function) in Node against Postgres by building `Request` objects. Test-only Node module hooks in `tests/integration/` swap `db/index`, `@netlify/identity` (verified caller supplied by the test) and `@netlify/blobs` (in-memory); outbound `fetch` is blocked/mocked, so SendGrid is never contacted. The hooks refuse to load if `NODE_ENV=production`, `NETLIFY` or `CONTEXT` is set and nothing in production code references them. Encryption keys are generated at runtime. Covered: authentication, 404-not-403 and cross-org id probing, role matrix, owner-promotion guard, segregation of duties, CAP closure and assessment locks, evidence limits/soft delete/audit rows, ciphertext at rest and hash lookup, DB-backed rate limit across handler instances, PDF reports and schedule CRUD, the 503 email response, GDPR export/erasure.
- `npm run test:e2e` (Playwright, Chromium) includes the workspace smoke path, conduct summary, private escalation and support-analytics consent tests. The workspace path creates an org and workspace, governance assessment, finding, CAP, evidence upload, report and PDF download (`%PDF` header). Playwright starts the app and a test-only API server (`tests/e2e/apiServer.ts`) that serves the real handler against Postgres. Traces and screenshots are kept on failure and uploaded by CI.

### Known limitations of the test setup

- E2E sign-in is not Netlify Identity. A genuine Identity login needs a live Netlify site, so the browser gets an unsigned, runtime-generated session and the test-only server trusts its `nf_jwt` cookie. That trust exists only in the test server; the production function still verifies Identity sessions and no backdoor was added. Netlify Identity itself, `netlify dev` and the edge/CDN layer are therefore not exercised.
- Typechecking includes `.mts` production handlers as well as `.ts` and `.tsx`.
- SendGrid delivery is only tested with a mocked `fetch`; no real email has been sent.
- Browser coverage is not comprehensive: most role/error paths are exercised by integration tests rather than real Identity/CDN sessions.

### Behaviour the tests pin down (not changed)

- CAP action `verify` requires linked evidence that is approved, not archived, and not expired.
- Erasure approval is per organisation: the global `users` row, legacy `audit_logs` and `gdpr_requests.requested_by` are retained, and all already-archived evidence in the org is purged, not only the subject's.
- Findings lock only when an assessment is `approved`; scores lock once it leaves `draft`.

## Remaining limits

- Erasure requests anonymise the requesting member's identity in workspace actor/assignment fields, remove their membership, and purge already soft-deleted evidence files. Other business records and active evidence remain where required for organisational accountability; the request record and anonymised audit trail are retained.
- Scheduled reports are polled daily. Configure `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, and `SUPPORT_EMAIL` in Netlify. A missing configuration or failed provider request must not be reported as delivery; ambiguous provider outcomes require operator reconciliation before retry.
- Field-encryption deployment requires key provisioning and running the documented backfill in a trusted environment; do not put key material in repository files or migration SQL.
- Legacy and `/app` workspace IDs are deliberately separate. Evidence links from legacy pages are navigation into the real registry, not an automatic tenant mapping, attachment migration, or retrospective verification of legacy scores. Keep both routes and datasets until an explicit mapping and tested non-destructive migration are approved.
- Framework calculators use their existing rubrics; framework labels and report output are not regulatory filings or independent certification.
- Offline encryption reduces accidental local exposure but is not protection against malicious same-origin JavaScript or access to an unlocked browser profile. Failed and unowned historical pending records must not be silently discarded or submitted as another user.

## Provider operations checklist

These steps require an authorized operator or provider access. Repository changes
cannot rotate credentials, verify sender domains, apply production migrations,
or change DNS by themselves.

1. **Credential incident review:** a historical commit tracked `.env.local`.
   Removing it from the current tree does not remove it from Git history.
   Privately inspect the affected commit in an authorized environment; revoke
   and rotate every real credential exposed, review provider access logs, and
   update Netlify secrets before redeploying. Never paste values into issues,
   logs, PRs, or repository files. History cleanup, if required, is a separate
   coordinated operation and does not substitute for rotation.
2. **Sender domains:** verify the configured domains in Resend and SendGrid,
   install the exact provider-issued DNS records, and verify sender addresses.
   Use `INVITE_FROM_EMAIL`, `COMPLIANCE_FROM_EMAIL`, and
   `SENDGRID_FROM_EMAIL` for their respective workflows. Record provider
   acceptance separately from delivered/bounced results; confirm delivery using
   provider event logs and a controlled recipient.
3. **Netlify services:** confirm production Identity and enabled OAuth providers,
   Database, Blobs, Forms, function routes, and scheduled jobs. Provision the
   variables in `.env.example` through Netlify secrets. Browser PostHog
   configuration requires a rebuild; do not expose server keys as `VITE_*`.
4. **Production migrations:** take and verify a restorable backup, review pending
   additive migrations against the actual deployed schema, test an in-place
   upgrade on an isolated copy, then apply through the supported Netlify
   deployment mechanism. Configure encryption keys and run the documented
   trusted backfill. Keep a rollback/restore procedure and record migration
   receipts. The integration harness drops `public` and must never target a
   production or preview database.
5. **Operational checks:** verify real login/confirmation/recovery, cross-tenant
   denial, uploads/downloads, report generation, scheduled execution and email
   events. A green mocked integration test or Ready Vercel preview is not this
   verification.
6. **DNS:** retain the current Netlify DNS target during stabilization. Any later
   host migration requires equivalent backend/auth/storage/jobs, data preservation
   and session cutover tests before an explicitly approved DNS change. Obtain
   current DNS records from the provider, prepare rollback, and verify TLS and
   canonical redirects after any change.
