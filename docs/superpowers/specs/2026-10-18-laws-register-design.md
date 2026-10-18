# CRAFT laws register and jurisdiction alignment — design

**Date:** 18 October 2026 · **Owner:** Abiola Oshunniyi · **Status:** approved in conversation; awaiting spec review

## 1. Purpose

One register of laws, used two ways:

1. **Organisations** get a *jurisdiction alignment report*: the laws that apply where they are registered and operate, and how far their CRAFT answers show readiness for each.
2. **DiBadili (Super Admin)** gets an *internal check*: what each law means for CRAFT itself (registration, cross-border data, local representation, wording of reports), so CRAFT's questions, data handling and claims fit every jurisdiction it serves.

The register is information, not legal advice. Reports say "readiness" and "alignment", never "compliant" or "compliance with".

## 2. Scope

- **Jurisdictions:** all 54 African Union member countries (ISO 3166 alpha-2, as in `africa-countries.ts`), plus `EU`, `UK`, `US`. 57 in total.
- **Areas of law (seven):**

| Id | Area | Typical laws |
|---|---|---|
| `company` | Company and non-profit law | companies act, NGO / charities / associations law |
| `data` | Data protection and privacy | data protection act, regulator rules on registration and transfers |
| `integrity` | Anti-corruption and anti-money-laundering | anti-corruption act, AML/CFT act, whistleblower protection |
| `procurement` | Public procurement | public procurement act and regulations |
| `governance` | Corporate governance codes | national code, listing-rule code |
| `labour` | Labour and employment | labour / employment act, occupational safety |
| `eia` | Environmental impact assessment | environment act, EIA regulations |

- **In force only.** A known reform may be noted in one line (`reformNote`); bills are not tracked.

## 3. Phasing

1. **Phase 1 (this build, local):** register structure, tests, jurisdiction report, internal check, and full sourced entries for **NG, KE, US, UK, ZA, MA, EG, SN, MU, CV**. Ships after founder approval of the entries.
2. **Phase 2 (cloud):** routines research the remaining 47 jurisdictions in regional batches (North, West, Central, East, Southern), each opening a pull request with one data file. Same review gate.

## 4. Data model

New folder `src/lib/laws/`.

```ts
export type LawArea = 'company' | 'data' | 'integrity' | 'procurement' | 'governance' | 'labour' | 'eia'
export type LawJurisdiction = string // ISO alpha-2 of an AU member, or 'EU' | 'UK' | 'US'
export type SourceKind = 'official' | 'secondary'
export type ReviewStatus = 'pending' | 'approved'
export type CraftDuty = 'registration' | 'cross-border' | 'local-representative' | 'breach-notice' | 'wording' | 'other'

export interface LawEntry {
  id: string                    // `${jurisdiction}-${area}-${n}`, e.g. 'NG-data-1'
  jurisdiction: LawJurisdiction
  area: LawArea
  title: string                 // official short title, as cited
  citation: string              // year and number, e.g. 'Act No. 37 of 2023'
  regulator: string | null      // body that enforces it
  summary: string               // obligations in CRAFT's own words (max ~60 words); no statute text copied
  source: { url: string; kind: SourceKind; checked: string /* YYYY-MM-DD */ }
  extraQuestions?: string[]     // CRAFT question ids added to the area mapping for this law
  craftNotes?: { duty: CraftDuty; note: string; status: 'done' | 'needed' | 'n/a' }[]
  reformNote?: string
  review: ReviewStatus
}
```

- One data file per batch: `src/lib/laws/data/phase1.ts` now; `data/<region>.ts` from cloud routines. `src/lib/laws/register.ts` concatenates them and exports `LAW_REGISTER`, `LAW_AREAS` (id → label), `lawsFor(jurisdictions)`.
- `LAW_DATA_VERSION = 'CRAFT-LAW 1.0 (<date>)'`, bumped with each batch.

### Mapping to CRAFT questions

Set once per area, reusing `INDICATOR_CATALOGUE` (`crosswalkExisting.ts`), by core domain, ladder domain and index id prefix:

