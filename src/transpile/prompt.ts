import type { WorkflowIR, IRNode } from "../ir/types.js";
import type { LLMMessage } from "./llm.js";
import { logger } from "../utils/logger.js";

export const PROMPT_VERSION = "v1";

// ---------------------------------------------------------------------------
// System prompt — constant across all transpilations.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert TypeScript developer converting n8n automation workflows into OpenClaw skills.

OpenClaw is a personal AI assistant platform. A "skill" teaches the OpenClaw agent how to use a tool. Each skill is a folder containing:
  1. SKILL.md — frontmatter + markdown instructions for the agent
  2. skill.ts — a standalone Node.js/TypeScript CLI script the agent invokes via exec/bash

## SKILL.md format (exact)

\`\`\`markdown
---
name: skill_name_in_snake_case
description: One-line description of what the skill does.
metadata: {"openclaw":{"requires":{"bins":["node"],"env":["MY_API_KEY"]},"emoji":"🔧"}}
---

# Skill Name

Instructions for the agent explaining what the skill does and how to invoke it.
Use {baseDir}/skill.ts as the path to the implementation.

## Usage
\`\`\`bash
node {baseDir}/skill.ts <args>
\`\`\`

## Examples
...
\`\`\`
\`\`\`

Rules for SKILL.md:
- name: snake_case, derived from the workflow name. Must be unique and descriptive.
- description: single line, no newlines, max 120 chars
- metadata: MUST be a single-line JSON object (the parser does not support multiline)
- requires.bins: always include "node"; add "psql", "sqlite3", "curl", "jq" only if used
- requires.env: list EVERY environment variable the skill reads at runtime
- emoji: pick one that fits the workflow's purpose
- {baseDir} is the template variable for the skill folder path — use it in all paths

## skill.ts format

A self-contained Node.js CLI script with NO external npm dependencies (only Node.js built-ins: fs, path, http, https, child_process, crypto, util, url, process, etc.).
- Shebang line: #!/usr/bin/env node
- Brief comment explaining what the script does
- Reads args from process.argv (use positional args or simple --key=value parsing)
- Reads credentials from process.env (names must match SKILL.md requires.env)
- Outputs results to stdout (plain text or JSON)
- Exits with code 0 on success, non-zero on error with a descriptive message to stderr
- Validate all required env vars at startup and exit 1 with a clear message if missing
- No try/catch around the whole script — let individual operations fail clearly

## Category-specific generation rules

**trigger / webhook**: The skill.ts should accept input via stdin or CLI args, not poll.
  For webhooks: expose the skill as a command the agent calls when a webhook fires,
  reading the payload from stdin as JSON.

**http**: Use Node.js built-in https/http modules. Never use fetch polyfills or axios.
  Pattern: use a promisified https.request wrapper. Include timeout handling (10s default).

**database**: Prefer the psql/sqlite3/mongosh CLI via child_process.execSync.
  Build the connection string from env vars. Always add a TODO if the query is dynamic.

**transform**: Implement the data transformation logic directly in TypeScript.
  For n8n Code nodes, translate the JavaScript logic faithfully.

**flow (IF/Switch)**: The skill should evaluate the condition and exit with code 0 (true branch)
  or code 2 (false/default branch). Document branch meanings in comments.

**flow (executeWorkflow)**: Emit a stub that logs the sub-workflow name and its input data,
  then add a TODO comment explaining that sub-workflow invocation requires manual wiring.

**AI/LangChain**: Use the OpenAI-compatible API via https module directly.
  Read LLM_BASE_URL, LLM_API_KEY, LLM_MODEL from env. Never hardcode model names.

## High-risk review markers

When a node is tagged with CODE_EXECUTION_NODE or AI_LANGCHAIN_NODE:
- Add an explicit "Manual review required" note in SKILL.md.
- In skill.ts, add TODO comments documenting assumptions and security-sensitive behavior.
- Never silently infer privileged actions, shell commands, or external tool invocation.

**email**: Use Node.js net/tls to send SMTP, or curl via child_process as a fallback.
  Always include a TODO if OAuth is required.

**file**: Use Node.js fs/promises. Handle binary files with Buffer.

## Expressions (={{...}})

n8n expressions marked HAS_EXPRESSIONS must be handled at runtime. In skill.ts,
replace expressions with CLI arguments or env var reads, and document the mapping
in SKILL.md. Never silently drop an expression — always surface it.

## Unknown nodes

For UNKNOWN_NODE type nodes, emit a clearly marked stub:
\`\`\`typescript
// TODO: Unsupported node type "<nodeType>" — manual implementation required
// Original node parameters:
// <JSON of parameters>
console.error("Node '<name>' (<nodeType>) is not implemented. See the TODO above.");
process.exit(1);
\`\`\`

## Output format

Respond with EXACTLY two fenced code blocks, in this order, with no other text:

\`\`\`skill-md
<contents of SKILL.md>
\`\`\`

\`\`\`typescript
<contents of skill.ts>
\`\`\`

---

## EXAMPLE — correct output for a simple HTTP request workflow

Workflow: "Fetch GitHub User Info"
Trigger: manual, 1 node: HTTP Request to https://api.github.com/users/{username}

\`\`\`skill-md
---
name: fetch_github_user_info
description: Fetch public GitHub user profile information by username.
metadata: {"openclaw":{"requires":{"bins":["node"],"env":[]},"emoji":"🐙"}}
---

# Fetch GitHub User Info

Retrieves public profile information for a GitHub user.

## Usage
\`\`\`bash
node {baseDir}/skill.ts <username>
\`\`\`

## Examples
\`\`\`bash
node {baseDir}/skill.ts torvalds
\`\`\`
\`\`\`

\`\`\`typescript
#!/usr/bin/env node
// fetch_github_user_info — fetches a GitHub user's public profile
import { request } from "node:https";
import { env } from "node:process";

const username = process.argv[2];
if (!username) {
  console.error("Usage: node skill.ts <username>");
  process.exit(1);
}

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers: { "User-Agent": "n8n-to-claw" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString()));
    });
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error("Request timed out")); });
    req.on("error", reject);
    req.end();
  });
}

const body = await get(\`https://api.github.com/users/\${encodeURIComponent(username)}\`);
const user = JSON.parse(body) as Record<string, unknown>;
if (user["message"]) {
  console.error("GitHub API error:", user["message"]);
  process.exit(1);
}
console.log(JSON.stringify(user, null, 2));
\`\`\``;

