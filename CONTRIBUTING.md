# Contributing to craftframework

Thanks for your interest in contributing to `craftframework`. We welcome bug reports, feature suggestions, documentation improvements, and code contributions.

This project is managed in a way that supports transparent collaboration and responsible issue handling. We aim to keep the community welcoming, respectful, and productive.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Ways to Contribute

You can contribute by:

- reporting bugs
- suggesting features or improvements
- improving documentation
- fixing issues and opening pull requests
- helping review issues and pull requests
- contributing design, UX, or accessibility feedback

## Before You Start

Please check the repository issues and discussions first to avoid duplicating work.

If you are planning a substantial change, open an issue first so we can discuss the approach before you invest time in implementation.

## Local Development

### Prerequisites

- Node.js 18+
- npm
- Git

### Setup

```bash
npm install
npm run dev
```

If the project uses a Netlify-specific local workflow, check the project README for the exact development command before proceeding.

## Workspace Platform Development

- Schema changes go in `db/schema.ts`; generate a migration with `npx drizzle-kit generate --name <change>` (output lands in `netlify/database/migrations`, applied automatically on deploy).
- API routes live in the route table of `netlify/functions/workspace-api.mts`. Declare the minimum role for each route and filter every query by the org id returned from `requireOrgAccess`/`requireWorkspaceAccess`.
- Put pure business rules in `netlify/lib/workspace.ts` and cover them in `netlify/lib/workspace.test.ts` (`npm test`).
- See `docs/platform-guide.md` and `docs/api/openapi.yaml`.

## Coding Guidelines

- Follow the project's existing code style and patterns
- Keep changes narrow and focused
- Write clear commit messages
- Add or update tests for behavior changes when applicable
- Avoid unrelated refactors in the same pull request
- Update documentation when user-facing behavior changes

## Commit Messages

Use clear, descriptive commit messages, for example:

- `fix: resolve issue with assessment validation`
- `docs: add security reporting guidance`
- `feat: add export for capacity development plans`

## Pull Request Process

1. Fork the repository or create a branch from the latest `main` branch.
2. Make your changes in a dedicated branch.
3. Ensure the project still builds and relevant validations pass.
4. Open a pull request with a clear title and summary.
5. Include context about the problem and the solution.
6. Reference related issues when relevant.
7. Respond to review comments in a constructive and timely way.

## Reporting Bugs

Before submitting a bug report, please:

- check whether the issue already exists
- confirm the bug still occurs in the current project state
- include reproduction steps and expected vs actual behavior
- include relevant environment details

## Feature Requests

Feature requests are welcome when they are aligned with the project's goals. Please:

- explain the problem the feature solves
- describe the proposed behavior
- describe any alternatives you considered
- include examples where possible

## Documentation Contributions

Documentation improvements are highly valued. If you see a gap, ambiguity, or outdated guidance, please submit a pull request.

## Review Expectations

We aim to review contributions promptly, but timelines may vary depending on project activity and maintainer availability.

If your contribution is accepted, a maintainer may request small adjustments before merge.

## Questions?

If you are unsure where to start or need clarification, please open a discussion or contact the maintainers at:

craftframework@becomechange.institute

Thank you for helping improve `craftframework`.
