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

## Stabilization and deployment

Netlify remains the supported host during incremental consolidation. Existing
legacy routes and their data are retained alongside `/app/*`; organization IDs
from these two models must not be treated as interchangeable. Do not cut DNS over
to a frontend-only preview or run destructive test migrations against live data.

See the [provider operations checklist](docs/platform-guide.md#provider-operations-checklist)
for credential rotation, sender verification, migration/backfill verification,
and DNS prerequisites that require authorized provider access.
