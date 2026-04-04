// ---------------------------------------------------------------------------
// Deterministic transpile (no LLM):
//  A) Linear: allowed trigger → optional noOp/set pass-through → HTTP GET chain
//  B) Conditional: same prefix ending in IF; true branch = HTTP GET chain;
//     false branch = single noOp sink. IF condition: string equals on
//     `={{ $json.field[.nested]* }}` vs a static rightValue (no expression).
// Returns null when the workflow does not match — caller falls back to the LLM.
// ---------------------------------------------------------------------------

import type { IRNode, IREdge, WorkflowIR } from "../../ir/types.js";
import type { TranspileOutput } from "../output-parser.js";

const DETERMINISTIC_TRIGGER_TYPES = new Set([
  "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.cronTrigger",
  "n8n-nodes-base.cron",
  "n8n-nodes-base.intervalTrigger",
  "n8n-nodes-base.interval",
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.start",
  "n8n-nodes-base.webhook",
]);

const PASS_THROUGH_TYPES = new Set([
  "n8n-nodes-base.noOp",
  "n8n-nodes-base.set",
]);

const IF_NODE_TYPE = "n8n-nodes-base.if";

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

function describeWebhookTrigger(trigger: IRNode): string {
  const path = trigger.parameters["path"];
  const method = String(trigger.parameters["httpMethod"] ?? "GET").toUpperCase();
  const p = typeof path === "string" && path.trim().length > 0 ? path.trim() : "…";
  return `Inbound webhook: ${method} \`/${p}\` (n8n receives HTTP here; this skill runs the same downstream HTTP GET steps when executed locally).`;
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
    case "n8n-nodes-base.webhook":
      return describeWebhookTrigger(trigger);
    default:
      return "Scheduled or manual run.";
  }
}

function buildActiveMainEdges(ir: WorkflowIR): {
  active: IRNode[];
  mainEdges: IREdge[];
  idSet: Set<string>;
} {
  const active = ir.nodes.filter((n) => !n.disabled);
  const idSet = new Set(active.map((n) => n.id));
  const mainEdges = ir.edges.filter(
    (e) => e.connectionType === "main" && idSet.has(e.sourceNodeId) && idSet.has(e.targetNodeId)
  );
  return { active, mainEdges, idSet };
}

/** Single main output per source (index 0 only). */
function buildLinearOutMap(mainEdges: IREdge[]): Map<string, string> | null {
  const out = new Map<string, string>();
  for (const e of mainEdges) {
    if (e.sourceOutputIndex !== 0) return null;
    if (out.has(e.sourceNodeId)) return null;
    out.set(e.sourceNodeId, e.targetNodeId);
  }
  return out;
}

function collectLinearChainFromHead(
  headId: string,
  out: Map<string, string>,
  active: IRNode[]
): IRNode[] | null {
  const byId = new Map(active.map((n) => [n.id, n]));
  const ordered: IRNode[] = [];
  const visited = new Set<string>();
  let cur: IRNode | undefined = byId.get(headId);
  while (cur !== undefined) {
    if (visited.has(cur.id)) return null;
    visited.add(cur.id);
    ordered.push(cur);
    const nextId = out.get(cur.id);
    cur = nextId !== undefined ? byId.get(nextId) : undefined;
  }
  if (ordered.length !== active.length) return null;
  return ordered;
}

function extractHttpGetUrls(httpNodes: IRNode[]): string[] | null {
  const urls: string[] = [];
  for (const n of httpNodes) {
    const method = String(n.parameters["method"] ?? "GET").toUpperCase();
    if (method !== "GET") return null;
    const url = n.parameters["url"];
    if (typeof url !== "string" || url.trim().length === 0) return null;
    urls.push(url.trim());
  }
  return urls;
}

function isPassThrough(n: IRNode): boolean {
  return PASS_THROUGH_TYPES.has(n.type);
}

function validateLinearTriggerAndHttpSegment(ordered: IRNode[]): {
  trigger: IRNode;
  urls: string[];
} | null {
  if (ordered.length < 2) return null;
  const first = ordered[0]!;
  if (!DETERMINISTIC_TRIGGER_TYPES.has(first.type)) return null;

  let i = 1;
  while (i < ordered.length && isPassThrough(ordered[i]!)) {
    i += 1;
  }
  if (i >= ordered.length) return null;

  const httpNodes = ordered.slice(i);
  if (httpNodes.length === 0) return null;
  if (!httpNodes.every((n) => n.type === "n8n-nodes-base.httpRequest")) return null;

  if (ordered.some((n) => n.hasExpressions || n.credentials.length > 0)) return null;

  const urls = extractHttpGetUrls(httpNodes);
  if (urls === null) return null;

  return { trigger: first, urls };
}

