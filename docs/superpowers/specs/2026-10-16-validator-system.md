# CRAFT independent validator system — build spec

Status: agreed with the product owner on 2026-10-16. Source of truth for every validator PR.
Policy companion (wording, training content, question bank): the doc "CRAFT Validator Accreditation
Programme" — https://claude.ai/code/artifact/eb9cc7dd-a5ae-4bda-82e8-d8f366a674ca. Where this spec and the
doc differ, this spec wins.

## Working rules

- Work on a branch per PR, open a PR, **never merge or deploy** without the owner's approval.
- Database changes are reviewed migrations under `netlify/database/migrations/`; say so in the PR before
  anything touches production.
- Gates: `npm run typecheck`, `npm test`, `npm run test:integration` (needs `TEST_DATABASE_URL`, a database
  whose name contains "test"; see `docker-compose.test.yml`), and `npx playwright test` from PR 3 on.
  CI (`validate`) runs all of them with Postgres 16, so a PR must be green there.
- Lockfile: npm 11 (CI pins it). Deno stays 2.5.6, TypeScript stays 5.x.
- Reuse before building (below). Enforce every permission server-side. Audit-log every engagement, grant,
  evidence view, score change, finalisation, status change, accreditation change, rating and material event.
- Accessible and mobile-friendly like the rest of CRAFT.

## Goal

An organisation's self-assessed CRAFT results — first the 7-rung Capital Readiness Ladder
(`src/lib/capitalReadiness.ts`, scores per org in legacy-state key `capital:scores`) — can be reviewed by an
independent third party. A finished validation is frozen, attributed, time-limited, publicly verifiable and
tied to the organisation's Capacity Improvement Plan (CIP). Design every table and function so any CRAFT
framework can use it later (a `framework` key, not ladder-specific columns). It is what DevMapper will later
show as a "confirmed" rung.

## Architecture decisions (from reading the code)

| Topic | Decision |
|---|---|
| Org model | Build on the original text-id org model (`organizations`, `access_grants`, `firms`, `capacity_actions`, legacy-state), where the ladder lives. Not the `/app` workspace model. |
| Existing `governance_validations` (workspace) | Leave it. New framework-agnostic tables; port the Governance Scorecard later. |
| Validator data access | `access_grants` with a new role `craft_validator`, added to `SPECIALIZED_READONLY_ROLES` in `netlify/lib/access-policy.ts` (read-only, expiry mandatory). One grant per engagement team member; revoke on finalise, cancel or expiry. Check `access_grants_org_grantee_unique` (one row per org+grantee) and handle re-engagement. |
| Public page | `/validation/$verificationId` (`/verify` is already the Trust Delta page). |
| PDF / QR | `pdf-lib` and `uqr` (already dependencies). Store the SHA-256 of the issued PDF. |
| Email / reminders | Resend via the existing helpers; a daily scheduled function like `compliance-alerts.mts`. |
| Auth | `resolveCaller`, `canAccessOrg`, `mfaRequired` in `netlify/lib/auth.ts`. Platform admin = `isSuperAdmin`. |
| Verification ID | Random, non-sequential (e.g. `CRAFT-V-` + 8 base32 chars). |

Reuse: `access_grants` + `issue-access-grant`, `firms` / `firm_members`, `response_notes` (author_role
`independent`), Trust Delta / negotiated score in `src/lib/frameworks.ts`, the CIP (`capacity_actions`,
`CIPPage.tsx`), audit logging and email.

## Profiles and the three-way directory

Open onboarding — no approval needed to join.

