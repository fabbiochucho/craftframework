# Security Policy

## Supported Versions

The project currently supports the latest version on the default branch and the most recent release line. Security fixes are prioritized for current development work and active releases.

If a release line is no longer maintained, it may not receive security patches.

## Reporting a Vulnerability

If you believe you have found a security issue in `craftframework`, please do not open a public issue.

Please report it privately to the maintainers using one of the following channels:

- Email: `craftframework@becomechange.institute`
- GitHub Security Advisories (if enabled for this repository)

When reporting, please include:

- a clear description of the vulnerability
- affected components or versions
- reproduction steps or proof of concept
- severity assessment, if known
- any suggested fix or mitigation

## Response Timeline

We will acknowledge receipt of your report as quickly as possible and will do our best to provide updates during triage and remediation.

We appreciate responsible disclosure and will work with the reporter to validate and address the issue.

## Disclosure Policy

We ask reporters to allow a reasonable window for a fix before any public disclosure. Once a security fix is released, we may coordinate public disclosure in a responsible manner.

## Platform Security Controls

The multi-tenant workspace platform (`netlify/functions/workspace-api.mts`) enforces:

- **RBAC** — roles `owner > admin > assessor > viewer`, checked by `requireOrgAccess` on every route; non-members receive `404` so other organizations' ids cannot be probed.
- **Row-level isolation** — every workspace-scoped table carries `org_id`; queries filter by the org resolved from the workspace row, never from the request body.
- **Segregation of duties** — creators cannot approve their own assessments, uploaders cannot approve their own evidence, and CAPs close only with verified evidence.
- **Audit logging** — every mutation and sensitive read (downloads, report views, audit exports) is written to `ws_audit_log` with actor, IP and user agent.
- **Rate limiting** — 100 req/min per IP (public endpoints), 1000 req/min per authenticated user.
- **CORS** — only `https://craftframework.becomechange.institute` is allowed cross-origin.
- **Uploads** — type allow-list, 10 MB limit, `nosniff` + attachment downloads.
- **Secrets** — `SENDGRID_API_KEY`, `GITHUB_TOKEN` and database credentials live only in Netlify environment variables.

## Security Best Practices

To help protect the project and its users:

- do not disclose vulnerabilities publicly before a fix is available
- avoid testing against production systems or user data
- use minimal, non-destructive testing conditions
- report suspected issues as soon as they are identified

## Contact

For security-related questions or advisories, contact:

craftframework@becomechange.institute
