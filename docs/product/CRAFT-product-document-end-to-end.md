# CRAFT — End-to-End Product Document

**CRAFT: Capacity Readiness & Fiduciary Assurance Toolkit** · Framework ICARF v4.0
Published by DiBadili Institute ("Become Change") · https://craftframework.becomechange.institute/
Document version 1.0 · 13 October 2026 · Covers the project from its first database schema (16 June 2026) to the production deploy of 12 October 2026 (commit `3c55b13`).

> **How this document was compiled.** It was assembled from the repository itself — the git history (110 commits, 19 Sep – 12 Oct 2026), the 19 applied database migrations (16 Jun – 12 Oct 2026), source code, route table, the platform guide v1.1, the workspace platform guide, and the launch and brand materials. Work from before the repository was created (June–September 2026) is reconstructed from migration timestamps and their contents; we have no commit-level detail for that period. Status labels follow the convention in the platform guide v1.1: **Live** (in the production deploy), **Partial**, **Planned**.

---

## 1. Executive summary

CRAFT is a multi-tenant web platform that helps public institutions, civil-society organisations and private enterprises in Africa and other emerging markets **prove** they are ready to receive, manage and account for external capital: donor grants, government-to-government (G2G) funding, development-finance investment and sustainability-linked finance.

It began as **G2G-ICGMT v2.0**, the *Universal Institutional Capacity & Grant Management Assessment Toolkit*: a 5-tier, 20-domain assessment of whether a government entity could take direct donor funding under USAID (2 CFR 200), Global Fund, World Bank, PEPFAR/CDC and WHO IHR expectations. Since then it has become an end-to-end governance, ESG and corrective-action platform. The organising idea is the same throughout:

> **Reward evidence of implementation, not the mere existence of paperwork.**

The current product connects every step of the evidence chain:

**Criterion → Finding → Root cause → Corrective action → Owner and deadline → Evidence → Review decision → Effectiveness check → Reassessment**

CRAFT is **not** a regulator, a certification body, a credit rating, an accredited ESG standard or an independent assurance opinion. The product and its copy say so explicitly.

---

## 2. Problem and opportunity

| Problem | Effect | CRAFT response |
|---|---|---|
| Policies and strategies exist on paper but aren't applied | Donors and investors can't tell "paper compliance" from real capability | Paper Compliance Penalty: accreditation is capped when implementation evidence is under 50%. Scores without evidence are capped. |
| Findings are recorded but never funded or owned | The same gaps reappear in every audit cycle | Corrective Action Plans (CAPs) with owners, deadlines, resources, residual risk and effectiveness reviews |
| Evidence is scattered across email and drives | Due diligence is slow and hard to trust | Evidence registry and Data Room with expiry, review, separation of duties and audit trail |
| Sustainability reporting is treated as communications | Organisations miss mandatory IFRS S1/S2 deadlines | ESG Implementation Planner, SEC Nigeria plan generator, ESG Report Quality Checklist with jurisdiction rule packs |
| Each donor and framework asks for its own assessment | Assessment fatigue and duplicated effort | One question bank, mapped across many frameworks and donor requirements |

**Timing.** The SEC Nigeria circular of 23 September 2026 requires public companies and significant public-interest capital-market operators to submit an IFRS S1/S2 implementation plan by **15 October 2026**. ISSB adoption roadmaps are also live in Kenya, Ghana, Zambia, Tanzania, Zimbabwe and Rwanda. The launch on 12 October 2026 was timed to this window.

---

## 3. Users and roles

### 3.1 Target segments (archetypes)
- **Public sector** — ministries, agencies, regulators, national public health institutes, sub-national entities.
- **Civil society** — NGOs, foundations, cooperatives, member bodies.
- **Private sector** — SMEs, startups and corporates seeking capital or contracts. This includes incubators, accelerators and innovation funders, which get the founder-protection overlay.
- **Informal economy** — cooperatives, street-level distributors and unregistered collectives (Micro / Informal Economy track).
- **Capital providers and reviewers** — donors, DFIs, portfolio managers and independent assessors.

