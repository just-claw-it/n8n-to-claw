# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Deterministic templates (§1)** — `webhook` as a supported trigger alongside schedule/manual/cron; optional `noOp` / static `set` pass-through before HTTP GETs; **IF + HTTP** path when the IF node has a single string-equals rule on `={{ $json.field… }}` vs a static value, true branch = HTTP GET chain, false branch = single `noOp`. New fixtures: `webhook-http-ping.json`, `schedule-noop-http-ping.json`, `webhook-if-http-ping.json`. Entry point: `tryDeterministicHttpTemplate()` in `linear-http-chain.ts`.
- **`--debug-bundle` CLI flag (§9)** — writes `debug-bundle/` with IR snapshot, parse/transpile warnings, per-attempt prompts, raw LLM responses, validation results, and retry/path metadata for reproducible debugging.
- **`skill-meta.json` (packaging / §7)** — written next to `warnings.json` with generator version, `generatedAt`, workflow name/display/trigger, stable SHA-256 fingerprint of the source workflow JSON, transpile status, prompt version, and CLI source (file path or API URL + workflow id).

### Changed
- **CI** — after the CLI build, regenerates `docs/node-coverage.md` and fails if it differs from the committed file (keeps the node coverage dashboard in sync with `test-fixtures/` and `categorize.ts`)

## [0.3.0] — 2026-03-24

### Added
- **Docker** — `Dockerfile` + `docker-compose.yml` for the web UI; `GET /health` for load balancers; `tsx` as a production dependency of `web/`
- **479 explicit n8n node type mappings** — coverage aligned with n8n `nodes-base` v2.13 registry; suffix fallbacks for any `*Trigger` and `@n8n/n8n-nodes-langchain.*` nodes
- **Web UI** (`web/`) — React + Express BYOK interface for parse + transpile; documented in README
- **Example workflows** — additional `test-fixtures/` and `examples/` sample outputs
- **`repository` / `bugs` / `homepage`** fields in root `package.json` for npm and GitHub
- **`SECURITY.md`** — vulnerability reporting guidelines
- **CI** — typecheck, tests, CLI build, web UI build, and Docker image build on Node 20 and 22

### Changed
- **CONTRIBUTING.md** — updated for current test workflow and monorepo layout
- **`.gitignore`** — ignores `web/node_modules`, `web/dist`, coverage, logs
- **Version** — aligned `package.json` with changelog (this release)

## [0.2.0] — 2026-03-22

### Added
- **120+ node type mappings** — messaging (Slack, Discord, Telegram, Twilio,
  Teams), productivity (Notion, Google Sheets, Airtable, Jira, GitHub, Linear,
  Asana, ClickUp), CRM (HubSpot, Salesforce, Pipedrive, Zendesk), payments
  (Stripe, PayPal), storage (S3, Google Drive, OneDrive, Dropbox), email
  (SendGrid, Mailchimp), database (Supabase, QuestDB, TimescaleDB), transform
  (splitOut, removeDuplicates, editFields), and 23 named LangChain nodes
- **`--dry-run` flag** — parse + summarize IR with category breakdown, skip LLM
- **`--inspect` flag** — print full IR JSON, LLM prompt, and known node type
  list to stdout, then exit without making an LLM call
- **`--verbose` flag** — enables `DEBUG=n8n-to-claw` structured logging:
  prints LLM prompt, raw response, and timing to stderr
- **`DEBUG=n8n-to-claw` logger** — zero-cost structured debug output via
  `src/utils/logger.ts` with `time/timeEnd`, `prompt`, and `response` hooks
- **LLM timeout** — `AbortController`-based per-request timeout, configurable
  via `LLM_TIMEOUT_MS` env var (default: 60s)
- **LLM rate-limit retry** — 429 responses are retried with `Retry-After`
  header awareness and exponential backoff (max `LLM_MAX_RETRIES`, default 3)
- **LLM 5xx retry** — transient server errors are retried with backoff
- **Actionable error messages** — per-status-code hints (check `LLM_API_KEY`
  on 401, check `LLM_BASE_URL`/`LLM_MODEL` on 404, etc.)
- **Improved prompt** — full few-shot example (HTTP request → working skill),
  per-category generation rules, explicit IF/Switch multi-branch instructions,
  sub-workflow stub guidance, and better expression-handling instructions
- **`knownNodeTypes()`** export from categorize.ts — used by `--inspect` and
  available for tooling
- **`LLM_TIMEOUT_MS` and `LLM_MAX_RETRIES`** documented in `.env.example`
- 44 new tests (logger, LLM resilience, categorize coverage)

### Changed
- `loadLLMConfig()` now returns `timeoutMs` and `maxRetries` fields
- Retry prompt includes common TypeScript strict-mode error hints
- CLI progress output now includes timestamped lines with category breakdown
- `.env.example` updated with new optional env vars

## [0.1.0] — 2026-03-22

### Added
- Three-stage pipeline: Parse → Transpile (LLM) → Package
- `WorkflowIR` intermediate representation with typed nodes, edges, credential
  refs, trigger type, and `raw` preservation
- Node category mapping for 60+ n8n built-in node types across trigger, webhook,
  http, database, transform, flow, email, and file categories
- Prefix-based fallback mapping for community and LangChain nodes
- Two input adapters: local JSON file and n8n REST API
- LLM client supporting any OpenAI-compatible API via `LLM_BASE_URL`,
  `LLM_API_KEY`, `LLM_MODEL` environment variables
- SKILL.md + skill.ts generation with strict OpenClaw format enforcement
  (snake_case name, single-line metadata JSON, `{baseDir}` template variable)
- TypeScript validation via `tsc --noEmit` on generated `skill.ts` before
  writing to disk
- Retry logic: on validation failure, re-prompts the LLM with the compiler error
- Draft fallback: writes to `draft/` subdirectory if both attempts fail
- `credentials.example.env` generation for workflows with credential references
- `warnings.json` listing every degraded node (unknown type, expression present,
  database node, webhook trigger, credential reference)
- Graceful degradation stubs for unknown node types
- 58 tests (unit + integration with mocked LLM)
- `AGENTS.md` for OpenClaw and Claude Code agent context
- OpenClaw skill definition in `skills/n8n-to-claw/SKILL.md`
- GitHub Actions CI
