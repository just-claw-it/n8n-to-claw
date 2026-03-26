---
name: daily_hacker_news_digest
description: Fetch the top 10 Hacker News stories and send a daily email digest.
metadata: {"openclaw":{"requires":{"bins":["node"],"env":["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS","DIGEST_TO_EMAIL"]},"emoji":"📰"}}
---

# Daily Hacker News Digest

Fetches the top 10 stories from the Hacker News API, formats them into a
readable digest, and sends an email via SMTP.

## Usage

```bash
node {baseDir}/skill.ts
```

## Environment variables

- `SMTP_HOST` — SMTP server hostname
- `SMTP_PORT` — SMTP port (e.g. `587`)
- `SMTP_USER` — SMTP username
- `SMTP_PASS` — SMTP password
- `DIGEST_TO_EMAIL` — recipient email address

## Examples

```bash
SMTP_HOST=smtp.gmail.com SMTP_PORT=587 \
SMTP_USER=bot@example.com SMTP_PASS=app-password \
DIGEST_TO_EMAIL=team@example.com \
node {baseDir}/skill.ts
```

## Output

Prints the digest to stdout and sends the email. Exits 0 on success.