- **Validator** (a person): name, photo optional, bio, competencies and capabilities, frameworks, countries
  and languages, professional memberships (body + number; shown "self-declared" until a platform admin marks
  one "verified" against the body's public register), accreditation status, level, badges, ratings.
- **Validator firm**: name, nature chosen by the firm — independent consultant, audit firm, accounting firm,
  consulting firm, NGO/CSO, academic institution, other — competencies, countries, team members. A firm has
  many validators; a validator may work solo.
- **Funding partner**: type — Venture Capital, Private Equity, DFI, Angel Investor, Institutional Investor,
  Microfinance Bank, Other investor — focus sectors, countries, ticket size (optional), staff members.
- **Organisation**: brief public profile (name, country, sector, current rung, validation badge), **listed
  only if the organisation opts in**. Never scores, evidence or comments.

Search and brief profile pages: organisations find validators and funding partners; funding partners find
validators and opted-in organisations. Signed-in only.

## Accreditation (earned, no panel)

- Registered → (training + assessment passed) → **CRAFT-accredited**, automatically. No vote, no appointment,
  no supervised stage.
- Only accredited validators issue an **Independent validation**. Anyone else's work is labelled
  **"Review by [name]"**.
- **No manual or pilot accreditation.** No badge until the training is completed; completing it sets
  `accredited_until` one year ahead.
- **Annual renewal:** each year the validator, and every member of their firm's team, completes the
  current training videos again. Missed renewal shows "accreditation lapsed" (no badge) until done.
- Platform admin can only suspend or reinstate, with a recorded reason. Suspended validators stay visible in
  search with a "Suspended" badge, for transparency; reinstating never grants accreditation.
- Professional membership numbers are shown on public profiles so anyone can check the body's register; the
  profile form tells the validator this.
- Levels: Associate (registered, not accredited) · Validator (passed) · Senior Validator (10+ validations,
  none withdrawn for error, calibration 85%+, 2 years — can re-review, mentor, sit on Review Panels) · Lead
  Validator (Senior 2 years, no upheld complaints — marks scenario cases).

## Labels (three, never mixed)

- **Independent validation** — accredited external validator, whoever engaged them: "Validated by
  [validator, firm], engaged by [organisation / funding partner / firm]".
- **Funder review** — a funding partner's own staff: "Reviewed by [funder]", never "validated".
- **Self-assessment** — the organisation's own scores: "Self-assessed".

## Engagements, teams and access

1. The organisation, a funding partner (with the organisation's consent) or a validator's firm creates an
   engagement: framework, scope (whole ladder or specific levels), validator or firm, named team members,
   engaging party, type (independent validation / funder review), optional "funder requires re-review" term.
2. Either side can propose (invite from the directory, or a validator requests); every required party
   accepts; the organisation always gives final consent. If a funding partner engaged it and the
   organisation declines, tell the funder it was declined, not why.
3. **Security:** a person sees an organisation's data only if the organisation accepted the engagement, they
   are a named team member, and their grant is active and unexpired. Firm membership alone grants nothing.
4. Before seeing anything, each team member signs the versioned independence and conflict-of-interest
   declaration (no ownership, employment or advisory ties; no part in preparing the assessment; explicit
   disclosure if engaged or paid by a funder). Stored and shown on the result.
5. A funding partner's staff can only create a Funder review, never an Independent validation.

## Review, outcome and freeze

1. The validator sees self-scores and evidence per indicator, records their own 0-5 score, evidence
   sufficiency and comments, the method (document review, sample testing, interviews, site visit,
   combined) and fieldwork dates.
2. Live Trust Delta: self vs validator score per indicator, and the rung each set implies.
3. Optional debrief: the organisation responds to disputed indicators; record negotiated scores.
4. Outcome: validated · validated with qualifications (each listed and linked to its indicators) · not
   validated. Validated rung = `currentRung()` of the validator's final scores.
5. Freeze on finalising: snapshot scores, rung, level scores, evidence references, validator, firm, team,
   declarations, method, dates, outcome, qualifications. Later self-score changes never alter it.

## Validity and statuses

- Validated: 12 months. With qualifications: 6 months. Rung 5+ without qualifications: validator may choose
  24 months with a surveillance check at 12 (missed → expires at 12). Validator may always set a shorter
  period for a named risk.
- Statuses: current, follow-up overdue, suspended, expired, withdrawn (with reason), superseded. Full history.
- Material events (list below): the organisation reports within 30 days (5 working days for ★); reporting
  sets **suspended pending review**; the validator reinstates, re-scopes or withdraws; disagreements go to the
  Independent Review Panel. Failing to report is grounds for withdrawal. The CRAFT programme team can also
  record an event; the organisation is notified and can respond.

Material events: ★ fraud, theft, bribery or corruption involving funds, staff or board · ★ criminal
investigation or charge against the organisation or a board member / senior manager in their role ·
qualified, adverse or disclaimer audit opinion, or going-concern warning · insolvency, inability to pay staff
or creditors on time, or loss of a funder providing 25%+ of income · a funder suspending, terminating or
demanding repayment of a grant for cause · ★ regulator's sanction, suspension or loss of a needed licence or
registration · placement on a sanctions or debarment list · change of CEO, CFO or board chair · half or more
of the board resigning within 12 months · merger, acquisition, split, change of legal form or control ·
restructuring that changes the activities, locations or programmes covered · loss of systems or records that
prevents evidencing the controls relied on · ★ substantiated safeguarding / SEA case, or serious
data-protection breach reported to a regulator.

## CIP and the follow-up schedule

1. CIP actions have owner, due date and proof-of-done evidence; marking done with evidence updates the
   self-assessment.
2. On finalising, validator and organisation pick the follow-up schedule: milestone-based (default; e.g. all
   blocking or qualified items done), fixed interval (3 or 6 months), or end of plan.
3. Follow-ups re-check only the qualified or blocking indicators. Full re-validation on the normal cycle.
4. The CIP can bring a check forward, **never extend validity**.
5. Missed point → "follow-up overdue"; at expiry → "expired" (not "not validated").
6. Emails to organisation and validator 30 and 7 days before each point and before expiry.
7. With consent, the engaging funder sees schedule and progress ("2 of 5 actions done, follow-up due 15 March").

## Ratings and feedback

Only parties to a finalised engagement (the organisation, the engaging funding partner) can rate the
validator, once per engagement, 1-5 plus text. The validator can reply publicly. The Review Panel can remove
false or abusive feedback. Ratings show on the validator's profile and feed quality statistics.

## Independent Review Panel (disputes and complaints only)

- Hears disputes about a validation's result or conduct, complaints about a validator, contested material
  events and suspensions, and challenges to re-review outcomes. Cases come from organisations, funding
  partners, validators, or the public "report a concern" link.
- A new panel per case: a convenor from the CRAFT programme team + 2 reviewers from a volunteer roster of
  Senior Validators (an outside chartered accountant or auditor may sit until enough qualify). Conflict
  checks: different firm from the validator concerned; no work for or with any party in 3 years.
- Both sides respond in writing with evidence; majority decision with written reasons within 30 days.
- Outcomes: dismissed; validation stands / amended / suspended / withdrawn; validator warned / retrained /
  suspended / removed. One appeal to a fresh panel with none of the same members.
- Panel members get no technical admin rights; platform admins have no vote.

## Re-review

No fixed rate. A funding partner may require it. Flag (not auto-open): a validator's first 3 validations,
rung 6-7, large self-vs-validator gap or 2+ rung jump, validator statistics out of line with peers.
Complaints and contested material events go to the Review Panel. The re-reviewer is a Senior Validator from
a different firm; outcomes: stands, amended, withdrawn.

## Public verification page and statement PDF

Lookup by verification ID or the QR code on the PDF; no public list (opted-in organisations appear only in
the signed-in directory). Always shown: ID and status badge with date of last change; organisation name,
country, registration number; framework and version ("CRAFT Capital Readiness Ladder, ICARF v4.0") and scope;
label, validated rung and name, outcome type; validator, firm, credential, accreditation status, validator
type, engaging party; independence statement and disclosure; method, fieldwork dates, issue, expiry, next
verification point; the standard wording below; the PDF's SHA-256; "report a concern". Optional (organisation
chooses): rung history, qualifications summary, DevMapper link. Never: indicator scores, evidence, validator
comments, contact details.

Standard wording (verbatim; lawyer review before launch):

> **What this validation means.** An accredited validator, independent of the organisation, has reviewed the
> organisation's self-assessment and supporting evidence against the CRAFT Capital Readiness Ladder (ICARF
> v4.0), using the method and scope stated above, and has concluded that the organisation met the
> requirements for the rung shown on the dates of the review. Any qualifications listed form part of this
> conclusion.
>
> **What it does not mean.** It is not an audit or review of financial statements, and not a guarantee of the
> organisation's future performance, solvency, or use of funds. It does not cover matters outside the stated
> scope, and it reflects evidence available to the validator at the time; it may not reflect events after
> the review date. It is not an endorsement by DiBadili Institute or the engaging party, and it does not
> replace the due diligence of anyone deciding to fund, lend to, or partner with the organisation.
>
> **Its status can change.** A validation is valid only while it shows as current on its verification page.
> It may be suspended after a material event, or withdrawn if new evidence shows it was wrong. Always check
> the verification page before relying on a copy.