// ---------------------------------------------------------------------------
// IR serializer
// ---------------------------------------------------------------------------

function serializeNode(node: IRNode): string {
  const credStr =
    node.credentials.length > 0
      ? `credentials: [${node.credentials.map((c) => `${c.type}(${c.name})`).join(", ")}]`
      : "";

  const paramStr =
    Object.keys(node.parameters).length > 0
      ? `parameters: ${JSON.stringify(node.parameters, null, 0)}`
      : "";

  const flags: string[] = [];
  if (node.hasExpressions) flags.push("HAS_EXPRESSIONS");
  if (node.disabled) flags.push("DISABLED");
  if (node.category === "unknown") flags.push("UNKNOWN_NODE");
  if (node.category === "database") flags.push("DATABASE_NODE");
  if (node.category === "flow" && node.type === "n8n-nodes-base.executeWorkflow") {
    flags.push("SUB_WORKFLOW");
  }
  if (node.type === "n8n-nodes-base.code") {
    flags.push("CODE_EXECUTION_NODE");
  }
  if (node.type.startsWith("@n8n/n8n-nodes-langchain")) {
    flags.push("AI_LANGCHAIN_NODE");
  }

  const parts = [
    `[${node.category.toUpperCase()}] "${node.name}" (${node.type})`,
    credStr,
    paramStr,
    flags.length > 0 ? `flags: ${flags.join(", ")}` : "",
  ].filter(Boolean);

  return parts.join("\n  ");
}