### 3.2 Role models
CRAFT runs two authorization models side by side. They are kept deliberately separate: legacy string tenant IDs and workspace integer organisation IDs are **not** interchangeable.

| Legacy toolkit (view levels) | Workspace platform `/app/*` (membership) |
|---|---|
| Organization Assessor, Independent Assessor, Portfolio Reviewer, Administrator, Super Admin (allowlist only). Time-boxed specialised read-only grants carry an expiry that the edge middleware enforces. | **Owner** (everything, including managing owners) · **Admin** (members, approvals, CAP closure, audit, reports) · **Assessor** (assessments, evidence, CAPs, ESG plans) · **Viewer** (read-only). Non-members receive 404. |

### 3.3 Separation-of-duties rules (enforced server-side)
| Rule | Module |
|---|---|
| An assessment's creator cannot approve it | Governance assessments |
| An evidence uploader cannot approve their own evidence | Evidence registry |
| Only admins verify actions and close CAPs | Corrective Action & Evidence Hub |
| An accountable owner cannot review the effectiveness of their own action | Corrective Action & Evidence Hub |
| The person who marks a check N/A cannot approve it | ESG Report Quality Checklist |
| The preparer cannot give final sign-off | ESG Report Quality Checklist |
| Privacy erasure requests need a second org admin or owner to approve | Privacy |

---

## 4. Product lifecycle and journeys

CRAFT has four product layers: **Assessment → Accreditation → Strengthening → Monitoring**.

### 4.1 Entry points
1. **Free 2-minute Readiness Check** (`/pre-assessment`): an anonymous quick score that leads into registration.
2. **Read-only live demo** (`/demo`): seeded illustrative organisations (Kenya, Uganda, Tanzania, Nigeria).
3. **Register / sign in** (`/auth`): Netlify Identity with email confirmation, then onboarding.

### 4.2 Core journey (organisation)
1. **Onboard** — create the organisation (an organisational email domain is required), choose an archetype, create workspaces.
2. **Assess** — run the 5-tier wizard or a specialised framework. Each item is scored 0–5 and backed by evidence, with live risk badges.
3. **Accredit** — the accreditation engine assigns Levels A–E. The Paper Compliance Penalty caps the level when implementation evidence is thin. Findings and the Trust Delta (claimed versus evidenced) are shown.
4. **Strengthen** — low-scoring items generate a Capacity Development Plan (CIP/CDP) whose length the organisation sets. Findings become CAPs with owners, actions and evidence criteria.
5. **Evidence** — upload to the evidence registry or framework Data Room vaults. Files are encrypted at rest. Their contents are checked against the document's name, and scanned documents are read with in-browser OCR. Reviewers approve or reject with comments.
6. **Monitor** — dashboards, wallboard, compliance calendar, scheduled alerts, recurring reports, narrative reports, audit log and reassessment.

### 4.3 Reviewer and capital-provider journey
Portfolio Reviewers see aggregated institutions and portfolios. Independent Assessors verify through `/verify`, and independent validators can validate approved CRAFT Governance Scorecard assessments. Time-boxed access grants let a donor or auditor inspect a Data Room without becoming a member.

---

## 5. Capability inventory (as of 12 October 2026 production deploy)

