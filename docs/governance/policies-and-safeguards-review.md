# Policies and security safeguards — review and items for legal confirmation

Prepared 15 October 2026. Compares CRAFT with devmapper.africa and lists what the policy pages deliberately leave for legal confirmation.

## Policy pages now published

| Page | Path | Status |
|---|---|---|
| Privacy Policy | `/privacy` | Rewritten 15 Oct 2026: controller/processor roles, lawful bases, document checks and OCR, sub-processors, African data protection laws and authorities, retention, transfers, full cookie table, children, complaints |
| Terms of Service | `/terms` | Updated: acceptable use, account security and MFA, data protection clauses |
| Acceptable Use Policy | `/acceptable-use` | New |
| Data Processing Terms | `/data-processing` | New (processor commitments; signed DPA on request) |
| Sub-processors | `/subprocessors` | New (Netlify, SendGrid, Resend, Anthropic via Netlify AI gateway, PostHog EU opt-in, GitHub for public issues) |
| Security | `/security` | New (safeguards, responsible disclosure, safe harbour, incidents) plus `/.well-known/security.txt` (RFC 9116, expires 15 Oct 2027) |
| Accessibility Statement | `/accessibility` | New (WCAG 2.2 AA goal, known limitations) |
| Code of Conduct | `/code-of-conduct` | Existing |

All are linked from the footer and from each other, allowed in `robots.txt` and listed in the sitemap.

## Comparison with devmapper.africa

| Item | DevMapper | CRAFT |
|---|---|---|
| Privacy policy, terms | Not published (community guidelines only) | Published and updated |
| Acceptable use, DPA, sub-processors, security, accessibility | Not published | Published |
| Community guidelines | `/guidelines` | Code of Conduct and Acceptable Use Policy |
| CAPTCHA on sign-up and sign-in | **hCaptcha** | **Not yet** — see recommendations |
| Dependabot | Yes | **Added** (`.github/dependabot.yml`) |
| Multi-factor sign-in | Not found | Yes (TOTP, recovery codes, org policy) |
| Security headers (CSP, HSTS, frame, nosniff, referrer, Permissions-Policy, COOP) | Not checked in detail | All present on static files and pages |
| security.txt | No | Yes |

## Safeguards added in this release

- `Permissions-Policy` disabling camera, microphone, location, payment, USB, serial, Bluetooth, HID, motion sensors and Topics; `Cross-Origin-Opener-Policy: same-origin`.
- Dependabot weekly npm updates (grouped minor/patch) and monthly GitHub Actions updates.
- `security.txt` with contact, policy link and expiry.

## Recommendations still open

1. **Bot protection on sign-up and sign-in.** Sign-up goes straight to Netlify Identity, which has no CAPTCHA. Options: Cloudflare Turnstile or hCaptcha in front of the sign-up form (needs a site key and a CSP update for the provider), or switch Identity registration to invite-only. Organisation creation already requires an organisational email domain.
2. **Legacy pages and MFA.** Multi-factor sign-in protects the workspace platform; legacy dashboard pages still use password-only sign-in until consolidation (see `legacy-consolidation-plan.md`).
3. **Password length.** The app requires 8 characters (Netlify Identity's minimum). Consider 12+ for operators and admins, with MFA required for them.
4. **Third-party sub-processor contracts.** Confirm that DPAs and transfer clauses are in place with Netlify, SendGrid (Twilio), Resend, Anthropic/Netlify AI Gateway, PostHog and GitHub, and confirm the data locations to list on the Sub-processors page.
5. **Vercel.** Preview deployments are also built on Vercel. Confirm they never receive production data or secrets; if they do, Vercel must be listed as a sub-processor.

## For legal confirmation (deliberately not invented on the pages)

- **Legal entity details:** confirmed 15 October 2026 — Di Badili Leadership Sustainability Initiative, P.O. Box 2550, Festac Town, Lagos, Nigeria; now stated in the Privacy Policy and Terms. Registration number still to add if required.
- **Data protection officer:** appointed — Abiola Oshunniyi, dpo@becomechange.institute (clause published verbatim on the privacy policy, 15 October 2026). Still to confirm: South Africa information officer registration and Kenya ODPC registration if those markets are served.
- **Clause wording:** the domain in the DPO clause was corrected to abiolaoshunniyi.lovable.app on the DPO's confirmation (15 October 2026); the clause was also updated with the trading name, NeuRafiki and "P.O. Box 2550".
- **Regulatory registrations:**
  - Nigeria — whether CRAFT is a data controller or processor "of major importance" requiring registration with the Nigeria Data Protection Commission, and annual compliance audit filing;
  - Kenya — registration with the Office of the Data Protection Commissioner;
  - South Africa — information officer registration with the Information Regulator;
  - others as the user base grows.
- **Governing law and dispute resolution** for the Terms of Service (not currently stated).
- **Commitments stated as aims:** five working days to acknowledge security reports and accessibility feedback; 30 days for data subject requests; regulator notification within 72 hours where required.
- **Founder-protection overlay wording:** see `founder-protection-review-pack.md`.
