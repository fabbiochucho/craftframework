# CRAFT site review — October 2026

Prepared 15 October 2026 from Netlify Analytics (19 September – 14 October 2026), a walk-through of the public site and a clean-browser check of the main pages.

## What people look at

**1,407 page views** over the period. Traffic is bursty: most views fall on a few days, which matches announcements rather than steady discovery.

| Days | Views | Likely cause |
|---|---|---|
| 20–21 Sep | 277 | First announcement |
| 8–13 Oct | 976 | Launch kit, videos and new modules |
| Other 20 days | ~150 | Background |

**Top pages (views)**

| Page | Views | Share | Notes |
|---|---|---|---|
| `/` home | 840 | 60% | Most visitors see only this page |
| `/launch` (launch and press kit) | 62 | 4% | Was blocked to search engines by `robots.txt` (fixed) |
| `/dashboard` (legacy app) | 42 | 3% | Returning users of the older dashboard |
| `/auth` sign-in | 33 | 2% | **About 4% of home-page visits reach sign-in** |
| `/methodology` | 32 | 2% | |
| `/pre-assessment` (readiness check) | 30 | 2% | The main lead magnet is barely found |
| `/demo` | 28 | 2% | |
| `/admin/portfolio` | 26 | 2% | Operator use |
| `/contact`, `/institute`, `/open-source`, `/terms`, `/code-of-conduct` | 25–26 each | | Mostly from the footer |
| `/architecture` | 19 | 1% | Was missing from the sitemap and `robots.txt` (fixed) |
| `/app/workspaces` | 5 | <1% | The new platform has very few visitors so far |

**Where visitors come from:** about 95% direct (links in messages, typed URLs, apps that strip referrers). Then the Netlify dashboard (19 — internal), LinkedIn (11 including the Android app), Facebook (8), X/Twitter (3) and **Google (3)**. Organic search is close to zero.

## Findings

1. **The home page carries almost all traffic, but few visitors go further.** Only about 4% reach sign-in and about 4% the readiness check. The home page is long; the two calls to action ("Register your institution", "Explore the methodology") sit only at the top, and the readiness check is not promoted as the first step.
2. **Search engines could not index two of the most useful pages.** `robots.txt` disallows everything not explicitly allowed. `/launch` was in the sitemap but blocked; `/architecture` was in neither. **Fixed in this release.**
3. **Content was invisible without scripts.** The scroll-reveal animation set sections to `opacity: 0` in the server-rendered HTML. Crawlers that do not run scripts, link-preview tools, users of reduced-motion settings and slow phones saw blank sections until scripts loaded and they scrolled. **Fixed:** content is hidden only when scripting is enabled and reduced motion is not requested.
4. **The React hydration warning (#418) seen in Chrome comes from browser extensions**, not the site. A clean browser shows no hydration errors on `/`, `/methodology`, `/pre-assessment`, `/launch` or `/auth`.
5. **Security headers were missing on pages** (fixed in October): CSP, X-Frame-Options and HSTS are now sent on server-rendered pages, and the footer logo is served locally.
6. **The site went offline on 14 October** because the Netlify account's usage credits were used up. Every page returned 503. This is the single biggest risk to visitors and is covered in the provider operations checklist.
7. **The new platform (`/app/...`) is not linked from the public navigation.** Visitors who sign in land on the legacy dashboard (`/dashboard`), which is why it still gets traffic. The new modules (NPHI, JEE/SPAR, organisational design, ESG checklist) are hard to find.
8. **Legacy and workspace models still run side by side** (see the consolidation plan). Multi-factor sign-in now covers both: since October 2026 the legacy `/api` endpoints refuse an enrolled user without a current MFA session, and the legacy pages show the code prompt.

## Recommendations

| # | Recommendation | Effort | Status |
|---|---|---|---|
| 1 | Restore and protect hosting: add Netlify credits or auto top-up, turn off deploy previews, batch deploys, set a usage alert | Owner action | Open |
| 2 | Fix `robots.txt` / sitemap for `/launch` and `/architecture` | Small | **Done** |
| 3 | Make scroll-reveal progressive (no hidden content without scripts or with reduced motion) | Small | **Done** |
| 4 | Lead with the 2-minute readiness check: a hero button, plus a repeat call to action after the "problems" and "how it works" sections | Small | Open |
| 5 | Add "Platform" to the top navigation, pointing signed-in users to `/app/workspaces`; make the post-sign-in landing page the new platform | Small | Open |
| 6 | Add pages for the new audiences — **National public health institutes (NPHI, JEE, SPAR)**, **Government performance (APRM, PEFA)**, **ESG reporting in 54 African countries** — each with its own title, description and sitemap entry | Medium | Open |
| 7 | Put UTM tags on every LinkedIn, Facebook and WhatsApp post so "direct" traffic can be attributed | Small | Open |
| 8 | Register the site in Google Search Console and Bing Webmaster Tools and submit the sitemap; track impressions monthly | Small | Open |
| 9 | Retire the legacy `/dashboard` for new users after consolidation (see the plan), so all sign-ins benefit from MFA and the new modules | Large | Planned |
| 10 | Review this report monthly: views, home → readiness-check and home → sign-in conversion, organic search share | Ongoing | Open |

## Method and limits

Netlify Analytics counts server-side page views (no cookies), so figures include bots that the service did not filter, and "direct" includes many shared links. Conversion figures are page-view ratios, not tracked user journeys.
