# CRAFT Workspace Platform Guide

## Architecture
- **Schema** — `db/schema.ts` (tables prefixed `ws_`/domain names; every workspace table has `org_id`). Migrations: `netlify/database/migrations`.
- **API** — one route table in `netlify/functions/workspace-api.mts` serving `/api/orgs`, `/api/workspaces/*`, `/api/support-bot/*`. Pure rules (RBAC, scoring, CAP, evidence, rate limiting) live in `netlify/lib/workspace.ts`; org authorization in `netlify/lib/orgAccess.ts`.
- **UI** — `/app/*` routes in `src/routes/app.*.tsx`, pages in `src/pages/workspace/`.
- **Scheduled** — `evidence-expiry-alerts.mts` (daily), `weekly-reports.mts` (weekly).
- **Files** — evidence binaries are stored in Netlify Blobs (`evidence` store); only the key is kept in `evidence_registry.file_path`.

## Roles
| Role | Can |
|---|---|
| owner | everything incl. promoting/removing owners |
| admin | invite members (not owners), manage workspaces, approve assessments/evidence, close CAPs, audit log, reports |
| assessor | create/edit assessments, upload evidence, create CAPs/actions, ESG plans |
| viewer | read-only |

Non-members get `404`. Creators cannot approve their own assessment; uploaders cannot approve their own evidence.

## User guide
1. **Org setup** — `/app/workspaces` → create organization (organizational email domain required), then workspaces.
2. **Assessment** — Governance assessments → New → *Scoring Wizard* (0–5 sliders, 19 domains) → *Findings* → *Submit*. An admin approves in *review* mode; submitted assessments are locked.
3. **CAP** — create from a finding or manually; add actions, link evidence, an admin verifies, then **Close** (blocked until every action has verified evidence).
4. **ESG** — adopt a framework, create plans from requirements, track milestones on the roadmap.
5. **Evidence** — upload (PDF/DOCX/XLSX/image/ZIP ≤10 MB), set expiry, admin approves/rejects.
6. **Reports** — generate a snapshot, download JSON, or email it (defaults to craftframework@becomechange.institute). PDF export is not yet implemented; `pdf_url` stays empty.

## Admin guide
- Members: `/app/org/members`. Audit review: `/app/org/audit-log` (also `POST /api/workspaces/:id/audit-log/export` with `{ "format": "csv" }`).
- Seed demo data: `netlify dev:exec node db/seed-demo.ts`.

## Developer guide
- **Extend the model**: edit `db/schema.ts`, run `npx drizzle-kit generate --name <change>`, commit the migration.
- **Add an endpoint**: add an entry to `routes` in `workspace-api.mts` with `access` (minimum role) and `scope`; always filter by `orgId` from the handler args.
- **Add an ESG framework**: add to `ESG_CATALOGUE` (seeded lazily per workspace).
- **Tests**: `npm test` (pure-logic self-checks with `node:assert`).

## Known limitations
- PDF generation, recurring report scheduling UI and field-level encryption of sensitive data are not implemented; email delivery needs `SENDGRID_API_KEY`.
- Rate limiting is per function instance (in-memory).
- GDPR export/deletion workflow endpoints are not yet included.