### 5.1 Assessment engines
| Capability | Description | Status |
|---|---|---|
| **Core readiness assessment** | 450-question base bank across 5 tiers (T1 Organizational Maturity, T2 Fiduciary Assurance, T3 Grant Management, T4 Donor & USG Readiness, T5 Digital & Operational Readiness) and 20 canonical domains; 0–5 maturity sliders; 7-point evidence matrix; archetype-specific questions; 9 composite indices | Live |
| **Lenses** | Climate, ESG & Article 6 (adds 4 domain labels incl. Climate Governance, MRV & Article 6) · Emergency & Health Security · Research, Data & Innovation | Live |
| **Accreditation engine** | Levels A–E with Paper Compliance Penalty (threshold 50% implementation evidence) | Live |
| **Pact OMT v6** and **Pact OCA / OPI** | Organizational Mapping Tool rubric and Organizational Performance Index | Live |
| **Global Fund PR – Financial Compliance Reporting** | FCR engine and Global Fund Handbook error/warning checks on the Financial vault | Live |
| **G7 AI Governance – Public Sector Toolkit** and **OECD/UNESCO AI Classification & Ethical Impact** | AI governance wizards | Live |
| **GFA Business Diagnostic** | Private-sector / DFI diagnostic | Live |
| **ESG Self-Assessment** | Aligned with IPMC's reviewer-controlled model; rating-agency translation reference | Live |
| **CRAFT Capital Readiness Ladder** | Asks: is the institution ready for external capital? | Live |
| **Institutional foundation layer** | CRAFT Institutional Resilience Index (12 domains: reserves, liquidity, revenue concentration, continuity, key-person risk, cyber, backup, crisis governance…) · Transformation & Adaptability Index · Intergenerational & Institutional Legacy Index | Live |
| **CRAFT Institutional Readiness Architecture** | Narrative architecture page that ties the layers together | Live |
| **Micro / Informal Economy track** | Mobile-first simplified ROCA/CPI assessment on a plain-language 4-level scale | Live |

### 5.2 Workspace platform (`/app/*`)
| Capability | Description | Status |
|---|---|---|
| Organisations, workspaces, members, invitations | Membership-based RBAC, tenant isolation by organisation | Live |
| **Governance assessments** | Draft → review → approved, versions, findings, separation of duties, locked on submission | Live |
| **CRAFT Governance Scorecard** | 10 pillars, 30 criteria, methodology CRAFT-GS 1.0 (approved 12 Oct 2026). Scored 1–5; a score without evidence counts at most 2; N/A needs a reason; pillar weights are renormalised over answered pillars; bands from Emerging (<40) to Exemplary (≥90). Founder-protection overlay adds 4 criteria. Independent validation of approved assessments. | Live (methodology not externally validated) |
| **ESG & Sustainability Implementation Planner** | Framework catalogue (IFRS S1/S2, GRI, ESRS/CSRD, SASB, TNFD, GHG Protocol, CDP, Integrated Reporting, SEC Nigeria) with publisher, obligation and official source. Per-requirement plans, owners, milestones, roadmap. | Live |
| **SEC Nigeria IFRS S1/S2 plan generator** | The circular's 8 minimum elements; 90-day, 12-month and 24-month horizons; editable; Word/CSV export. Keeps the SEC deadline separate from the first FRCN reporting year. | Live |
| **Corrective Action & Evidence Hub** | One CAP register fed by findings, ESG requirements, scorecard recommendations and QA gaps. Closure needs approved, unexpired evidence on every action. Closing never changes a score. Effectiveness review; reopen with reason. | Live |
| **Evidence registry** | Upload (PDF/DOCX/XLSX/image/ZIP up to 10 MB), expiry, approve/reject, archive kept for audit, AES-256-GCM encryption in private Blobs, content-vs-name check, browser OCR (Tesseract) | Live |
| **ESG Report Quality Checklist** | Reporting periods; applicability engine; requirement classes (M-REG, M-STD, M-GOV, C-MAND, GP, CRAFT); modules: general quality GQ-01–30 (canonical baseline approved 12 Oct 2026), IFRS S1, IFRS S2, SEC, FRCN SRG 1, MOFI-aligned, evidence and controls. Evidence-gated statuses, readiness gate, frozen sign-off snapshots, revised versions, Word/CSV export. | Live |
| **Jurisdiction rule packs** | Nigeria, Kenya, Ghana, Zambia, Tanzania, Zimbabwe, Rwanda, South Africa (verified 11 Oct 2026; South Africa marked "requires verification") | Live |
| Reports | Snapshots, JSON/PDF (server-rendered with pdf-lib, stored in private Blobs), email, recurring weekly/monthly/quarterly schedules | Live (email needs a configured provider) |
| Compliance dashboard, audit log and CSV export | Org-level and workspace-level | Live |
| Privacy | Self-service data export; org-scoped erasure with second-admin approval; pseudonymised audit actors | Live |