For a Funder review, replace the first sentence with: "Staff of [funder] have reviewed the organisation's
self-assessment and supporting evidence against the CRAFT Capital Readiness Ladder (ICARF v4.0). The
reviewers are employed by the funder and are not independent of it."

## DevMapper summary function

One well-tested function: for an organisation, the current self-assessed rung, and the latest current
validation if any (label, validated rung and name, outcome, status, validator organisation, validator type,
engaging party, finalised date, expiry, next verification point, verification ID). No DevMapper endpoints.

## Training and accreditation (PR 7)

Eight modules, each = its written script (from the doc's Training modules tab) + a slot for an unlisted
YouTube video on youtube.com/@DiBadiliTV, interactive practice, quizzes, reflection. Then the assessment:
40-question timed exam from the bank (80%), 4 scenario cases (70% each), the Riverbend sandbox capstone.
Badges, levels, CPD tracking. All content stored as data the CRAFT programme team edits without a code change.

## PR split

1. Profiles and directory: validator, firm (nature, competencies, team), funding partner (types),
   organisation opt-in profile; credentials (self-declared / verified); accreditation status incl.
   suspend / reinstate; search and brief profile pages.
2. Engagements: invite / request, acceptance and organisation consent, named team, per-member
   `craft_validator` grants, independence declarations, labels.
3. Review and freeze: scoring, Trust Delta, debrief, outcome and qualifications, snapshot. **Pilot point** — but with no
   manual accreditation, pilot results are labelled "Review by [name]" until PR 7 (training) is live, so
   PR 7 may be built straight after PR 3.
4. Lifecycle: validity rules, statuses, material events, CIP follow-up schedule, reminders.
5. Public verification page, statement PDF (QR, SHA-256), report a concern.
6. Trust and quality: ratings and feedback, validator statistics, re-review flags, Review Panel cases,
   suspension; DevMapper summary function; privacy policy and terms updates; docs.
7. Training and accreditation programme.

Tests per PR: unit tests for the pure logic (rung from validator scores, freezing, every validity rule and
status transition, CIP can't extend validity); integration tests for permissions (no or expired grant
refused; firm member not on the engagement refused; funder staff can't create an Independent validation;
non-accredited can't issue one; organisations can't see others'; non-opted-in organisation not searchable);
Playwright for engagement → public verification page.
