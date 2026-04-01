import type {
  WorkflowIR,
  IRNode,
  IREdge,
  IRWarning,
  CredentialRef,
} from "../ir/types.js";
import type { N8nWorkflowJson, N8nRawNode } from "./n8n-schema.js";
import { categorizeNode, deriveTriggerType } from "./categorize.js";
import { assessIRQuality } from "./quality.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert any string to kebab-case for use as a directory name. */
function toKebabCase(s: string): string {
  const result = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return result || "unnamed-workflow";
}

/** Check whether any value in a parameter object contains an n8n expression. */
function containsExpression(value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes("={{") || value.startsWith("=");
  }
  if (Array.isArray(value)) {
    return value.some(containsExpression);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(containsExpression);
  }
  return false;
}

/** Deduplicate credential refs by type+name pair. */
function dedupeCredentials(refs: CredentialRef[]): CredentialRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = `${r.type}:${r.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Node parsing
// ---------------------------------------------------------------------------

function parseNode(raw: N8nRawNode, warnings: IRWarning[]): IRNode {
  const id = raw.id ?? raw.name ?? "unknown";
  const name = raw.name ?? "Unnamed Node";
  const type = raw.type ?? "unknown";
  const parameters = raw.parameters ?? {};
  const category = categorizeNode(type);
  const hasExpressions = containsExpression(parameters);
  const disabled = raw.disabled === true;

  // Collect credential refs from this node
  const credentials: CredentialRef[] = Object.entries(raw.credentials ?? {}).map(
    ([credType, credValue]) => ({
      type: credType,
      name: credValue?.name ?? credType,
    })
  );

  // Emit warnings
  if (category === "unknown") {
    warnings.push({
      nodeId: id,
      nodeName: name,
      nodeType: type,
      reason: "unknown_node_type",
      detail: `Node type "${type}" has no category mapping. A stub will be emitted.`,
    });
  }

  if (credentials.length > 0) {
    warnings.push({
      nodeId: id,
      nodeName: name,
      nodeType: type,
      reason: "credential_reference",
      detail: `Node uses credentials: ${credentials.map((c) => `${c.type}(${c.name})`).join(", ")}. Add to credentials.example.env.`,
    });
  }

  if (category === "webhook") {
    warnings.push({
      nodeId: id,
      nodeName: name,
      nodeType: type,
      reason: "webhook_trigger",
      detail: `Webhook trigger detected. Mapped to OpenClaw native webhook support.`,
    });
  }

  if (category === "database") {
    warnings.push({
      nodeId: id,
      nodeName: name,
      nodeType: type,
      reason: "database_node",
      detail: `Database node detected. Transpiler will attempt bash CLI fallback (psql/sqlite3); a TODO stub will be emitted if not possible.`,
    });
  }

  if (hasExpressions) {
    warnings.push({
      nodeId: id,
      nodeName: name,
      nodeType: type,
      reason: "expression_present",
      detail: `Node parameters contain n8n expressions (={{...}}). These require runtime resolution and will be annotated in the generated skill.`,
    });
  }

  return {
    id,
    name,
    type,
    category,
    parameters,
    hasExpressions,
    disabled,
    credentials,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Edge parsing
//
// n8n stores connections keyed by SOURCE NODE NAME (not id).
// We resolve to ids using the name→id map built from the node list.
// ---------------------------------------------------------------------------

function parseEdges(
  raw: N8nWorkflowJson,
  nodeIdByName: Map<string, string>,
  warnings: IRWarning[]
): IREdge[] {
  const edges: IREdge[] = [];
  const connections = raw.connections ?? {};

  for (const [sourceName, outputMap] of Object.entries(connections)) {
    const sourceNodeId = nodeIdByName.get(sourceName);
    if (sourceNodeId === undefined) {
      warnings.push({
        nodeId: "unknown",
        nodeName: sourceName,
        nodeType: "unknown",
        reason: "dangling_edge",
        detail: `Connection references unknown source node "${sourceName}". Edge skipped.`,
      });
      continue;
    }

    for (const [connType, outputs] of Object.entries(outputMap)) {
      if (outputs === undefined) continue;
      outputs.forEach((outputTargets, outputIndex) => {
        for (const target of outputTargets ?? []) {
          const targetNodeId = nodeIdByName.get(
            typeof target.node === "string" ? target.node : String(target.node)
          );
          if (targetNodeId === undefined) {
            warnings.push({
              nodeId: "unknown",
              nodeName: String(target.node),
              nodeType: "unknown",
              reason: "dangling_edge",
              detail: `Connection references unknown target node "${target.node}". Edge skipped.`,
            });
            continue;
          }

          edges.push({
            sourceNodeId,
            targetNodeId,
            sourceOutputIndex: outputIndex,
            targetInputIndex: target.index ?? 0,
            connectionType: connType,
          });
        }
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Public parse function
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Parse a raw n8n workflow JSON object into a WorkflowIR.
 *
 * @throws {ParseError} if the input is structurally invalid.
 */
export function parse(raw: unknown): WorkflowIR {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ParseError("Workflow input must be a JSON object.");
  }

  const workflow = raw as N8nWorkflowJson;

  if (!workflow.name) {
    throw new ParseError('Workflow JSON is missing required field "name".');
  }

  if (!Array.isArray(workflow.nodes)) {
    throw new ParseError('Workflow JSON is missing required field "nodes" (must be an array).');
  }

  const warnings: IRWarning[] = [];

  // Parse nodes (stickyNote nodes are annotation-only — filter them out)
  const nodes: IRNode[] = workflow.nodes
    .filter((n) => n.type !== "n8n-nodes-base.stickyNote")
    .map((n) => parseNode(n, warnings));

  // Build name → id lookup for edge resolution.
  // If duplicate names exist, warn and keep the first occurrence.
  const nodeIdByName = new Map<string, string>();
  for (const n of nodes) {
    if (nodeIdByName.has(n.name)) {
      warnings.push({
        nodeId: n.id,
        nodeName: n.name,
        nodeType: n.type,
        reason: "unsupported_parameter",
        detail: `Duplicate node name "${n.name}". Edges referencing this name will resolve to the first occurrence.`,
      });
      continue;
    }
    nodeIdByName.set(n.name, n.id);
  }

  // Parse edges
  const edges = parseEdges(workflow, nodeIdByName, warnings);

  // Derive trigger type from nodes
  const triggerType = deriveTriggerType(nodes);
  const quality = assessIRQuality(warnings, triggerType);

  // Collect all credential refs (deduplicated)
  const credentialRefs = dedupeCredentials(nodes.flatMap((n) => n.credentials));

  return {
    name: toKebabCase(workflow.name),
    displayName: workflow.name,
    triggerType,
    nodes,
    edges,
    credentialRefs,
    warnings,
    quality,
    raw,
  };
}