### 5.3 Legacy toolkit modules (retained alongside `/app/*`)
Executive dashboard (Recharts radar, tier bars, risk gauge) · Capacity Development Plan tracker · Findings ("Identified Gaps") · Trust Delta · Universal Donor Reconciliation (financial triangulation: Opening + Income − Expenditures ± Adjustments) · Data Room and Framework Evidence Vaults with time-boxed access grants · ISSB disclosures incl. GHG emissions inventory and Section 11 disclosures · Universal obligations register · Compliance calendar (Global Fund PR reporting cycles) · Regulatory compliance trackers (accounting standards, Basel III/IV, SOX, Sharia principles) · Wallboard (accreditation, top critical risks, implementation evidence) · Super Admin and Portfolio admin · Narrative Report Generator (regulatory implementation plan document) · Settings with configurable session timeout (5–60 min).

### 5.4 Knowledge, trust and support layer
Methodology · Help & Glossary · User Guide · Frameworks catalogue · Institute page (DiBadili) · Open Source page ("Sovereign. Transparent. Community-Driven.") · Privacy Policy · Terms · Code of Conduct (with a public summary and fair, private enforcement) · Contact · Launch kit (reachable by direct URL) · public support bot with knowledge base, issue routing and private email escalation · opt-in PostHog lifecycle analytics · six interface languages (English, French, Portuguese, Spanish, Swahili, Arabic) with edge language detection · offline service worker and offline sync engine for assessments and frameworks.

---

## 6. Methodology and scoring principles

1. **Evidence beats assertion.** Scores without evidence are capped: at 2 in the Governance Scorecard, and through the Paper Compliance Penalty in accreditation.
2. **Unanswered is not zero.** Unanswered criteria are reported and never scored. N/A always needs a rationale, and in QA it needs approval by someone else.
3. **Closure is not compliance.** Closing a CAP never changes a score or marks a requirement compliant. The source criterion must be reassessed.
4. **Frozen history.** Finalised QA periods are snapshots that never silently recalculate. Corrections create a revised version with reason, actor and time. A methodology or weight change creates a new version.
5. **Source honesty.** Regulatory references carry their source and verification date, and unconfirmed items are labelled "requires verification". Requirement titles are paraphrases; copyrighted standards are not reproduced. A CRAFT score is not an official score of any governance code, nor a MOFI score.
6. **Weights.** QA checks weigh Critical 5, High 3, Medium 2, good practice 1. "Met" counts only after evidence acceptance. The readiness gate blocks "Ready for approval" while any critical, mandatory, N/A, evidence or sign-off item is open, whatever the score.

---

## 7. Architecture and platform

