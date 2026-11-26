# Dignity & Agency audit

CRAFT exists to help local institutions grow, not to gatekeep them. This audit checks the platform against four
commitments and records what was changed. Re-run it before any release that adds an organisation-facing screen.

## 1. Self-assessment stays free

- **Checked (2026-11-26):** there is no payment, plan or paywall code in the app. Self-assessment, the improvement plan,
  the data room checklist and the offline workbook are available to every organisation.
- **Rule:** charging, if ever introduced, applies to independent validation and services, never to an organisation
  assessing itself or seeing its own results.

## 2. Works with poor or no connectivity

- **In place:** installable app with an offline cache (`dist/client/sw.js`), offline sync of framework answers
  (`src/lib/offline/`), and the offline Excel workbook (`src/lib/offlineWorkbook.ts`) that is filled in without a
  connection and uploaded back.
- **In place:** answers typed but not yet saved are kept on the device, encrypted, until they reach CRAFT
  (`src/lib/draftVault.ts`), so a dropped connection or an expired sign-in never loses work.
- **Next:** a Telegram channel for reminders, questions and the quick screen (see the Telegram integration).

## 3. The organisation controls its results

| What | Who decides | Default |
| --- | --- | --- |
| A funding partner seeing validation progress | the organisation (`/api/validations/:id/funder-consent`) | off |
| A funding partner seeing review comments | the organisation, as a separate consent | off |
| The public verification page's details | the organisation (`publicOptions`) | minimal |
| Being counted in public benchmarks | the organisation itself (`/api/benchmarks/consent`) | off |
| Quantified-risk (FAIR) figures | the organisation (`fair:consent`) | off |

Every one of these can be withdrawn, and each change is written to the audit log.

## 4. Language that points to the next step

Organisation-facing screens describe gaps as what to do next, not as failure. Changed in this audit:

| Screen | Before | After |
| --- | --- | --- |
| Dashboard accreditation | "⚠ Capped by penalty engine" (red) | "Capped until implementation is evidenced" (amber) |
| Dashboard banner | "Paper Compliance Penalty Active … mathematically capped … until system-enforced execution is demonstrated", "Review gaps" (red) | "Next step: show your policies at work … Evidence that your systems are in use lifts the cap", "See what to evidence" (amber) |
| Readiness check answer | "Weak / No" | "Not yet" |
| Foundation module results | "Weak Links", "weak link" | "Areas to strengthen", "area to strengthen" |
| Portfolio overview | "Below Penalty Threshold" | "Need implementation evidence" |
| Corrective-action summary | "Failed effectiveness" | "Not yet effective" |

The methodology pages keep the name **Paper Compliance Penalty**: there it names a published scoring rule and is
explained, not applied to anyone.

**Rule for new screens:** say what is missing and what evidence would close it. Reserve red for overdue deadlines and
errors, not for an organisation's level.

## 5. Peer learning instead of ranking

- **In place:** Networks (`docs/networks.md`) let a hub or programme run its members as a cohort: anonymous results
  (groups under five suppressed), and exchange pairings that match members strong in an area with members building it
  (`src/lib/networkExchange.ts`).
- **How a hub runs a cohort today:** create a Network, invite its organisations, open a round, and use the exchange
  plan for peer-learning visits, mentoring and twinning. No member is ranked or named without its consent.