function serializeEdges(ir: WorkflowIR): string {
  if (ir.edges.length === 0) return "(no edges)";
  const nodeById = new Map(ir.nodes.map((n) => [n.id, n.name]));
  return ir.edges
    .map((e) => {
      const src = nodeById.get(e.sourceNodeId) ?? e.sourceNodeId;
      const tgt = nodeById.get(e.targetNodeId) ?? e.targetNodeId;
      const connLabel = e.connectionType !== "main" ? ` (${e.connectionType})` : "";
      return `${src}[out:${e.sourceOutputIndex}] → ${tgt}[in:${e.targetInputIndex}]${connLabel}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Public: build messages for the initial transpile request.
// ---------------------------------------------------------------------------

export function buildTranspilePrompt(ir: WorkflowIR): LLMMessage[] {
  const nodeList = ir.nodes.map((n) => serializeNode(n)).join("\n\n");
  const edgeList = serializeEdges(ir);

  const credBlock =
    ir.credentialRefs.length > 0
      ? `Credentials required (generate descriptive SCREAMING_SNAKE_CASE env var names):\n${ir.credentialRefs
          .map((c) => `  - ${c.type}: "${c.name}"`)
          .join("\n")}`
      : "No credentials required.";

  const warnBlock =
    ir.warnings.length > 0
      ? `Parser warnings (handle each gracefully per the rules above):\n${ir.warnings
          .map((w) => `  - [${w.reason}] ${w.nodeName} (${w.nodeType}): ${w.detail}`)
          .join("\n")}`
      : "";

  // Count IF/Switch nodes so we can alert the LLM
  const branchNodes = ir.nodes.filter(
    (n) => n.type === "n8n-nodes-base.if" || n.type === "n8n-nodes-base.switch"
  );
  const branchNote =
    branchNodes.length > 0
      ? `Branch note: this workflow has ${branchNodes.length} IF/Switch node(s). ` +
        `For each, document which exit code corresponds to which output branch in SKILL.md.`
      : "";

  const userMessage = `Convert the following n8n workflow to an OpenClaw skill.

Workflow: "${ir.displayName}"
Trigger type: ${ir.triggerType}

## Nodes (${ir.nodes.length})

${nodeList}

## Execution flow

${edgeList}

${credBlock}
${branchNote ? `\n${branchNote}` : ""}
${warnBlock}`.trim();

  const versionedSystemPrompt = `Prompt-Version: ${PROMPT_VERSION}\n\n${SYSTEM_PROMPT}`;
  const messages: LLMMessage[] = [
    { role: "system", content: versionedSystemPrompt },
    { role: "user", content: userMessage },
  ];

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4);
  if (estimatedTokens > 30_000) {
    logger.warn(
      "prompt",
      `Prompt is ~${estimatedTokens} tokens — large workflows may exceed model context limits`,
      { nodes: ir.nodes.length, chars: totalChars }
    );
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Public: build retry prompt with compiler error injected.
// ---------------------------------------------------------------------------

export function buildRetryPrompt(
  originalMessages: LLMMessage[],
  previousOutput: string,
  tscError: string
): LLMMessage[] {
  return [
    ...originalMessages,
    { role: "assistant", content: previousOutput },
    {
      role: "user",
      content: `The TypeScript compiler rejected the generated skill.ts with this error:

\`\`\`
${tscError}
\`\`\`

Fix skill.ts so it compiles cleanly with strict mode enabled. Common causes:
- Using optional chaining on non-optional values
- Missing type annotations on catch clauses (use \`catch (err: unknown)\`)
- Array index access without \`?.\` guard (noUncheckedIndexedAccess is on)
- Optional properties must be typed as \`T | undefined\`, not just \`T\`

Re-emit both code blocks in full. SKILL.md is likely fine but must still be included.`,
    },
  ];
}
