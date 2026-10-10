# Chatbot + issue/email integration plan for craftframework

## Phased continuation checklist

This checklist supersedes the historical suggestions below where they conflict. The policy-only PR implements Phase 1; it does not implement chatbot intake, mail delivery, or analytics. Before each subsequent PR, re-check main, open PR heads, local changes, and any active work; do not overwrite PR #10 or assume its draft status indicates an active session.

### Phase 1 — policy only

- Enhance canonical `CODE_OF_CONDUCT.md` using the official Contributor Covenant 2.1 foundation, and align the public policy page without duplicating the existing footer link.
- Keep chatbot, mail, analytics, dependencies, and infrastructure changes out of this PR. The policy does not establish a dedicated reporting team or anonymous reporting service.

### Phase 2 — shared chatbot intake (separate PR, pending)

- [ ] Inspect and consolidate `src/components/SupportBot.tsx`, legacy `netlify/functions/support-bot.ts`, and workspace support handling behind one shared intake contract; reuse canonical `FAQS` and approved docs rather than a second answer bank.
- [ ] Add deterministic bug/feature/question classification, including ambiguous input and a user-editable category before submission; return only supported answers with source links, or clearly state that no answer was found.
- [ ] Disclose **before submission** that every ordinary question/report creates a **public**, labelled GitHub issue, even when an FAQ answers it. Preview a sanitized, PII-free issue body; exclude email, credentials, assessment/evidence data, and confidential context.
- [ ] Route conduct, security, and confidential submissions away from public issue creation and into private reporting. Test this boundary across widget and workspace intake, not just category keywords.
- [ ] Return actual provider-confirmed, validated HTTPS issue URLs for this repository as safe clickable links; never fabricate a link or claim success after failure.
- [ ] Use durable idempotency and rate limits (including concurrent requests, retries, and tenant isolation), validate inputs/CORS, and preserve chat answers when GitHub or SendGrid is unavailable.
- [ ] Add mocked-provider tests for classification/correction, FAQ sources, redaction/private routing, every ordinary submission including FAQ matches, URLs, concurrent duplicate prevention, and rate limits; add accessible keyboard/mobile browser regression coverage where available.
- [ ] Document actual configuration requirements and accepted/failed/not-configured issue status; distinguish implementation from live operation.

### Phase 3 — escalation and opt-in feedback mail (separate PR, pending)

- [ ] Build on the shared intake result: maintainer mail to `craftframework@becomechange.institute` **only** for unresolved, explicitly human-requested, or urgent escalations. Ordinary FAQ-resolved questions create an issue but do not notify maintainers.
- [ ] Collect an editable, labelled email address **before** submission, with explicit optional feedback consent and safe address verification before sending answers. Keep addresses out of public issues and analytics.
- [ ] Report mail `accepted`, `failed`, or `not_configured` distinctly; provider acceptance is not delivery. Missing SendGrid must not fail chat or issue creation, and must not imply mail was sent.
- [ ] Use secure durable retry/outbox state tied to the existing submission idempotency key so mail retries cannot create duplicate issues or duplicate notifications.
- [ ] Test opt-in/verification, escalation reasons, FAQ no-notification, absent/failed providers, retry/concurrency, and cross-tenant confidentiality with mocked providers; exercise labelled input/status flows in browser regressions where available.

### Phase 4 — optional PostHog (separate PR, pending)

- [ ] Re-read current official [AI wizard instructions](https://posthog.com/docs/ai-engineering/ai-wizard) and [wizard README](https://github.com/PostHog/wizard) before attempting the exact requested command: `npx -y @posthog/wizard@latest`.
- [ ] Review the latest package version/advisories and source-sharing implications first. Run only in a supported interactive terminal; honor privacy/external-AI approval and account authentication prompts. Never fabricate credentials, bypass consent, or send secrets/confidential source.
- [ ] Record the actual command result and exact interactive/authentication blocker. If blocked, stop and provide safe follow-up instructions for an authorized maintainer; do not claim installation or add the wizard as a runtime dependency.
- [ ] Keep analytics optional and explicitly consented, with minimal allowlisted, PII-free events. No session replay or autocapture of authenticated assessment, evidence, chat, or email content; do not weaken CSP or privacy controls.
- [ ] Review generated changes independently, test consent-off and sensitive-route exclusion, and document configuration versus deployment.

**Phase 1 status:** PostHog has not been attempted or installed in this phase. Phases 2–4 remain pending; no live deployment is claimed.

## Historical proposal (not current requirements)

The material below predates the phased checklist. In particular, selective public issue creation, putting user email in an issue, forwarding all messages to maintainers, and generic support analytics are not approved requirements.

## Objective

Allow people to ask questions about `craftframework`, route them into a useful support flow, and create GitHub issues or email notifications when needed.

## Recommended architecture

### 1. Chat frontend
Use a lightweight web assistant or chatbot UI on the project site or docs page. This can be implemented as:

- a Netlify Function or serverless endpoint
- a simple chat widget embedded in the docs or support page
- a hosted assistant service (for example, a GPT/LLM-backed bot)

### 2. Intake routing
The chatbot should classify messages into three buckets:

- general question
- bug report
- feature request

Based on the classification:

- general question → answer from docs or route to a GitHub discussion or issue
- bug report → create a GitHub issue, with structured title and details
- feature request → create a GitHub issue or save to backlog

### 3. Email escalation
For maintainers, messages should also be forwarded to:

- `craftframework@becomechange.institute`

This helps ensure operational continuity if the chatbot is unavailable or if a user needs a direct human response.

### 4. GitHub issue automation
Use a webhook or GitHub API call to create issues with a standard format when the chatbot identifies something actionable.

Recommended issue fields:

- summary/title
- description
- user email (optional)
- category: question | bug | enhancement
- product context or module
- environment details
- priority

## Example support flow

1. User asks: “How do I configure role-based access?”
2. Chatbot checks docs and answers if possible.
3. If the answer is not found, it asks a follow-up.
4. If the question remains unresolved, it creates a GitHub issue or opens a support thread.
5. Maintainer receives the issue and/or email notification.

## Governance and trust

To keep this community-friendly and credible:

- keep all bot-generated issues labeled clearly
- require human review before closing or escalating a case
- do not auto-create issues for obviously sensitive or personal data
- document how user data is handled
- include a clear “contact maintainers” route for confidential concerns

## Practical implementation options

### Option A: Minimal and simple
- static docs site
- simple chatbot widget
- a Netlify Function
- GitHub issue creation via GitHub API
- direct email forwarding to the team

### Option B: More scalable
- frontend chat UI
- backend workflow service
- LLM orchestration
- GitHub Actions or serverless function for issue creation
- monitoring + analytics for support questions

## Recommended first milestone

Start with a bot that:

- answers common documentation questions
- routes unsupported questions to a GitHub issue
- sends a copy to `craftframework@becomechange.institute`
- keeps generated issues in a labeled and reviewable workflow

This gives the project a professional, maintainable support model without overengineering it at the beginning.

## Suggested future improvements

- FAQ and docs search integration
- issue triage labels (`support`, `needs-info`, `triaged`)
- saved support history for maintainers
- optional queue or dashboard for support requests
