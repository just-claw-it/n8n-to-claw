# Architecture

## Pipeline

```
Input
  ├── Local file   → src/adapters/file.ts  ─┐
  └── n8n REST API → src/adapters/api.ts   ─┤
                                             ▼
                                    src/parse/parser.ts
                                    (WorkflowIR)
                                             │
                                             ▼
                                    src/transpile/transpile.ts
                                    ├── prompt.ts   (IR → LLM messages)
                                    ├── llm.ts      (API call)
                                    ├── output-parser.ts (extract blocks)
                                    └── validate.ts (tsc --noEmit)
                                             │
                                      pass / retry / draft
                                             │
                                             ▼
                                    src/package/package.ts
                                    ~/.openclaw/workspace/skills/<name>/
                                    ├── SKILL.md
                                    ├── skill.ts
                                    ├── credentials.example.env
                                    └── warnings.json
```

## WorkflowIR — the central contract

`src/ir/types.ts` defines `WorkflowIR`. Everything downstream depends on this
shape. The parse stage produces it; the transpile and package stages consume it.
The `raw` field on both `WorkflowIR` and `IRNode` preserves the original JSON
verbatim — it is used only for stub generation and debugging, never mutated.

## Node categorization

`src/parse/categorize.ts` maps n8n type strings to `NodeCategory` values via
an exact lookup table and a prefix-based fallback. The category determines:

- Which warning reason is emitted
- How the LLM prompt flags the node (`UNKNOWN_NODE`, `DATABASE_NODE`, etc.)
- Which graceful-degradation strategy the LLM is prompted to apply

## LLM validation loop

```
Attempt 1
  callLLM(buildTranspilePrompt(ir))
    │
    ├── parseLLMOutput()  ── fails? → TranspileError (no retry)
    │
    └── validateTypeScript(skill.ts)
          │
          ├── valid → write to live dir, status = "success"
          │
          └── invalid
                │
                Attempt 2
                callLLM(buildRetryPrompt(..., tscError))
                  │
                  ├── valid → write to live dir, status = "success"
                  │
                  └── invalid → write to draft/, status = "draft"
```

The retry prompt includes the full compiler error from attempt 1. This is the
single most effective intervention for fixing generated TypeScript — the LLM
can see exactly what went wrong.

## tsc validation

`src/transpile/validate.ts` writes the generated `skill.ts` to a temp directory
alongside a minimal `tsconfig.json` and runs `tsc --noEmit`. The tsconfig
references our own `node_modules/@types/node` so the generated code can use
Node.js built-ins without the user needing a global `@types/node`.

`typescript` is a runtime dependency (not devDependency) because `tsc` is
invoked at runtime. Making it a `peerDependency` would silently break validation
for users without a global TypeScript install.

## Output directory layout

```
~/.openclaw/workspace/skills/
  <workflow-name>/            ← ir.name (kebab-case of displayName)
    SKILL.md                  ← always written for live status
    skill.ts                  ← always written for live status
    credentials.example.env   ← only if credentialRefs.length > 0, live only
    warnings.json             ← always written (both live and draft)
    draft/                    ← only exists when status === "draft"
      SKILL.md
      skill.ts
```

## Graceful degradation table

| Situation | Warning reason | Transpiler instruction |
|---|---|---|
| No category match | `unknown_node_type` | Emit a TODO stub with original node JSON |
| Credential reference | `credential_reference` | Generate `credentials.example.env` placeholder |
| Webhook trigger | `webhook_trigger` | Map to OpenClaw native webhook |
| Database node | `database_node` | Attempt bash CLI fallback (psql/sqlite3) |
| n8n expression | `expression_present` | Annotate as requiring runtime resolution |
| Unknown edge target | `unsupported_parameter` | Skip edge, warn |
