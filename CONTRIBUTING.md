# Contributing to n8n-to-claw

Thank you for helping improve this project.

## Quick start

```bash
git clone https://github.com/just-claw-it/n8n-to-claw.git
cd n8n-to-claw
npm install
npm test
npm run typecheck
npm run build
```

Or use `./scripts/setup.sh` to install, typecheck, test, and build in one go.

The **CLI** lives at the repo root. The optional **web UI** is in `web/` (see [README — Web UI](README.md#web-ui)).

## What to work on

- **New n8n node type mappings** — the most common contribution. See below.
- **Bug reports** with a minimal n8n workflow JSON that reproduces the issue (credentials scrubbed).
- **Prompt improvements** — if a node type consistently produces broken `skill.ts`, open a PR with changes in `src/transpile/prompt.ts` and a before/after example.
- **Test fixtures** — real-world workflow JSONs (no secrets) in `test-fixtures/`.
- **Web UI** — changes in `web/`; run `cd web && npm install && npm run dev` (bash/cmd). On **Windows PowerShell 5.x**, use semicolons: `cd web; npm install; npm run dev`.

## Adding a new node type

1. Find the exact n8n type string (e.g. `"n8n-nodes-base.airtable"`).
2. Add it to `EXACT_MAP` in `src/parse/categorize.ts` with the right `NodeCategory`, or rely on the `*Trigger` / LangChain prefix fallbacks when appropriate.
3. Add a test in `src/parse/categorize.test.ts`.
4. Run `npm test` — **all tests must pass**.
5. Update the [Node coverage](README.md#node-coverage) section in `README.md` if you are adding a new category or notable integration.

## Changing the IR schema

Changes to `src/ir/types.ts` are high-impact. Before proposing one:

- Check whether the change requires updates to the parser, transpiler, packager, and all tests.
- Prefer adding optional fields over changing existing ones.
- Never remove a field without a deprecation period.

## Improving the LLM prompt

`src/transpile/prompt.ts` contains both the system prompt and the IR serializer. Changes here affect output quality but are hard to unit-test automatically. When submitting prompt changes, include at least one before/after example of generated `SKILL.md` + `skill.ts`.

## Code style

- TypeScript strict mode — `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are both on. CI runs `tsc --noEmit`.
- **Root package:** runtime uses Node.js built-ins plus `typescript` (for `tsc` validation). No other runtime dependencies by design.
- **Web package (`web/`):** React, Express, Vite — keep dependencies minimal.
- Tests use Vitest. Co-locate tests with source (`*.test.ts`).

## Pull request checklist

- [ ] `npm test` passes (full suite)
- [ ] `npm run typecheck` passes
- [ ] If you changed the web UI: `cd web && npm run typecheck && npm run build` (PowerShell 5: `cd web; npm run typecheck; npm run build`)
- [ ] If you added/changed `test-fixtures/` or `src/parse/categorize.ts`: run `npm run coverage:nodes` and commit `docs/node-coverage.md` (CI enforces parity)
- [ ] If you changed Docker files: `docker build -t n8n-to-claw:local .` (from repo root)
- [ ] New node types or behavior documented in `README.md` / `CHANGELOG.md` as appropriate
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]` when the change is user-visible

## Reporting bugs

Open an [issue](https://github.com/just-claw-it/n8n-to-claw/issues) with:

1. The n8n workflow JSON (credentials scrubbed — replace values with `"<REDACTED>"`).
2. The LLM model you used (if relevant).
3. The error or wrong output you received.

For security-sensitive reports, see [SECURITY.md](SECURITY.md).
