# Security policy

## Supported versions

Security updates are applied to the latest release on the default branch (`main`). Use the newest tagged version when deploying.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately so we can assess and fix the issue before disclosure:

1. Open a **private security advisory** via [GitHub Security advisories](https://github.com/just-claw-it/n8n-to-claw/security/advisories/new) for this repository, **or**
2. Email the maintainer if that channel is listed on their GitHub profile.

Include:

- Description of the issue and impact
- Steps to reproduce (if possible)
- Affected versions or commit range (if known)

We aim to acknowledge reports within a few business days and coordinate a fix and release timeline with you.

## Development tooling

`npm audit` may report issues in **dev-only** dependencies (for example Vitest / Vite / esbuild used for tests). Those do not ship in the published npm package (`files` in `package.json` is limited to `dist/`, `README.md`, and `LICENSE`). Upgrades are tracked as part of regular maintenance.

## Scope

This project is a CLI and optional local web server. Typical concerns:

- **Secrets:** Never commit `.env` files or real API keys. The tool is designed so LLM keys are environment variables or user-supplied in the web UI and are not logged intentionally.
- **Supply chain:** Install from npm or a verified git clone; verify `package-lock.json` integrity when using `npm ci`.

## Disclosure

After a fix is released, we may publish a security advisory with credit to reporters who wish to be named.
