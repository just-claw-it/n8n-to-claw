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
- Run deterministic transpile quality scenarios:
  - `npm run eval:quality`
- Update transpile quality baseline for the current prompt version:
  - `npm run eval:quality:update`

`eval:quality` evaluates synthetic two-attempt scenarios across every fixture and
reports:

- parse success vs parse errors
- retry usage frequency
- retry rescue count (first attempt failed validation, second succeeded)
- outcome distribution (`success`, `draft`, `validation_skip`, `parse_error`)

By convention, the baseline file name includes the prompt version, for example:

- `prompt-v1-baseline.json`
- `transpile-quality-v1-baseline.json`

Outcomes that depend on `tsc` differ when TypeScript is not available at
runtime. The snapshot test compares the full report to the baseline only when
`baseline.tscAvailable` matches the current run (CI and dev machines with
`typescript` installed typically match).
