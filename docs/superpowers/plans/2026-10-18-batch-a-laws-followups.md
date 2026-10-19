# Batch A: laws register follow-ups, onboarding countries, stage 2 leftovers

**Goal:** Let Super Admins approve laws per jurisdiction from the app, fix the deferred laws review items, offer all 57 jurisdictions in onboarding, and close the two remaining stage 2 minors.

**Spec:** `docs/superpowers/specs/2026-10-18-laws-register-design.md` (§8 review and sign-off, §7 internal check); owner request of 18 October 2026.

## Global constraints
- Approval is per jurisdiction (all its entries together), Super Admin only, with MFA as on other admin endpoints, and written to the audit log.
- Approvals are stored in a new table (`law_approvals`); this is a production database change and must be called out before merge.
- Data-file `review: 'approved'` still works; an entry is approved if either says so.
- Reports never say "compliant"; stale approved entries show a re-check note to organisations.

## Tasks
1. **Laws data fixes.** US company and data, Senegal and Cape Verde governance become rated entries (not "no national law"); NG-sustainability-1 source kind → secondary; EG-company-2 source → ICNL Egypt. Test: those entries are not `noLaw`; kinds and URLs as stated.
2. **Re-check warning.** `isRecheckDue(entry, today)`; `LawRow.recheckDue`; the report shows "Re-check due: source last checked over 12 months ago". Test.
3. **Approvals.** Pure `applyApprovals(entries, approvedJurisdictions)` (tested); `buildJurisdictionReport` and `buildInternalCheck` take approvals; migration `law_approvals` (jurisdiction PK, approved_by, approved_at, register_version); `/api/law-approvals` GET (signed in) and POST/DELETE (Super Admin + MFA, audited); Reports page and Admin Laws register tab use it, with Approve/Revoke buttons per jurisdiction.
4. **Onboarding countries.** `COUNTRIES` lists all 54 African countries (the familiar ten first) plus the UK and US, with flags; codes match the laws register (`UK` for the United Kingdom). Test.
5. **Stage 2 leftovers.** Narrative report memo depends on the arrays, not their lengths; the index report shows its lens results.
