# n8n-to-claw — Agent Context

This file is read automatically by OpenClaw, Claude Code, and other AI coding
agents to understand the codebase before working on it.

## What this project does

`n8n-to-claw` is a CLI tool that converts [n8n](https://n8n.io) workflow JSON
into [OpenClaw](https://openclaw.ai)-compatible skills (`SKILL.md` + `skill.ts`).
An LLM handles the transpilation step via any OpenAI-compatible API.

## Architecture — three-stage pipeline

```
Input (file or n8n API)
       │
       ▼
┌─────────────┐     ┌────────────────────┐     ┌───────────┐
│  Parse      │────▶│  Transpile (LLM)   │────▶│  Package  │
│  IR types   │     │  prompt → validate │     │  write    │
└─────────────┘     └────────────────────┘     └───────────┘
```

## Source layout

```
src/
  ir/
    types.ts               — WorkflowIR and all IR interfaces (the central contract)
  parse/
    n8n-schema.ts          — Raw n8n JSON types (pre-normalization)
    categorize.ts          — Node type → category mapping table + trigger detection
    categorize.test.ts
    parser.ts              — parse() function, ParseError
    parser.test.ts
  adapters/
    file.ts                — Load raw JSON from a local file
    api.ts                 — Load raw JSON from the n8n REST API
  transpile/
    llm.ts                 — OpenAI-compatible LLM client, timeout, 429/5xx retry
    prompt.ts              — Build LLM messages from WorkflowIR (includes few-shot example)
    output-parser.ts       — Extract SKILL.md + skill.ts from LLM response
    validate.ts            — Run tsc --noEmit on generated skill.ts
    transpile.ts           — Orchestrate: LLM → validate → retry → draft fallback
    *.test.ts
  utils/
    logger.ts              — DEBUG=n8n-to-claw structured logging; zero cost when disabled
  package/
    package.ts             — Write output to ~/.openclaw/workspace/skills/<name>/
    package.test.ts
  cli/
    index.ts               — CLI entry point (parseArgs, orchestrates all stages)
  integration.test.ts      — Full pipeline tests with mocked LLM

skills/
  n8n-to-claw/
    SKILL.md               — OpenClaw skill so agents can invoke this tool

test-fixtures/
  notify-slack-on-postgres.json   — Schedule → Postgres → IF → Slack
  github-webhook-to-slack.json    — Webhook → IF branch → Slack API
  ai-support-chatbot.json         — LangChain AI agent with ai_* connections
  daily-hacker-news-digest.json   — Cron → HTTP → Code → Email
  sync-crm-with-custom-nodes.json — Community node, stickyNote, Google Sheets

examples/
  github-pr-review-notifier/      — Sample SKILL.md + skill.ts output
  daily-hacker-news-digest/       — Sample SKILL.md + skill.ts output

Dockerfile                 — Multi-stage image: CLI dist + web UI (Express + static Vite build)
docker-compose.yml         — `docker compose up` for local / cloud deployment
.dockerignore

web/
  server.ts                — Express API server (parse + transpile routes)
  vite.config.ts           — Vite config for React SPA
  src/
    App.tsx                — Main app with step-by-step flow
    components/            — UploadPanel, ParseResults, TranspileForm, OutputViewer
    hooks/useWorkflow.ts   — State management hook
    api.ts                 — Fetch wrappers for /api/parse, /api/transpile

docs/
  architecture.md          — Deeper architecture notes
  ir-schema.md             — WorkflowIR field-by-field reference

scripts/
  setup.sh                 — Install deps and verify environment
```

## Key invariants — do not break these

1. **`src/ir/types.ts` is the single source of truth** for the IR shape. Parse
   produces it, transpile consumes it. Changes here ripple everywhere.

2. **`src/parse/n8n-schema.ts` and `src/ir/types.ts` must stay separate.**
   The schema types represent untrusted raw input; IR types represent normalized,
   validated data. Never merge them.

3. **The `raw` field on `WorkflowIR` and `IRNode` is a reference, not a clone.**
   Do not mutate it in the transpile or package stages.

4. **The parse stage never calls the LLM.** The transpile stage never reads
   from disk. The package stage never calls the LLM or the n8n API. Stages
   are strictly separated.

5. **`tsc --noEmit` must pass at all times.** The tsconfig uses
   `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true` —
   both are intentional and must not be relaxed.

## How to add a new n8n node type

1. Open `src/parse/categorize.ts`
2. Add the node type string to `EXACT_MAP` with the appropriate `NodeCategory`
3. Add a test in `src/parse/categorize.test.ts` asserting the correct category
4. Run `npm test` — all tests must pass

## How to run

```bash
npm install
npm test
npm run typecheck     # tsc --noEmit
npm run build         # compile to dist/
node dist/cli/index.js --help
```

## Environment variables

Required when running the CLI (not needed for tests):

```
LLM_BASE_URL   — OpenAI-compatible API base URL
LLM_API_KEY    — API key
LLM_MODEL      — Model name (gpt-4o or claude-sonnet tier minimum)
LLM_TIMEOUT_MS — optional; local Ollama often needs 600000+
LLM_MAX_TOKENS — optional; default 4096; lower can speed local models (truncation risk)
```

`n8n-to-claw check-llm` — tiny probe using the same `LLM_*` as `convert`; use to verify env and network (Ollama on same host, CI cannot reach laptop localhost, etc.).

## Test strategy

- Unit tests are co-located with source files (`*.test.ts`)
- Integration tests are in `src/integration.test.ts` and use `vi.spyOn` to mock
  `callLLM` — no real LLM calls happen in CI
- Golden transpile snapshots: `test-fixtures/golden-transpile/<stem>/SKILL.md` +
  `skill.ts` per workflow; `src/evals/golden-transpile.test.ts` asserts mocked
  transpile output matches those files
- `src/transpile/validate.test.ts` invokes real `tsc` against known-good and
  known-bad TypeScript snippets
- GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, tests, CLI build,
  smoke `--help`, then `web/` install, typecheck, and Vite build; on Node 20 only,
  `docker build` verifies the `Dockerfile`

## Local improvement backlog (optional)

Maintainers may keep a private, **gitignored** checklist at the repo root:
`roadmap.local.md` (pattern `*.local.md` in `.gitignore`). Use it for a personal
backlog of high-impact enhancements; it is not shipped with the repository.

## Commit conventions

```
feat: add support for <node type>
fix: <what was broken and why>
test: add tests for <area>
docs: update <file>
refactor: <what changed and why>
```
