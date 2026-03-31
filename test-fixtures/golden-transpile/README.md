# Golden transpile snapshots

Each subfolder is named after a `test-fixtures/<stem>.json` workflow. It contains
the **expected** `SKILL.md` and `skill.ts` when the LLM response is mocked to
emit exactly those two fenced blocks.

Tests live in `src/evals/golden-transpile.test.ts`. The full pipeline integration
test for `notify-slack-on-postgres` reads the same golden files via
`loadGoldenTranspileFiles("notify-slack-on-postgres")`.

Edit these files when you intentionally change expected mock output, then run
`npm test`.
