# Independent validator system

How CRAFT lets an organisation's self-assessed results be reviewed by an accredited third party, and what
that produces. The build spec is `docs/superpowers/specs/2026-10-16-validator-system.md`; this page is the
operating guide for people who run or extend it. Everything below is enforced on the server — the pages only
reflect what the API allows.

## The three labels (never mixed)

| Label | Who | Wording |
| --- | --- | --- |
| Independent validation | an accredited external validator, whoever engaged them | "Validated by [validator, firm], engaged by [organisation / firm]" |
| Funder review | a funding partner's own staff | "Reviewed by [funder]" — never "validated" |
| Self-assessment | the organisation | "Self-assessed" |

A funding partner cannot create an independent validation (API and database both refuse it).

## Lifecycle at a glance

1. **Profiles and directory** (`/api/directory`, `/api/firms`): validators, validator firms, funding partners and
   opted-in organisations. Accreditation is earned (training, below); the CRAFT programme team can only
   suspend or reinstate, with a recorded reason.
2. **Engagement** (`/api/engagements`): invite or request, the organisation's consent, a named team, a signed
   independence declaration per member. Each named, approved, declared member gets a time-limited read-only
   `craft_validator` access grant (`netlify/lib/engagement-access.ts`); finalising revokes all of them.
3. **Review and freeze** (`/api/validation-reviews`): the validator scores each indicator 0–5 with evidence
   sufficiency, optional debrief with the organisation, outcome (validated / with qualifications / not
   validated). Finalising freezes a snapshot and its SHA-256; later self-score changes never alter it.
4. **Issued validation** (`/api/validations`): validity (12 months; 6 with qualifications; 24 for rung 5+
   without qualifications, with a surveillance check at 12), follow-up schedule, material events, status
   history, reminders (30 and 7 days before each point).
5. **Improvement actions**: each qualification becomes an action the organisation owns. Marking one done needs
   an owner, a due date and proof (also enforced by a database CHECK). A CIP can bring a follow-up forward but
   can never extend validity. With the organisation's consent a funding partner sees counts and dates only.
6. **Public verification** (`/api/public/validation/:id`, page `/validation/:id`): found only by its random
   `CRAFT-V-XXXXXXXX` ID or the QR on the statement PDF. No scores, evidence, comments or contact details.
7. **Trust and quality** (`/api/validator-quality`, this PR): ratings, statistics, re-review flags.

## Statuses

Stored decisions: `current`, `suspended`, `withdrawn`, `superseded`. **Follow-up overdue** and **expired**
follow the calendar and are never stored; the daily job only writes them into the status history when it
observes them. Only `current` and `follow_up_overdue` count as a confirmed rung (see DevMapper below).

## Ratings and feedback

- Only the organisation (or the engaging funding partner, if an engagement ever has one) of a **finalised
  independent validation** can rate its lead validator, **once per party** per engagement, 1–5 whole stars and
  an optional comment of up to 2000 characters. The validator on the engagement cannot rate their own work.
  Funder reviews have no validator and cannot be rated.
- A rating is stored against the lead validator and firm as they were at finalisation.
- The validator may reply publicly (not after a removal).
- The platform admin (standing in for the Independent Review Panel until panel cases land) can remove false,
  abusive or personal-data feedback with a ground and a written reason, and can restore it. The row, the
  ground, the reason and who acted are kept and audit-logged; a database CHECK refuses a removal without them.
- Shown on the validator's directory profile as party and country only — never names or emails.

## Validator statistics and re-review flags

Computed from frozen snapshots in `src/lib/validatorQuality.ts` (thresholds in `FLAG_THRESHOLDS`):

| Flag | Rule |
| --- | --- |
| First validations | one of the validator's first 3 finalised independent validations |
| High rung | validated rung 6 or 7 |
| Large gap | mean absolute self-vs-validator indicator difference ≥ 1 point (0–5 scale) |
| Rung jump | the validator's implied rung is 2 or more rungs from the self-assessed rung |
| Out of line | needs ≥ 5 reviews for the validator and ≥ 3 peers with ≥ 5; approval rate or mean rung difference ≥ 2 standard deviations from the peer mean |

Flags are **advice**. They never open a re-review or change a validation. They are visible to the platform
admin and to a funding partner whose organisation currently lets it follow that validation (the same consent as
progress). Withdrawn and superseded validations are not flagged.

`GET /api/validator-quality/stats` (admin) lists per-validator counts, approval rate, mean gap, mean rung
difference, withdrawals, public concerns and average rating.

## DevMapper summary

`devMapperSummary(orgId, framework = 'capital-readiness')` in `netlify/lib/validator-quality.ts` is the one
function DevMapper will call (there is deliberately no HTTP endpoint). It returns:

- `selfAssessed`: label "Self-assessed", current rung and name (null if nothing is scored);
- `validation`: the latest validation that **currently stands** (status current or follow-up overdue), or null.
  It carries label (Independent validation / Funder review), validated rung and name, outcome, status,
  validator firm, validator type (firm / individual), who engaged them, finalised date, expiry, next
  verification point, and the verification ID.

Expired, suspended, withdrawn and superseded validations are never returned as a confirmed rung. No emails,
scores or evidence are included.

## Configuration

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | send reminders, debrief notices and concern alerts (without it they are logged, not sent) |
| `REMINDER_FROM_EMAIL` / `COMPLIANCE_FROM_EMAIL` / `INVITE_FROM_EMAIL` | sender address, in that order of preference |
| `CONCERNS_TO_EMAIL` | where "report a concern" alerts are emailed |
| `PUBLIC_SITE_URL` | base of verification links and QR codes |

The daily function `validation-reminders` (`@daily`) sends reminders, syncs checkpoints, records calendar
status moves, sends overdue debrief notices and sweeps expired engagements.

## Migrations

All validator-system migrations are additive and live in `netlify/database/migrations/` (profiles, listing
proposals, engagements, training, review, lifecycle, public, CIP follow-ups, ratings). Netlify applies them on
deploy. `validation_follow_ups` is kept but unused (checkpoints replaced it).

## Testing

`npm run typecheck`, `npm test` (pure rules), `npm run test:integration` (needs `TEST_DATABASE_URL` — a database
whose name contains "test"), `npx playwright test` (engagement → public verification, CIP, ratings).