| Area | CRAFT questions |
|---|---|
| company | core `Legal & Regulatory`, `Governance & Leadership`; ladder `Legal Structure & Registration` |
| data | core `Digital Systems & Cyber` |
| integrity | core `Ethics & Anti-Fraud`, `Risk & Internal Controls`; Fiduciary Controls index |
| procurement | core `Procurement & Supply Chain` |
| governance | core `Governance & Leadership`, `Audit & Assurance`; ladder `Core Governance & Leadership`, `Transparent Governance & Reporting` |
| labour | core `Human Resources`; ladder `Social Value & Human Capital` |
| eia | core `Env. & Social Safeguards`; E&S Safeguards index |

Each law's questions = its area's questions + `extraQuestions`. Applicability (public-body, screening, lenses) follows the catalogue's `applies` and lens rules, exactly as alignment reports do.

## 5. Validation (tests: `node src/lib/laws/laws.test.ts`)

- Every entry: jurisdiction is one of the 57; area valid; unique id; non-empty title, citation, summary; `source.url` is https; `source.checked` is a real date not in the future; `kind` set.
- `summary` ≤ 60 words. (Checking that summaries are in CRAFT's own words is a review task; the test only enforces length.)
- `extraQuestions` all exist in `INDICATOR_CATALOGUE`.
- Phase 1 jurisdictions each have at least one entry in every area, or an explicit `none`-style entry explaining no such law exists (e.g. no national governance code), so a missing area is never silent.
- Report labels never contain "compliant", "compliance with", "certified".

## 6. Jurisdiction alignment report

On the Reports page, a fourth card beside index, alignment and ISO.

- **Jurisdictions shown:** the organisation's `country` plus its `jurisdictions` list from the entity profile; the user may add or remove jurisdictions on the card before viewing.
- **Per jurisdiction, per area, per law:** title and citation, regulator, summary, the mapped CRAFT questions with a rating from `coverageOf` (Covered / Partial / Gap / Gap (limited evidence) / Not assessed / Not applicable), source link with "official" or "secondary source, verify", and the checked date.
- A jurisdiction with no approved entries shows "Not yet reviewed" and no ratings. Pending entries are never rated or shown to organisations.
- Header: organisation name, as-of date, `LAW_DATA_VERSION`, lenses line. Footer: "This report is information to support readiness, not legal advice. Laws change; check the cited source and take local legal advice before relying on it." plus the attribution notice.
- Print (same print-only mechanism as the other reports) and CSV export (one row per law: jurisdiction, area, title, citation, regulator, rating, answered/in scope, source kind, source url, checked).

## 7. Internal check (Super Admin)

A Super Admin page section (on the existing Regulatory sources page) listing, across all jurisdictions:

- every `craftNotes` item: jurisdiction, law, duty, note, status (done / needed / n/a), sorted with `needed` first;
- entries whose `source.checked` is older than 12 months ("re-check due");
- entries still `pending` review, with counts per jurisdiction.

## 8. Review and sign-off

- `scripts/export-laws-review.mjs` writes `docs/laws/review-<batch>.md`: every entry in a table for founder / counsel review, with tick boxes per jurisdiction.
- Approval flips `review: 'pending'` to `'approved'` in the data file in a commit referencing the reviewer and date. Only approved entries reach organisation reports.

## 9. Phase 2 cloud routines

- One routine per region (5) creating one data file each, plus a prompt that includes this spec's §2, §4, §5 rules, the sourcing rule (official first; secondary flagged), "own words only" and "in force only".
- Each routine runs the tests and opens a PR; entries arrive `pending`. Routines are created with connectors cleared.

## 10. Out of scope

Bills and draft laws; sub-national (state/provincial) law; sector regulators' rulebooks beyond the seven areas; automatic change tracking; legal opinions.

## 11. Risks

- **Accuracy:** mitigated by citations, checked dates, secondary flags, the review gate, and the not-legal-advice footer.
- **Copyright:** summaries in CRAFT's words; no statute text reproduced.
- **Staleness:** the 12-month re-check list on the internal check.
