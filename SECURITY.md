# Security Policy

## Supported Versions

Security fixes are applied to the latest release on `main`. Older versions on
PyPI do not receive backports.

| Version        | Supported          |
| -------------- | ------------------ |
| latest `main`  | :white_check_mark: |
| older releases | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.**

Use GitHub's private vulnerability reporting:
<https://github.com/HKUDS/Multi-Model-RAG/security/advisories/new>

When reporting, include:

1. A description of the vulnerability and its potential impact.
2. Steps to reproduce (minimal code or payload is ideal).
3. Affected version(s) / commit SHA.
4. Any suggested remediation.

We will acknowledge receipt within **5 business days** and aim to provide a
status update within **14 days**. Coordinated disclosure timelines will be
agreed with the reporter.

## Scope

In scope:

- `multi_model_rag` Python package (parser execution, query pipeline, dashboard API).
- `dashboard/` (Next.js app) — authentication bypass, XSS, SSRF, unsafe rendering.
- Supply-chain issues in pinned dependencies.

Out of scope:

- Vulnerabilities in third-party LLM providers (report to them directly).
- Misconfiguration in a user's own deployment (e.g. leaving default
  `AUTH_ACCOUNTS='admin:admin123'` from `env.example` in production). The
  server should and will refuse to start with obvious defaults — but it is
  still the operator's responsibility.
- Denial of service via legitimate-but-expensive queries.

## Hardening Checklist for Operators

- [ ] Replace every sample credential in `.env` before exposing the dashboard.
- [ ] Set a strong `TOKEN_SECRET` and rotate it on compromise.
- [ ] Set `CORS_ORIGINS` to an explicit allow-list; never `*` in production.
- [ ] Terminate TLS in front of the backend (nginx, Caddy, ALB, …).
- [ ] Keep `pip-audit` / `npm audit` clean via Dependabot PRs.
