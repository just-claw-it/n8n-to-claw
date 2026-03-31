# Prompt Eval Harness

This folder stores baseline reports for prompt-quality evaluation across the
workflows in `test-fixtures/`.

## What is measured

Each report captures:

- prompt version
- per-fixture workflow size (nodes, edges)
- warning and risk signals (unknown nodes, expressions, credentials)
- prompt size (`promptChars`, estimated tokens)

The goal is to make prompt changes measurable and reviewable instead of
depending on ad-hoc checks.

## Commands

- Print current report:
  - `npm run eval:prompt`
- Update baseline for the current prompt version:
  - `npm run eval:prompt:update`

By convention, the baseline file name includes the prompt version, for example:

- `prompt-v1-baseline.json`
