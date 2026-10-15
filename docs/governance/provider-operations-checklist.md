# Provider operations checklist

For: the platform operator · Prepared 15 October 2026 · Review every quarter and after any incident.

Tick each item and record the date and who did it. Never paste secret values into this document, tickets or chat.

## 1. Hosting capacity (Netlify)

The site was offline on 14 October 2026 because the account's usage credits ran out (every page returned 503 "usage exceeded").

- [ ] Choose a plan or credit top-up that covers normal traffic, scheduled functions and deploys; enable auto top-up if acceptable
- [ ] Set a usage alert well below the limit (e.g. 70%)
- [x] Deploy previews for pull requests turned off (15 October 2026); batch merges into fewer production deploys
- [ ] Know the scheduled functions: daily — `evidence-expiry-alerts`, `compliance-alerts`, `universal-obligations-alerts`, `weekly-reports`, `cap-escalations`; every 4 hours — `support-escalation-retry` (about 180 runs a month; changed from hourly on 15 October 2026); daily — `encryption-backfill`
- [ ] Decide whether the Vercel preview deployments are still needed (they duplicate builds)

## 2. Credential rotation

| Secret | Used for | Rotate | How |
|---|---|---|---|
| `FIELD_ENCRYPTION_KEY` (+ `FIELD_ENCRYPTION_KEY_VERSION`, `FIELD_ENCRYPTION_PREVIOUS_KEYS`) | Encrypting personal and sensitive fields, MFA secrets | Yearly or on suspicion | Add the new key with a new version, move the old one into `FIELD_ENCRYPTION_PREVIOUS_KEYS`, deploy, run `npm run crypto:backfill`, verify (section 4), then retire the old key |
| `MFA_SESSION_SECRET` | Signing multi-factor session cookies | Yearly or on suspicion | Set a new random value (≥ 32 bytes); everyone re-enters a code once |
| `SENDGRID_API_KEY` / `RESEND_API_KEY` | Report and escalation email | Yearly | Create a new restricted key in the provider, update, revoke the old one |
| `NETLIFY_IDENTITY_ADMIN_TOKEN` | Identity administration | Yearly | Regenerate in Netlify, update |
| `ANTHROPIC_API_KEY` | Support assistant | Yearly | Rotate in the provider console |
| `GITHUB_TOKEN` | Repository automation | 90 days | Fine-grained token, least privilege |
| Database credentials | Postgres | Provider default; on staff change | Rotate in the database provider |

- [ ] `MFA_SESSION_SECRET` set in production (otherwise the cookie key is derived from `FIELD_ENCRYPTION_KEY`; production refuses to run with neither)
- [ ] Every secret is scoped to the production context only, with no copies in deploy previews

## 3. Sender verification (report and escalation email)

- [ ] Sending domain verified with the email provider (SPF include, DKIM keys published)
- [ ] DMARC record published (start with `p=none` and reporting, then move to `quarantine`)
- [ ] `SENDGRID_FROM_EMAIL`, `COMPLIANCE_FROM_EMAIL`, `REMINDER_FROM_EMAIL`, `INVITE_FROM_EMAIL` and `SUPPORT_EMAIL` all use the verified domain
- [ ] Send a test report and an escalation email; check headers show SPF, DKIM and DMARC pass

## 4. Encryption backfill verification

After any key change, or once for data created before field encryption was introduced:

- [ ] Run `npm run crypto:backfill` against production (from a secure machine, with production variables)
- [ ] Spot-check sample rows: encrypted fields start with the version prefix, not plaintext (organisation contact email and phone, sensitive findings, reviewer notes, member emails, MFA secrets)
- [ ] Confirm the application still reads them (open an organisation, a sensitive finding and an evidence record)
- [ ] Record counts of rows checked and any failures

## 5. Access and security

- [ ] Platform super-admin list (`netlify/lib/auth.ts`) contains only current operators
- [ ] Operators have multi-factor sign-in turned on (Account security)
- [ ] Review the NPHI verification queue weekly; record the evidence checked for each manual decision
- [ ] Security headers present on pages (CSP, X-Frame-Options, HSTS): `curl -I https://craftframework.becomechange.institute/`
- [ ] `npm audit --audit-level=high` clean on production dependencies

## 6. Data

- [ ] Database backups enabled and a restore tested in the last 6 months
- [ ] Evidence blob storage retention matches the published privacy policy
- [ ] GDPR/NDPA erasure requests processed within the stated time

## 7. Regulatory content

- [ ] Before each reporting cycle, re-verify regulatory sources (see `regulatory-source-reverification.md` and the Regulatory sources page)
