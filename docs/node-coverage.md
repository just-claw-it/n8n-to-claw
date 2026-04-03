# Node coverage dashboard

This file is **generated** — run `npm run coverage:nodes` from the repo root after changing `test-fixtures/` or `src/parse/categorize.ts`.

## Summary

| Metric | Value |
|--------|------:|
| Explicit entries in `EXACT_MAP` | 479 |
| Workflow JSON files scanned | 6 |
| Unique node-type strings in fixtures | 19 |
| Total node instances (non-sticky) | 30 |

### Mapping source (per node *instance* in fixtures)

| Source | Instances |
|--------|----------:|
| `exact_map` | 29 |
| `prefix_fallback` | 0 |
| `suffix_trigger` | 0 |
| `unknown` | 1 |

### Category (instances in fixtures)

| Category | Instances |
|----------|----------:|
| `database` | 1 |
| `email` | 1 |
| `flow` | 3 |
| `http` | 7 |
| `transform` | 10 |
| `trigger` | 4 |
| `unknown` | 1 |
| `webhook` | 3 |

## Fixtures

| File | Nodes (non-sticky) | Unique types |
|------|-------------------:|-------------:|
| `ai-support-chatbot.json` | 6 | 6 |
| `daily-hacker-news-digest.json` | 6 | 5 |
| `github-webhook-to-slack.json` | 5 | 5 |
| `notify-slack-on-postgres.json` | 5 | 5 |
| `schedule-http-ping.json` | 3 | 2 |
| `sync-crm-with-custom-nodes.json` | 5 | 5 |

## Node types in fixtures

| Node type | Category | Mapping source | Occurrences | Fixtures |
|-----------|----------|----------------|------------:|----------|
| `@n8n/n8n-nodes-langchain.agent` | `transform` | `exact_map` | 1 | `ai-support-chatbot.json` |
| `@n8n/n8n-nodes-langchain.lmChatOpenAi` | `transform` | `exact_map` | 1 | `ai-support-chatbot.json` |
| `@n8n/n8n-nodes-langchain.memoryBufferWindow` | `transform` | `exact_map` | 1 | `ai-support-chatbot.json` |
| `@n8n/n8n-nodes-langchain.toolHttpRequest` | `transform` | `exact_map` | 1 | `ai-support-chatbot.json` |
| `n8n-nodes-base.code` | `transform` | `exact_map` | 1 | `daily-hacker-news-digest.json` |
| `n8n-nodes-base.emailSend` | `email` | `exact_map` | 1 | `daily-hacker-news-digest.json` |
| `n8n-nodes-base.googleSheets` | `http` | `exact_map` | 1 | `sync-crm-with-custom-nodes.json` |
| `n8n-nodes-base.httpRequest` | `http` | `exact_map` | 5 | `daily-hacker-news-digest.json`, `notify-slack-on-postgres.json`, `schedule-http-ping.json` |
| `n8n-nodes-base.if` | `flow` | `exact_map` | 2 | `github-webhook-to-slack.json`, `notify-slack-on-postgres.json` |
| `n8n-nodes-base.limit` | `transform` | `exact_map` | 1 | `daily-hacker-news-digest.json` |
| `n8n-nodes-base.noOp` | `flow` | `exact_map` | 1 | `github-webhook-to-slack.json` |
| `n8n-nodes-base.postgres` | `database` | `exact_map` | 1 | `notify-slack-on-postgres.json` |
| `n8n-nodes-base.removeDuplicates` | `transform` | `exact_map` | 1 | `sync-crm-with-custom-nodes.json` |
| `n8n-nodes-base.respondToWebhook` | `webhook` | `exact_map` | 1 | `ai-support-chatbot.json` |
| `n8n-nodes-base.scheduleTrigger` | `trigger` | `exact_map` | 4 | `daily-hacker-news-digest.json`, `notify-slack-on-postgres.json`, `schedule-http-ping.json`, `sync-crm-with-custom-nodes.json` |
| `n8n-nodes-base.set` | `transform` | `exact_map` | 3 | `github-webhook-to-slack.json`, `notify-slack-on-postgres.json`, `sync-crm-with-custom-nodes.json` |
| `n8n-nodes-base.slack` | `http` | `exact_map` | 1 | `github-webhook-to-slack.json` |
| `n8n-nodes-base.webhook` | `webhook` | `exact_map` | 2 | `ai-support-chatbot.json`, `github-webhook-to-slack.json` |
| `n8n-nodes-community.customCrm` | `unknown` | `unknown` | 1 | `sync-crm-with-custom-nodes.json` |

## Interpretation

- **`exact_map`** — full type string exists in `EXACT_MAP` (`src/parse/categorize.ts`).
- **`prefix_fallback`** — matched a `PREFIX_MAP` prefix (e.g. Postgres family, webhook, LangChain).
- **`suffix_trigger`** — short name ends with `Trigger` but the full type was not in `EXACT_MAP`.
- **`unknown`** — no rule matched; parse emits `unknown_node_type` and the LLM receives raw node JSON.
