# Tagged links for sharing CRAFT

Use these links in posts so each visit is labelled with the channel and campaign that brought it (95% of visits currently arrive as "direct", which hides where they came from). The site ignores the tags; they only label the visit.

## Convention

`?utm_source=<platform>&utm_medium=<type>&utm_campaign=<campaign>`

| Field | Values |
|---|---|
| `utm_source` | `linkedin`, `facebook`, `x`, `whatsapp`, `email`, `instagram`, `youtube`, `partner-<name>` |
| `utm_medium` | `social` (organic post), `paid`, `message` (WhatsApp/DMs), `newsletter`, `referral` (partner sites), `video` |
| `utm_campaign` | short, lowercase, hyphenated — e.g. `launch-2026-10`, `nphi-jee-spar`, `esg-54-countries`, `gov-performance`, `readiness-check` |

Keep values lowercase and consistent; analytics treats `LinkedIn` and `linkedin` as different.

## Ready-to-use links

| Purpose | Link |
|---|---|
| Readiness check — LinkedIn | https://craftframework.becomechange.institute/pre-assessment?utm_source=linkedin&utm_medium=social&utm_campaign=readiness-check |
| Readiness check — WhatsApp | https://craftframework.becomechange.institute/pre-assessment?utm_source=whatsapp&utm_medium=message&utm_campaign=readiness-check |
| Readiness check — Facebook | https://craftframework.becomechange.institute/pre-assessment?utm_source=facebook&utm_medium=social&utm_campaign=readiness-check |
| NPHIs (JEE, SPAR) — LinkedIn | https://craftframework.becomechange.institute/for/public-health-institutes?utm_source=linkedin&utm_medium=social&utm_campaign=nphi-jee-spar |
| NPHIs — email to partners | https://craftframework.becomechange.institute/for/public-health-institutes?utm_source=email&utm_medium=newsletter&utm_campaign=nphi-jee-spar |
| Government — LinkedIn | https://craftframework.becomechange.institute/for/government?utm_source=linkedin&utm_medium=social&utm_campaign=gov-performance |
| ESG in 54 countries — LinkedIn | https://craftframework.becomechange.institute/for/esg-reporting?utm_source=linkedin&utm_medium=social&utm_campaign=esg-54-countries |
| ESG — X | https://craftframework.becomechange.institute/for/esg-reporting?utm_source=x&utm_medium=social&utm_campaign=esg-54-countries |
| Launch kit — partners | https://craftframework.becomechange.institute/launch?utm_source=partner-NAME&utm_medium=referral&utm_campaign=launch-2026-10 |
| Videos — YouTube description | https://craftframework.becomechange.institute/?utm_source=youtube&utm_medium=video&utm_campaign=launch-2026-10 |

## Reading results

- Netlify Analytics shows referring domains (Sources) and pages, but may drop query strings, so it may not separate campaigns by their tags. Check once after the first tagged post; if tags do not appear, rely on the options below.
- Each platform reports clicks per post (LinkedIn, Facebook and X post analytics); compare them with page views on the target page for the same days.
- For per-link counts, shorten each tagged link with a link shortener that reports clicks.
- Review monthly alongside the site review metrics (home → readiness check and home → sign-in conversion).