| Layer | Technology |
|---|---|
| Application | TanStack Start (React 19, SSR), TanStack Router file-based routing (66 routes), TanStack Query, Tailwind CSS v4, Radix UI, Recharts / Chart.js, Lucide icons; fonts Inter, JetBrains Mono, Playfair Display (self-hosted) |
| Hosting | Netlify, production at `craftframework.becomechange.institute` (the `craftframework.netlify.app` domain redirects to it) |
| Data | Netlify Database (Postgres) through Drizzle ORM. 19 additive migrations; legacy, workspace and offline schemas. |
| Files | Netlify Blobs: private `evidence` and `reports` stores; Data Room uploads with signed keys and image-metadata stripping |
| Identity | Netlify Identity (`@netlify/identity`), role claims in `app_metadata`; edge middleware (`auth.ts`) enforces roles and access expiry |
| Server | 28 Netlify Functions, including a single route-table `workspace-api` that generates the OpenAPI spec (`docs/api/openapi.yaml`) |
| Edge | `auth.ts` (authorization), `lang-detect.ts` (locale) |
| Scheduled jobs | Daily: evidence-expiry alerts, compliance alerts, universal obligations alerts, report schedules. Hourly: support-escalation retry. |
| Security | Field-level AES-256-GCM encryption with key versioning and rotation backfill · durable Postgres rate limits · security headers on static and SSR responses · no caching of private APIs · Zod validation · structured logging |
| Quality | Unit self-checks (`npm test`), Postgres integration tests, Playwright E2E smoke tests, typecheck, CI with least-privilege tokens, CodeQL |

### Data model at a glance
- **Legacy toolkit (Jun–Jul 2026):** organizations, users, questions, responses, response_notes, assessments, capacity_actions, compliance_items, audit_logs, financial_triangulations, firms, firm_members, invitations, access_grants, portfolios, portfolio_orgs, section11_disclosures, legacy_workspace_state.
- **Workspace platform (Oct 2026):** ws_org_members, workspaces, governance_assessments/scores/findings/validations, esg_frameworks/requirements/implementation_plans/milestones, cap_records, action_items, action_logs, evidence_registry, evidence_links, document_approvals, reports, report_versions, report_schedules, qa_periods, qa_check_instances, ws_audit_log, support_issues, support_issue_responses, support_escalations, gdpr_requests, rate_limits, offline_frameworks, offline_framework_receipts.

---

## 8. Project history — from beginning to date

### Phase 0 — Foundations as G2G-ICGMT v2.0 (June – July 2026, before the repository)
*Reconstructed from migration timestamps.*
- **16 Jun 2026** — Initial schema: organisations, users, question bank, responses, assessments, capacity actions, compliance items, audit logs. Financial triangulation (donor reconciliation) table added the same day.
- **7 Jul 2026** — Access and portfolio model: firms and firm members, invitations, time-boxed access grants, portfolios and portfolio organisations; response notes; user last-seen tracking; organisation/portfolio status.
- **11 Jul 2026** — Section 11 disclosures; access-grant columns extended.
- Outcome: a working multi-tenant assessment toolkit with a 5-tier wizard, dashboard, CIP, Super Admin portal, Data Room and donor reconciliation.

### Phase 1 — Repository, security and honesty hardening (19 Sep – 1 Oct 2026)
- **19 Sep** — Codebase brought into the public GitHub repository `fabbiochucho/craftframework`.
- **20–21 Sep** — Closed unauthenticated access-control gaps; gated and hardened Data Room uploads (signed keys, image-metadata stripping); added security headers; self-hosted fonts; SEO files; made the custom domain canonical; Privacy Policy, custom 404, Zod validation, organisation indexes (migration 21 Sep).
- **20 Sep** — Drafted a Netlify → Vercel/Supabase/Neon migration plan, then **deferred** it. The decision was to stabilise Netlify first and consolidate incrementally, without a DNS cutover.
- **23–24 Sep** — Structured logging; split the monolithic AppContext into 10 focused contexts; debounced assessor scoring; in-app compliance deadlines.
- **27 Sep** — **Truth-in-product corrections:** removed unbacked encryption, scanning and vault security claims from Settings, and stopped bulk import from silently substituting fake data.
- **30 Sep – 1 Oct** — Branding fixes ("CRAFT · ICARF v4.0" header) and a link from the GPL-3.0 claim to the real public repository.

### Phase 2 — Framework expansion (8 Oct 2026)
- ESG Self-Assessment, aligned with IPMC's reviewer-controlled model, plus a rating-agency translation reference.
- CRAFT Capital Readiness Ladder and the CRAFT Institutional Readiness Architecture page.
- Lazy-loaded framework engines for performance; real SSR fallback for the authenticated shell.

