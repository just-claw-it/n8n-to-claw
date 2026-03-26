---
name: github_pr_review_notifier
description: Post Slack notifications when a GitHub pull request review is submitted.
metadata: {"openclaw":{"requires":{"bins":["node"],"env":["SLACK_BOT_TOKEN"]},"emoji":"🔔"}}
---

# GitHub PR Review Notifier

Receives a GitHub webhook payload (pull_request_review event) via stdin,
checks if the action is `submitted`, and posts a formatted message to the
`#code-reviews` Slack channel.

## Usage

Pipe a GitHub webhook JSON payload into the script:

```bash
echo '$PAYLOAD' | node {baseDir}/skill.ts
```

## Environment variables

- `SLACK_BOT_TOKEN` — Slack Bot OAuth token with `chat:write` permission

## Examples

```bash
echo '{"action":"submitted","review":{"user":{"login":"alice"},"state":"approved"},"pull_request":{"number":42,"title":"Add caching","html_url":"https://github.com/org/repo/pull/42"}}' \
  | SLACK_BOT_TOKEN="xoxb-..." node {baseDir}/skill.ts
```

## Behavior

- Exit code **0**: review was "submitted" and the Slack message was posted.
- Exit code **2**: action was not "submitted" — event skipped, no Slack message.
- Exit code **1**: error (missing env var, Slack API failure, invalid JSON).
