---
name: n8n_to_claw
description: Convert an n8n workflow JSON into an OpenClaw-compatible skill (SKILL.md + skill.ts). Provide a local workflow file or n8n API credentials.
metadata: {"openclaw":{"requires":{"bins":["node","n8n-to-claw"],"env":["LLM_BASE_URL","LLM_API_KEY","LLM_MODEL"]},"emoji":"🔄","install":[{"id":"node","kind":"node","package":"n8n-to-claw","bins":["n8n-to-claw"],"label":"Install n8n-to-claw (npm)"}]}}
---

# n8n-to-claw

Converts [n8n](https://n8n.io) workflow JSON into OpenClaw-compatible skills.

## When to use

- The user has an n8n workflow they want to run as an OpenClaw skill
- The user provides a `.json` workflow export file, or n8n API credentials
- The user says anything like "convert my n8n workflow", "turn this automation into a skill", or "import from n8n"

## Requirements

The following environment variables must be set before invoking:

- `LLM_BASE_URL` — OpenAI-compatible API base URL
- `LLM_API_KEY` — API key
- `LLM_MODEL` — Model name (gpt-4o or claude-sonnet minimum)

## Usage

**From a local file:**
```bash
n8n-to-claw convert {workflow_file}
```

**From the n8n REST API:**
```bash
n8n-to-claw convert \
  --n8n-url {n8n_base_url} \
  --api-key {n8n_api_key} \
  --workflow-id {workflow_id}
```

**Custom output directory:**
```bash
n8n-to-claw convert {workflow_file} --output-dir {output_dir}
```

## Output

The skill is written to `~/.openclaw/workspace/skills/<workflow-name>/`:

- `SKILL.md` — OpenClaw skill descriptor (ready to use)
- `skill.ts` — TypeScript implementation (Node.js, no external deps)
- `credentials.example.env` — credential placeholders (if the workflow uses credentials)
- `warnings.json` — list of degraded or stubbed nodes

If TypeScript validation fails after two attempts, output goes to `draft/` instead.

## After conversion

1. Check `warnings.json` for any nodes that were stubbed or degraded
2. If a `credentials.example.env` was generated, copy it to `credentials.env` and fill in values
3. Start a new OpenClaw session so the new skill is picked up
4. Test the skill with `openclaw agent --message "run <skill-name>"`

## Notes

- Unknown n8n node types produce a `TODO` stub with the original node JSON — review these manually
- n8n expressions (`={{ ... }}`) are preserved as strings and annotated in the generated code
- The tool validates generated TypeScript with `tsc --noEmit` before writing to disk
