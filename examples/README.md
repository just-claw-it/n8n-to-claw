# Example Conversions

These examples show what `n8n-to-claw` produces when converting real n8n workflows. Each folder contains the complete output: `SKILL.md`, `skill.ts`, `credentials.example.env` (if applicable), and `warnings.json`.

> **Note:** These are representative samples, not live LLM output. Actual results will vary by model, but the structure and quality will be similar when using GPT-4o or Claude Sonnet tier models.

## Examples

### [github-pr-review-notifier](./github-pr-review-notifier/)

**Input:** [test-fixtures/github-webhook-to-slack.json](../test-fixtures/github-webhook-to-slack.json)

A webhook-triggered workflow that listens for GitHub pull request review events, filters for "submitted" reviews, and posts a formatted message to a Slack channel.

**Demonstrates:**
- Webhook trigger → stdin-based CLI input
- IF/branching → exit codes (0 = true branch, 2 = false branch)
- Slack API integration via Node.js `https` module
- Credential handling via environment variables

### [daily-hacker-news-digest](./daily-hacker-news-digest/)

**Input:** [test-fixtures/daily-hacker-news-digest.json](../test-fixtures/daily-hacker-news-digest.json)

A scheduled workflow that fetches the top 10 Hacker News stories every morning and sends an email digest.

**Demonstrates:**
- Schedule trigger → standalone CLI script (run via cron)
- Multiple HTTP requests (Hacker News API)
- n8n Code node → inline TypeScript logic
- Email node → TODO stub (SMTP requires external library)
- n8n expressions → resolved to runtime variables

## Input workflows

All input n8n workflows are in [`test-fixtures/`](../test-fixtures/):

| File | Trigger | Nodes | What it tests |
|------|---------|-------|---------------|
| `notify-slack-on-postgres.json` | Schedule | 5 | Database (Postgres), IF branching, HTTP |
| `github-webhook-to-slack.json` | Webhook | 5 | Webhook trigger, IF branching, Slack |
| `ai-support-chatbot.json` | Webhook | 6 | LangChain AI agent, `ai_*` connections, tools |
| `daily-hacker-news-digest.json` | Schedule | 6 | HTTP, Code, Limit, Email |
| `sync-crm-with-custom-nodes.json` | Schedule | 6* | Community/unknown node, Google Sheets, stickyNote |

\* The stickyNote node is filtered out during parsing (5 nodes in IR).

## Try it yourself

```bash
# Parse only — see what the tool detects (no LLM needed)
n8n-to-claw convert test-fixtures/github-webhook-to-slack.json --dry-run

# See the full IR and LLM prompt (no LLM needed)
n8n-to-claw convert test-fixtures/ai-support-chatbot.json --inspect

# Full conversion (requires LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)
n8n-to-claw convert test-fixtures/daily-hacker-news-digest.json
```
