# Chatbot + issue/email integration plan for craftframework

This is a simple, low-risk plan for adding a support chatbot while keeping issue intake organized and maintainable.

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
