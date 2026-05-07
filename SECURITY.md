# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Send a report to **nelsijansilva@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

We will acknowledge your report within **48 hours** and aim to release a fix within **7 days** for critical issues.

## Scope

| Component | In scope |
|---|---|
| Server API (NestJS) | Yes |
| Client (React SPA) | Yes |
| Cloudflare Worker / pixel | Yes |
| Third-party dependencies | Inform the upstream project first |

## Secrets & Environment Variables

- Never commit `.env` files — they are git-ignored
- Rotate credentials immediately if accidentally exposed
- See `server/.env.example` for required variables
- Production secrets are managed via `.env.prod` on the deploy server (never in git)
