// ---------------------------------------------------------------------------
// Deterministic transpile: linear chain of schedule/manual/cron triggers followed
// by one or more HTTP Request nodes (GET only, static URL, no credentials).
// Returns null when the workflow does not match — caller falls back to the LLM.
// ---------------------------------------------------------------------------

import type { IRNode, WorkflowIR } from "../../ir/types.js";
import type { TranspileOutput } from "../output-parser.js";

const DETERMINISTIC_FIRST_NODE_TYPES = new Set([
  "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.cronTrigger",
  "n8n-nodes-base.cron",
  "n8n-nodes-base.intervalTrigger",
  "n8n-nodes-base.interval",
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.start",
]);

function skillMdFrontmatterName(ir: WorkflowIR): string {
  return ir.name.replace(/-/g, "_");
}

/** Escape a string for a single-line YAML scalar when needed. */
function yamlScalar(s: string): string {
  if (/[\n:#]/.test(s) || /^\s|\s$/.test(s) || s.includes(`"`)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function scheduleSummary(trigger: IRNode): string {
  const rule = trigger.parameters["rule"];
  if (rule && typeof rule === "object" && !Array.isArray(rule)) {
    const r = rule as Record<string, unknown>;
    const intervals = r["interval"];
    if (Array.isArray(intervals) && intervals.length > 0) {
      const first = intervals[0] as Record<string, unknown>;
      const expr = first["expression"];
      if (typeof expr === "string" && expr.length > 0) return `Cron: \`${expr}\``;
    }
  }
  return "Runs on the configured schedule.";
}

function describeTriggerLine(trigger: IRNode): string {
  switch (trigger.type) {
    case "n8n-nodes-base.scheduleTrigger":
    case "n8n-nodes-base.cronTrigger":
    case "n8n-nodes-base.cron":
    case "n8n-nodes-base.intervalTrigger":
    case "n8n-nodes-base.interval":
      return scheduleSummary(trigger);
    case "n8n-nodes-base.manualTrigger":
    case "n8n-nodes-base.start":
      return "Manual execution (n8n manual trigger / Start).";
    default:
      return "Scheduled or manual run.";
  }
}

/**
 * If the IR is a single main-branch path: [schedule|manual|…] → HTTP GET → … → HTTP GET,
 * with no expressions or credentials on any node, returns SKILL.md + skill.ts.
 * Otherwise returns null.
 */
export function tryDeterministicLinearHttpGet(ir: WorkflowIR): TranspileOutput | null {
  const active = ir.nodes.filter((n) => !n.disabled);
  if (active.length < 2) return null;

  const idSet = new Set(active.map((n) => n.id));
  const mainEdges = ir.edges.filter(
    (e) => e.connectionType === "main" && idSet.has(e.sourceNodeId) && idSet.has(e.targetNodeId)
  );

  const out = new Map<string, string>();
  const inDegree = new Map<string, number>();
  for (const n of active) inDegree.set(n.id, 0);

  for (const e of mainEdges) {
    if (out.has(e.sourceNodeId)) return null;
    out.set(e.sourceNodeId, e.targetNodeId);
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) ?? 0) + 1);
  }

  const heads = active.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  if (heads.length !== 1) return null;

  const ordered: IRNode[] = [];
  let cur: IRNode | undefined = heads[0];
  const visited = new Set<string>();

  while (cur !== undefined) {
    if (visited.has(cur.id)) return null;
    visited.add(cur.id);
    ordered.push(cur);
    const nextId = out.get(cur.id);
    cur = nextId !== undefined ? active.find((n) => n.id === nextId) : undefined;
  }

  if (ordered.length !== active.length) return null;

  const first = ordered[0]!;
  if (!DETERMINISTIC_FIRST_NODE_TYPES.has(first.type)) return null;

  const httpNodes = ordered.slice(1);
  if (httpNodes.length === 0) return null;
  if (!httpNodes.every((n) => n.type === "n8n-nodes-base.httpRequest")) return null;

  if (ordered.some((n) => n.hasExpressions || n.credentials.length > 0)) return null;

  const urls: string[] = [];
  for (const n of httpNodes) {
    const method = String(n.parameters["method"] ?? "GET").toUpperCase();
    if (method !== "GET") return null;
    const url = n.parameters["url"];
    if (typeof url !== "string" || url.trim().length === 0) return null;
    urls.push(url.trim());
  }

  const skillName = skillMdFrontmatterName(ir);
  const desc = `Fetch data from ${urls.length} static HTTP endpoint(s) (${ir.displayName}).`;
  const triggerLine = describeTriggerLine(first);

  const urlList = urls.map((u) => `- \`${u}\``).join("\n");

  const skillMd = `---
name: ${skillName}
description: ${yamlScalar(desc)}
metadata: {"openclaw":{"requires":{"bins":["node"]},"emoji":"⚡"}}
---

# ${ir.displayName}

${triggerLine}

This skill runs a fixed sequence of HTTP GET requests (deterministic template — no LLM).

## URLs

${urlList}

## Usage

\`\`\`bash
node {baseDir}/skill.ts
\`\`\`

## Output

Prints each response body to stdout in order. Exits with code 1 if any request fails.
`;

  const urlArrayLiteral = urls.map((u) => `  ${JSON.stringify(u)}`).join(",\n");
  const skillTs = `#!/usr/bin/env node
// ${ir.displayName} — deterministic template (n8n-to-claw)

const URLS = [
${urlArrayLiteral},
] as const;

void (async (): Promise<void> => {
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i]!;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.error(\`Step \${i + 1}: HTTP \${res.status} for \${url}\`);
      process.exit(1);
    }
    const body = await res.text();
    console.log(body);
  }
})();
`;

  return { skillMd, skillTs };
}
