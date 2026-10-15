# Legacy and workspace data-model consolidation plan

Prepared 15 October 2026 · Status: proposed · Owner: platform lead

## Where we are

CRAFT runs two models side by side.

| | Legacy (ICARF dashboard) | Workspace platform (`/app/...`) |
|---|---|---|
| Tenancy | String organisation ids (`self_<email>` for self-registrants), `organizations`, `users`, `access_grants`, `firms`, `portfolios` | Integer `ws_organizations` with `ws_org_members` roles (owner/admin/assessor/viewer) and `workspaces` |
| Assessment | `questions` / `responses` (450-question bank, 0–5 maturity), `response_notes`, `assessments` | `governance_assessments` / `governance_scores` / `governance_findings` (CRAFT-GS, catalogue assessments, G2G domains) |
| Actions | `capacity_actions` (CIP) | `cap_records`, `action_items`, `action_logs` |
| Evidence | Legacy blob store per org (data room) | `evidence_registry`, `evidence_links`, approvals, content checks |
| Compliance | `compliance_items`, `financial_triangulations` | ESG checklist (`qa_periods`), planner, regulatory sources |
| Audit | `audit_logs` | `ws_audit_log` |
| API | ~20 Netlify functions (`responses`, `questions`, `organizations`, `compliance`, …) | One function: `workspace-api` |
| Security | Netlify Identity password; role from `users` | Same identity plus **multi-factor sign-in**, org MFA policy, NPHI verification |

Usage: in the review period `/dashboard` had 42 views and `/app/workspaces` 5, so most signed-in users still land on legacy pages. Tooling already exists to import reviewed legacy evidence into the workspace evidence registry (`netlify/lib/evidence-consolidation.ts`, manifest with SHA-256 checks and reviewer).

## Goal

One tenancy, one assessment model, one evidence store, one audit trail and one security perimeter (with MFA), without losing history or breaking links that funders hold.

## Principles

- **Additive first:** new tables and mappings before anything is removed; every step reversible until the final cut-over.
- **No silent rescoring:** legacy 0–5 domain scores are imported as a legacy assessment type with their original scale and date, never converted into CRAFT-GS scores.
- **Provenance:** every imported record keeps its legacy id and import batch.
- **Reviewed imports:** evidence moves only through reviewed manifests (existing tool).

## Phases

| Phase | Work | Exit criterion |
|---|---|---|
| 0. Freeze | Stop new features on legacy pages; banner pointing users to the platform | Banner live; legacy write volume measured |
| 1. Identity and tenancy map | Table `legacy_org_map(legacy_org_id → ws_org_id, workspace_id)`; create workspace organisations for active legacy tenants; map `users` roles to `ws_org_members` (super_admin stays an allowlist) | Every active legacy tenant mapped; owners confirmed |
| 2. Evidence | Run the existing manifest import per tenant; reviewer signs each manifest; link imported evidence to mapped records | Hash-verified counts match; spot-checks pass |
| 3. Assessments and actions | Import `responses` as a read-only `LEGACY_ICARF` assessment per tenant (original scale, date, notes); import `capacity_actions` as CAPs with `sourceType = 'legacy_cip'` and links back | Totals reconcile per tenant; sample of tenants confirm |
| 4. Compliance and audit | Import `compliance_items` into the obligations/planner view; copy `audit_logs` into `ws_audit_log` with a `legacy` marker | Counts reconcile |
| 5. Redirect | After sign-in, send users to `/app/workspaces`; legacy routes redirect to the mapped workspace page; all reads now pass the MFA gate | No legacy writes for 30 days |
| 6. Retire | Make legacy functions read-only, then remove them; archive legacy tables (export kept) | Sign-off by platform lead and data-protection officer |

## Risks and controls

| Risk | Control |
|---|---|
| Funders hold links to legacy reports | Keep redirects for at least 12 months |
| Self-registrant tenants with no organisational email domain | Contact them; import into a holding organisation they must claim |
| Data-protection obligations on moved personal data | Record the lawful basis; run the encryption backfill after import; honour pending erasure requests first |
| Score confusion between scales | Separate assessment type and labelling; no conversion |
| Downtime or credit exhaustion during migration | Run imports as batched scripts outside peak hours; watch Netlify usage |

## Not in scope

Changing the CRAFT-GS methodology, or importing legacy demo data.