function buildSimpleFetchSkillTs(ir: WorkflowIR, urls: readonly string[]): string {
  const urlArrayLiteral = urls.map((u) => `  ${JSON.stringify(u)}`).join(",\n");
  return `#!/usr/bin/env node
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
}

function buildSkillMdLinear(ir: WorkflowIR, trigger: IRNode, urls: readonly string[]): string {
  const skillName = skillMdFrontmatterName(ir);
  const desc = `Fetch data from ${urls.length} static HTTP endpoint(s) (${ir.displayName}).`;
  const triggerLine = describeTriggerLine(trigger);
  const urlList = urls.map((u) => `- \`${u}\``).join("\n");

  return `---
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
}

/**
 * Linear main branch: trigger → optional noOp/set → one or more HTTP GET (static URL, no credentials, no expressions).
 */
export function tryDeterministicLinearHttpGet(ir: WorkflowIR): TranspileOutput | null {
  const { active, mainEdges } = buildActiveMainEdges(ir);
  if (active.length < 2) return null;

  const out = buildLinearOutMap(mainEdges);
  if (out === null) return null;

  const inDegree = new Map<string, number>();
  for (const n of active) inDegree.set(n.id, 0);
  for (const e of mainEdges) {
    if (e.sourceOutputIndex !== 0) continue;
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) ?? 0) + 1);
  }

  const heads = active.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  if (heads.length !== 1) return null;

  const ordered = collectLinearChainFromHead(heads[0]!.id, out, active);
  if (ordered === null) return null;

  const parsed = validateLinearTriggerAndHttpSegment(ordered);
  if (parsed === null) return null;

  const skillMd = buildSkillMdLinear(ir, parsed.trigger, parsed.urls);
  const skillTs = buildSimpleFetchSkillTs(ir, parsed.urls);
  return { skillMd, skillTs };
}

// ---------------------------------------------------------------------------
// Conditional: trigger → (pass-through)* → IF → true: HTTP chain; false: noOp sink
// ---------------------------------------------------------------------------

function mainOutBySource(mainEdges: IREdge[]): Map<string, Map<number, string>> {
  const m = new Map<string, Map<number, string>>();
  for (const e of mainEdges) {
    let inner = m.get(e.sourceNodeId);
    if (inner === undefined) {
      inner = new Map<number, string>();
      m.set(e.sourceNodeId, inner);
    }
    inner.set(e.sourceOutputIndex, e.targetNodeId);
  }
  return m;
}

function stringHasN8nExpression(s: string): boolean {
  return s.includes("={{") || s.startsWith("=");
}

/** Parse IF string-equals on `={{ $json.a.b }}` vs static right value. */
function extractIfJsonFieldEquals(ifNode: IRNode): {
  path: string[];
  right: string;
  caseSensitive: boolean;
} | null {
  if (ifNode.type !== IF_NODE_TYPE) return null;
  if (ifNode.credentials.length > 0) return null;

  const root = ifNode.parameters["conditions"];
  if (root === null || typeof root !== "object" || Array.isArray(root)) return null;
  const condRoot = root as Record<string, unknown>;
  if (condRoot["combinator"] !== "and") return null;
  const conds = condRoot["conditions"];
  if (!Array.isArray(conds) || conds.length !== 1) return null;
  const row = conds[0];
  if (row === null || typeof row !== "object" || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  const op = r["operator"];
  if (op === null || typeof op !== "object" || Array.isArray(op)) return null;
  const opObj = op as Record<string, unknown>;
  if (opObj["type"] !== "string" || opObj["operation"] !== "equals") return null;

  const leftValue = r["leftValue"];
  const rightValue = r["rightValue"];
  if (typeof leftValue !== "string" || typeof rightValue !== "string") return null;
  if (stringHasN8nExpression(rightValue)) return null;

  const m = leftValue.match(/^\s*=\{\{\s*\$json((?:\.\w+)+)\s*\}\}\s*$/);
  if (!m?.[1]) return null;
  const path = m[1]
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (path.length === 0) return null;

  const opts = condRoot["options"];
  let caseSensitive = true;
  if (opts !== null && typeof opts === "object" && !Array.isArray(opts)) {
    const cs = (opts as Record<string, unknown>)["caseSensitive"];
    if (cs === false) caseSensitive = false;
  }

  return { path, right: rightValue, caseSensitive };
}

function getSingleOut0(outMap: Map<string, Map<number, string>>, sourceId: string): string | null {
  const inner = outMap.get(sourceId);
  if (inner === undefined) return null;
  if (inner.size !== 1 || !inner.has(0)) return null;
  return inner.get(0) ?? null;
}

function linearizeHttpBranchFrom(
  startId: string,
  byId: Map<string, IRNode>,
  outMap: Map<string, Map<number, string>>
): { nodes: IRNode[]; urls: string[] } | null {
  const nodes: IRNode[] = [];
  let cur: string | undefined = startId;

  while (cur !== undefined) {
    const n = byId.get(cur);
    if (n === undefined) return null;
    if (isPassThrough(n)) {
      if (n.hasExpressions || n.credentials.length > 0) return null;
      nodes.push(n);
      cur = getSingleOut0(outMap, cur) ?? undefined;
      continue;
    }
    break;
  }

  if (cur === undefined) return null;

  while (cur !== undefined) {
    const n = byId.get(cur);
    if (n === undefined) return null;
    if (n.type !== "n8n-nodes-base.httpRequest") return null;
    if (n.hasExpressions || n.credentials.length > 0) return null;
    nodes.push(n);
    const next = getSingleOut0(outMap, cur);
    if (next === null) {
      const urls = extractHttpGetUrls(nodes.filter((x) => x.type === "n8n-nodes-base.httpRequest"));
      if (urls === null) return null;
      return { nodes, urls };
    }
    cur = next;
  }
  return null;
}

function isNoOpSink(nodeId: string, byId: Map<string, IRNode>, outMap: Map<string, Map<number, string>>): boolean {
  const n = byId.get(nodeId);
  if (n === undefined || n.type !== "n8n-nodes-base.noOp") return false;
  if (n.hasExpressions || n.credentials.length > 0) return false;
  const outs = outMap.get(nodeId);
  return outs === undefined || outs.size === 0;
}

function prefixNodesFromHead(
  headId: string,
  ifId: string,
  byId: Map<string, IRNode>,
  outMap: Map<string, Map<number, string>>
): IRNode[] | null {
  const prefix: IRNode[] = [];
  let cur: string | undefined = headId;
  while (cur !== undefined && cur !== ifId) {
    const n = byId.get(cur);
    if (n === undefined) return null;
    prefix.push(n);
    cur = getSingleOut0(outMap, cur) ?? undefined;
  }
  if (cur !== ifId) return null;
  return prefix;
}

function coversAllActive(
  active: IRNode[],
  seen: Set<string>
): boolean {
  return active.every((n) => seen.has(n.id));
}

/**
 * trigger → (pass-through)* → IF (string equals on $json field) → true: HTTP GETs; false: noOp sink.
 */
export function tryDeterministicConditionalHttpGet(ir: WorkflowIR): TranspileOutput | null {
  const { active, mainEdges } = buildActiveMainEdges(ir);
  if (active.length < 4) return null;

  const outMap = mainOutBySource(mainEdges);
  const byId = new Map(active.map((n) => [n.id, n]));

  const inDegree = new Map<string, number>();
  for (const n of active) inDegree.set(n.id, 0);
  for (const e of mainEdges) {
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) ?? 0) + 1);
  }

  const heads = active.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  if (heads.length !== 1) return null;
  const head = heads[0]!;

  const ifNodes = active.filter((n) => n.type === IF_NODE_TYPE);
  if (ifNodes.length !== 1) return null;
  const ifNode = ifNodes[0]!;
  const ifOut = outMap.get(ifNode.id);
  if (ifOut === undefined || ifOut.size !== 2 || !ifOut.has(0) || !ifOut.has(1)) return null;

  const cond = extractIfJsonFieldEquals(ifNode);
  if (cond === null) return null;

  const prefix = prefixNodesFromHead(head.id, ifNode.id, byId, outMap);
  if (prefix === null || prefix.length < 1) return null;

  const trigger = prefix[0]!;
  if (!DETERMINISTIC_TRIGGER_TYPES.has(trigger.type)) return null;
  for (let i = 1; i < prefix.length; i++) {
    const p = prefix[i]!;
    if (!isPassThrough(p)) return null;
    if (p.hasExpressions || p.credentials.length > 0) return null;
  }

  const tTrue = ifOut.get(0)!;
  const tFalse = ifOut.get(1)!;

  const a = linearizeHttpBranchFrom(tTrue, byId, outMap);
  const b = linearizeHttpBranchFrom(tFalse, byId, outMap);
  const noopA = isNoOpSink(tTrue, byId, outMap);
  const noopB = isNoOpSink(tFalse, byId, outMap);

  let httpBranch: { nodes: IRNode[]; urls: string[] } | null = null;
  let noopTargetId: string | null = null;

  if (a !== null && noopB) {
    httpBranch = a;
    noopTargetId = tFalse;
  } else if (b !== null && noopA) {
    httpBranch = b;
    noopTargetId = tTrue;
  } else {
    return null;
  }

  const seen = new Set<string>();
  for (const n of prefix) seen.add(n.id);
  seen.add(ifNode.id);
  for (const n of httpBranch.nodes) seen.add(n.id);
  seen.add(noopTargetId!);
  if (!coversAllActive(active, seen)) return null;

  const urls = httpBranch.urls;
  const pathJson = JSON.stringify(cond.path);
  const rightJson = JSON.stringify(cond.right);
  const caseLit = cond.caseSensitive ? "true" : "false";

  const skillName = skillMdFrontmatterName(ir);
  const desc = `Conditional HTTP GET (${ir.displayName}) when JSON field matches (deterministic template).`;
  const triggerLine = describeTriggerLine(trigger);
  const urlList = urls.map((u) => `- \`${u}\``).join("\n");
  const fieldPathHuman = cond.path.join(".");

  const skillMd = `---
name: ${skillName}
description: ${yamlScalar(desc)}
metadata: {"openclaw":{"requires":{"bins":["node"]},"emoji":"⚡"}}
---

# ${ir.displayName}

${triggerLine}

When stdin contains JSON, the skill checks \`$json.${fieldPathHuman}\` (string) equals \`${cond.right.replace(/`/g, "'")}\`${cond.caseSensitive ? "" : " (case-insensitive)"} before running the HTTP GET sequence — mirroring the n8n IF node's true branch. If the condition fails, it exits 0 after logging (false branch → noOp).

## URLs (true branch)

${urlList}

## Usage

Pipe webhook JSON (or any JSON payload) on stdin:

\`\`\`bash
echo '{"kind":"ping"}' | node {baseDir}/skill.ts
\`\`\`

## Output

Prints each response body to stdout when the condition matches. Exits with code 1 if JSON is invalid or any request fails.
`;

  const urlArrayLiteral = urls.map((u) => `  ${JSON.stringify(u)}`).join(",\n");
  const skillTs = `#!/usr/bin/env node
// ${ir.displayName} — deterministic IF + HTTP template (n8n-to-claw)

import { readFileSync } from "node:fs";

const JSON_PATH = ${pathJson} as readonly string[];
const EXPECTED = ${rightJson};
const CASE_SENSITIVE = ${caseLit};
const URLS = [
${urlArrayLiteral},
] as const;

function getField(obj: unknown, keys: readonly string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

void (async (): Promise<void> => {
  let payload: unknown = {};
  try {
    const raw = readFileSync(0, "utf-8").trim();
    if (raw.length > 0) payload = JSON.parse(raw) as unknown;
  } catch {
    console.error("Invalid JSON on stdin.");
    process.exit(1);
  }

  let left = String(getField(payload, JSON_PATH) ?? "");
  let right = EXPECTED;
  if (!CASE_SENSITIVE) {
    left = left.toLowerCase();
    right = right.toLowerCase();
  }
  if (left !== right) {
    console.log("Condition not met; skipping HTTP steps (n8n false branch).");
    return;
  }

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

/** Try all deterministic HTTP templates (linear, then IF branch). */
export function tryDeterministicHttpTemplate(ir: WorkflowIR): TranspileOutput | null {
  return tryDeterministicLinearHttpGet(ir) ?? tryDeterministicConditionalHttpGet(ir);
}