### Phase 3 — DiBadili Institute identity and foundation layer (9 Oct 2026)
- Website text, contact email and calls to action re-aligned to DiBadili Institute (PR #1).
- Launch marketing assets for `craftframework.becomechange.institute` (PR #2): brand guidelines, launch copy, launch-week plan, social and email artwork.
- Institutional foundation layer: Resilience, Transformation & Adaptability, and Intergenerational & Institutional Legacy indices (PR #3).

### Phase 4 — Workspace platform and open-source governance (10 Oct 2026)
- Open-source scaffolding: Contributor Covenant Code of Conduct (later enhanced with fair private enforcement, PR #11), CONTRIBUTING, SECURITY policy, issue templates, GPL-3.0 licence, Netlify and DiBadili footer attribution.
- **Workspace platform `/app/*`** (PRs #4, #6): organisations, workspaces, governance assessments, ESG roadmap, CAPs, evidence registry, reports, audit log, report schedules, GDPR requests, durable rate limits (migrations `workspace_platform`, `workspace_operations`).
- First CRAFT Governance Scorecard with a 10-pillar model and configurable scoring.
- Support: lightweight support bot and knowledge base (Phase 1 policy), public chat intake (Phase 2, PR #12), private email escalation and opt-in PostHog analytics (Phases 3–4, PR #13).
- Quality and safety: Postgres integration tests, Playwright smoke test, CI wiring (PR #8); a full feature audit (PRs #14, #15) that persisted assessment workflows, cancelled stale tenant saves, preserved offline edit ordering, kept report audits append-only, prevented cross-tenant compliance upserts, disabled private API caching, and added scoped evidence and offline foundations (migrations `legacy_state`, `offline_frameworks`).
- A deploy was blocked by secrets scanning and fixed (PR #5); a tracked local environment file was removed and operational safeguards were documented.

### Phase 5 — Stabilisation (11 Oct 2026)
- **Incident:** a full-site 502 outage. The analytics library broke server rendering on every route; the fix restored SSR.
- Fixed the legacy onboarding gate for the new workspace system and removed an onboarding redirect race.
- Support-bot escalation now handles its backend's 503 states; fixed the broken footer logo.
- **Capacity Development Plan length made self-determinable** (no longer fixed at 24 months).
- **Narrative Report Generator** added.
- Restored the offline service worker, fixed the analytics opt-in race and the archive view, repaired the E2E suite, and synced the lockfile for CI.

### Phase 6 — Launch release (12 Oct 2026, deployed to production)
- **CRAFT Governance Scorecard (CRAFT-GS 1.0)**, **ESG & Sustainability Implementation Planner** with SEC Nigeria plan generator, **CAP hub lifecycle**, and **ESG Report Quality Checklist** with jurisdiction rule packs (PR #16, migration `planner_cap_hub_scorecard`).
- Scorecard weights and bands and the GQ-01–GQ-30 quality baseline approved by the product owner; independent scorecard validation added (PR #17, migration `scorecard_validation`).
- Evidence contents checked against the document's name (PR #18, migration `evidence_content_check`); in-browser OCR for scanned evidence (PR #19).
- Security headers on server-rendered pages (PR #20).
- Platform Guide v1.1 (checked against the code), the radio script *Pan-African Fiduciary Hour* v1.1, launch video projects, and a regenerated OpenAPI spec.
- Public launch day per the launch-week plan: press release, launch email and social posts on 12 Oct; post-launch content planned for 14 and 16 Oct.

### Metrics to date
| Measure | Value |
|---|---|
| Commits in repository | 110 (19 Sep – 12 Oct 2026) |
| Merged pull requests | 17 (PRs #1–#20; #7, #9 and #10 were not merged) |
| Database migrations applied | 19 (all additive) |
| Application routes | 66 |
| Netlify Functions / Edge Functions / Scheduled jobs | 28 / 2 / 5 |
| Assessment frameworks and engines | Core bank + 3 lenses + 11 specialised frameworks + Governance Scorecard + QA Checklist |
| Interface languages | 6 |
| Jurisdiction rule packs | 8 countries |

---

## 9. Key product decisions

| Decision | Rationale |
|---|---|
| Stay on Netlify; defer the Vercel migration | Stability first; keep existing routes and data, with no risky DNS cutover |
| Run legacy and `/app/*` models side by side, with no implicit ID mapping | Protects tenant data; evidence consolidation only through a reviewed, dry-run-first manifest |
| Remove any claim the code does not back | Credibility with fiduciary audiences; established 27 Sep and repeated in guide v1.1 |
| Evidence-gated scoring and closure | Core differentiator against "paper compliance" |
| Paraphrase standards, link official sources, date every verification | Avoids copyright and accuracy risk |
| Analytics opt-in only; private support escalation | Privacy by default |
| GPL-3.0 open source | Sovereignty and transparency for public-sector adopters |

---

## 10. Known gaps and roadmap

**Planned / not yet built**
- Planner workstreams, dependency graph and budget fields; cross-framework requirement mapping.
- XLSX/PDF export for the scorecard, planner and QA modules (Word/CSV exist today).
- Multi-factor sign-in. The application doesn't provide it today.
- CAP: immediate correction versus preventive action as separate fields; merging duplicate findings with provenance kept; escalation workflow.
- Consolidation of legacy and workspace data models (reviewed evidence import tooling exists; a full migration does not).

**Governance and validation next steps**
1. Plan external validation of the CRAFT-GS methodology.
2. Confirm the founder-protection overlay wording with legal and programme partners.
3. Re-verify regulatory sources before each reporting cycle (SEC, FRCN, ICPAK, ICAG, ZICA, NBAA, PAAB, ICPAR, JSE); verify the South Africa position.
4. Complete the provider operations checklist: credential rotation, sender verification for report and escalation email, encryption backfill verification.

**Suggested 30–60–90 day pilot for adopters**
| Days | Focus | Outputs |
|---|---|---|
| 1–30 | Readiness Check, Scorecard baseline, evidence inventory | Baseline, findings, priority gaps |
| 31–60 | Implementation plan (SEC generator where applicable), CAPs with owners and evidence criteria | Approved roadmap and CAP register |
| 61–90 | Evidence review, first effectiveness checks, QA checklist dry run | Progress review and lessons report |

---

## 11. Risks and responsible use

- **Methodology risk** — CRAFT-GS 1.0 is approved internally but not externally validated. Outputs must not be presented as certification, legal compliance, creditworthiness or investment suitability.
- **Regulatory drift** — rule packs carry verification dates and need re-checking each cycle.
- **Operational dependencies** — email delivery, field encryption keys and analytics depend on provider configuration. Features return explicit "not configured" states rather than failing silently.
- **Data sensitivity** — users should not upload sensitive personal data without approval. Sensitive findings are encrypted and referenced, not copied, into CAPs.
- **Dual model complexity** — legacy and workspace models coexist until a reviewed consolidation is done.

---

## 12. Related documents
- `docs/product/CRAFT-platform-guide-v1.1.md` — capability-status guide checked against the code
- `docs/platform-guide.md` — workspace architecture, roles, user/admin/developer guides, operations checklist
- `docs/api/openapi.yaml` — generated API reference
- `docs/chatbot-support-plan.md`, `docs/SUPPORT_BOT_SETUP.md` — support bot phases
- `docs/superpowers/plans/2026-09-20-netlify-to-vercel-migration.md` — deferred hosting migration plan
- `marketing/` — brand guidelines, launch copy, launch-week plan
- `docs/product/radio-script-pan-african-fiduciary-hour-v1.1.md` — broadcast script
