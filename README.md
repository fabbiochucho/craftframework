# G2G-ICGMT v2.0 — Universal Institutional Capacity & Grant Management Assessment Toolkit

[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

A multi-tenant web application for assessing institutional capacity to receive and manage direct donor funding (G2G — Government-to-Government). Production operation requires provisioned Netlify services and verified deployment configuration; a successful frontend preview alone does not verify backend operation.

## What It Does

The G2G-ICGMT toolkit enables:
- **Multi-tenant assessment management** — Each organization sees only its own assessment data
- **5-Tier structured evaluation** across 20 canonical domains, grouped by question-bank tier (Organizational Maturity, Fiduciary Assurance, Grant Management, Donor & USG Readiness, Digital & Operational Readiness)
- **Real-time dashboard** with radar charts, tier performance bars, and risk classification
- **Interactive scoring wizard** with 0–5 sliders, evidence upload, and live risk badge updates
- **Automated Capacity Development Plan (CIP)** filtered from low-scoring items
- **Super Admin portal** with aggregate heatmaps and multi-org oversight

## Tech Stack

- **Framework**: TanStack Start (React 19, SSR-capable)
- **Routing**: TanStack Router (file-based)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts (Radar, Bar, Pie/Gauge)
- **Icons**: Lucide React
- **State**: React Context API
- **Deployment**: Netlify

## Running Locally

```bash
npm install
netlify dev --port 8889
```

## Routes

| Route | Description |
|-------|-------------|
| `/auth` | Login & Quick Registration |
| `/dashboard` | Organization executive dashboard |
| `/assessment` | 5-Tier assessment wizard |
| `/cip` | Capacity Development Plan tracker |
| `/admin` | Super Admin multi-tenant portal |

## Demo

Use `/demo` for seeded, illustrative assessments. Real `/auth` sign-in uses
Netlify Identity and requires valid credentials and email confirmation.
Super Admin access is restricted to the platform allowlist.

## Standards Alignment

USAID (2 CFR 200) · Global Fund FMS · World Bank · PEPFAR/CDC · WHO IHR

## Workspace Platform

Organization workspaces, governance assessments, ESG roadmap, corrective action plans, evidence registry, reports and audit log are served by `netlify/functions/workspace-api.mts` (schema in `db/schema.ts`, UI under `/app/*`). See [docs/platform-guide.md](docs/platform-guide.md) and [docs/api/openapi.yaml](docs/api/openapi.yaml). Run the unit tests with `npm test`.

The canonical `data.ts` question bank has 20 base assessment domains; its separate climate module adds four additional domain labels. The former README count of 19 and the hand-maintained workspace pillar labels did not match the bank. Workspace assessment labels now derive from `TIER_NAMES`, `DOMAIN_DISPLAY`, and the T1–T5 question assignments; [the full tier mapping and legacy-data note](docs/platform-guide.md#canonical-domain-reconciliation) are documented in the platform guide.

## Capacity assessment saving

`/capacity` uses the same save and completion rules for all seven modules.
Drafts can be saved while a "not assessed" explanation is unfinished; completion
requires a reason of at least three characters. Grant-stage modules must assess
every domain. Automatically generated SWOT lists are retained, and validation
errors identify the field to correct. Choosing "Not used" removes a group
consensus score. Read-only access permits inspection, not changes or submission.
Unsaved edits remain on the device until their save succeeds; saves are ordered
so an earlier request cannot clear a newer draft.
The shared organisation profile context supplies missing fields for older saved
profiles without replacing their existing values, so the wizard can still open.

## Assessment autosave and revision history

Successful capacity, legacy, workspace score, independent score, reviewer and
funder-note saves now append encrypted revisions in the same database transaction.
`/assessment-archive` shows the signed-in author's revisions, reporting period
(where the assessment defines one) and server date/time, rechecking current access.
Each update is a separate revision. Live metrics and dashboards continue reading
the current assessment tables, not the revision archive. Existing live records
remain available; revisions are recorded from deployment onwards, not backfilled
with invented historical timestamps.

Independent reviewer scores, comments, evidence references, fieldwork setup,
organisation debrief responses and workspace score inputs autosave when complete.
Unfinished or failed input stays on the device per account and assessment until
saved. Submission and finalisation remain explicit and flush pending inputs before
locking; issued reviews remain immutable and use the existing follow-up workflow.

Funding-partner progress consent does not share comments by default. Organisations
can separately allow and revoke sharing of frozen reviewer/debrief comments.
Funders can autosave their own encrypted, timestamped notes without changing
independent scores. Revoked consent removes access to both the live view and those
archive revisions. Account removal, institution deletion and workspace data-subject
erasure also remove the corresponding revision data.

Deploy migration `20261122120000_assessment_revisions` before the updated functions
and frontend. Keep the existing field-encryption key available to read archives.

## Stabilization and deployment

Netlify remains the supported host during incremental consolidation. Existing
legacy routes and their data are retained alongside `/app/*`; organization IDs
from these two models must not be treated as interchangeable. Do not cut DNS over
to a frontend-only preview or run destructive test migrations against live data.

See the [provider operations checklist](docs/platform-guide.md#provider-operations-checklist)
for credential rotation, sender verification, migration/backfill verification,
and DNS prerequisites that require authorized provider access.
