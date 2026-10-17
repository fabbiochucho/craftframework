# Consented analytics (PostHog, EU)

Behaviour analytics are **opt-in**. Nothing is loaded from, or sent to, PostHog until a visitor answers the
consent banner, and rejecting is as easy as accepting. Do Not Track and Global Privacy Control count as a
rejection. The privacy policy (`src/pages/PrivacyPage.tsx`) and sub-processor list
(`src/pages/PolicyPages.tsx`) describe this to users.

## Where the code lives

| File | Role |
| --- | --- |
| `src/lib/consent.ts` | Consent state machine and `localStorage` store (`craft_consent`: choice, timestamp, policy version). Bump `CONSENT_POLICY_VERSION` when the analytics wording in the privacy policy changes; visitors are asked again. |
| `src/components/ConsentBanner.tsx` | First-visit banner (Accept analytics / Reject / Choose) and the settings panel reopened by the footer link. |
| `src/lib/analyticsRoutes.ts` | Allowlist of measurable pages. Every file in `src/routes` must be classified; `analyticsRoutes.test.ts` fails otherwise. Unknown paths are sensitive. |
| `src/lib/analyticsScrub.ts` | PostHog `before_send`: drops events from sensitive pages, validates funnel-event properties, strips emails, query strings, titles and free text. |
| `src/lib/analytics.ts` | Loads `posthog-js` (full no-external build) after consent, follows the router, identifies signed-in users, exposes `trackEvent`. |
| `src/components/AnalyticsController.tsx` | Connects router navigation and the signed-in user to the above. |

## Route classes

- **marketing** - public pages; session replay may show their text.
- **allowed** - sign-up/sign-in, onboarding, directory, training, public validation, policy, help and guide pages;
  replay masks all text and inputs.
- **sensitive** - everything else (assessment, `/app/*`, evidence, data room, findings, CIP, reports, dashboards,
  engagements, review, validations, panel, admin, settings, vaults, finance). No pageviews, autocapture, replay,
  heatmaps, errors or web vitals. Recording stops *before* the page renders (router `onBeforeNavigate`).
  Only content-free funnel milestones (for example `engagement_created`) are sent, with no location.

## Funnel events

`signed_up`, `onboarding_step_completed {step}`, `onboarding_completed`, `validator_profile_created`,
`training_module_completed {module}`, `exam_started`, `exam_passed`, `exam_failed`, `engagement_created`,
`directory_search {type, has_results}`. Call `trackEvent` from `src/lib/analytics.ts`; properties are validated
against a schema in `analyticsScrub.ts` and anything else is dropped.

## Environment

- `VITE_POSTHOG_KEY` (Netlify build env): the public project key of the **EU** project. Without it the banner is hidden
  and nothing is tracked.
- `VITE_POSTHOG_ID_SALT` (optional): salt for the SHA-256 of the user id.

## PostHog project settings (set in the PostHog UI)

Session replay, heatmaps, exception autocapture and web vitals only run when the project's own settings allow them
(the browser fetches the project's remote config after consent).

1. Use an **EU Cloud** project; copy its project key into `VITE_POSTHOG_KEY`.
2. Settings > Replay: enable session recording; authorized/recording domains `craftframework.becomechange.institute`.
3. Settings > Web analytics / Autocapture: enable web vitals, heatmaps and exception autocapture.
4. Settings > Data: **Discard client IP data** on; set data retention (events and recordings) to the period stated in the privacy policy.

## Testing

`npm test` covers the route classifier, consent state machine and scrubber. `npx playwright test consent.spec.ts`
intercepts `*.posthog.com` and checks: no request before consent, reject sends nothing, accept measures `/directory`
but nothing on `/assessment`, `/evidence`, `/app/*`, `/engagements`, replay needs its own consent, DNT/GPC, withdrawal,
keyboard operation. Other e2e specs start with the banner already answered (`consent: 'rejected'` fixture).
