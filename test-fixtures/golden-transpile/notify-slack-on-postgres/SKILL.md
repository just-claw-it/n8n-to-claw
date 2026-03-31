---
name: notify_slack_on_postgres
description: Poll Postgres every 5 minutes and post new event rows to Slack.
metadata: {"openclaw":{"requires":{"bins":["node","psql"],"env":["POSTGRES_CONNECTION_STRING","SLACK_WEBHOOK_URL"]},"emoji":"🐘"}}
---

# Notify Slack on New Postgres Row

Polls the `events` table in Postgres every 5 minutes and sends a formatted
Slack message for each new row via a webhook.

## Usage
```bash
node {baseDir}/skill.ts
```

## Environment variables
- `POSTGRES_CONNECTION_STRING` — connection string for the production Postgres instance
- `SLACK_WEBHOOK_URL` — Slack incoming webhook URL

## Examples
```bash
POSTGRES_CONNECTION_STRING="postgres://user:pass@host/db" \
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." \
node {baseDir}/skill.ts
```
