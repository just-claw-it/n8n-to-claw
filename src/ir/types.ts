// ---------------------------------------------------------------------------
// Intermediate Representation (IR) — the contract between Parse and Transpile.
// Everything downstream of the parse stage operates on these types only.
// ---------------------------------------------------------------------------

/** Broad category used by the transpiler to choose a code generation strategy. */
export type NodeCategory =
  | "trigger"    // workflow entry point
  | "webhook"    // inbound HTTP trigger (distinct: maps to OpenClaw native webhook)
  | "http"       // outbound HTTP calls
  | "database"   // SQL / NoSQL nodes
  | "transform"  // data reshaping: Set, Merge, Split, Code, etc.
  | "flow"       // IF, Switch, Wait, Stop — control flow
  | "email"      // send/receive email
  | "file"       // read/write files
  | "unknown";   // anything not explicitly mapped

/** How the workflow is triggered. Drives OpenClaw skill metadata. */
export type TriggerType =
  | "webhook"    // HTTP inbound
  | "schedule"   // cron / interval
  | "manual"     // executed on demand
  | "event"      // external event bus (e.g. Kafka, RabbitMQ)
  | "unknown";

// ---------------------------------------------------------------------------
// Credential references — we never store values, only shape/name.
// ---------------------------------------------------------------------------

export interface CredentialRef {
  /** n8n credential type identifier, e.g. "postgresApi", "slackOAuth2Api" */
  type: string;
  /** User-defined credential name as configured in n8n */
  name: string;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface IRNode {
  /** n8n internal node id (UUID) */
  id: string;
  /** Human-readable name assigned in the workflow editor */
  name: string;
  /** Full n8n type string, e.g. "n8n-nodes-base.httpRequest" */
  type: string;
  /** Normalized category for transpiler strategy selection */
  category: NodeCategory;
  /** Resolved node parameters (expressions left as-is, marked below) */
  parameters: Record<string, unknown>;
  /**
   * True if any parameter value contains an n8n expression string
   * ("={{...}}"). The transpiler must handle these as dynamic at runtime.
   */
  hasExpressions: boolean;
  /** Whether the node was disabled in the n8n editor */
  disabled: boolean;
  /** Credential references used by this node (empty array if none) */
  credentials: CredentialRef[];
  /** Original node JSON — never mutated, used for stub generation on unknown nodes */
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export interface IREdge {
  sourceNodeId: string;
  targetNodeId: string;
  /**
   * n8n output index on the source node.
   * Most nodes have one output (0), but IF/Switch nodes have multiple.
   */
  sourceOutputIndex: number;
  /**
   * n8n input index on the target node.
   * Almost always 0, but preserved for completeness.
   */
  targetInputIndex: number;
  /**
   * n8n connection type. Usually "main"; LangChain nodes use
   * "ai_tool", "ai_languageModel", "ai_memory", etc.
   */
  connectionType: string;
}

// ---------------------------------------------------------------------------
// Warnings — emitted during parse, written to warnings.json at the end.
// ---------------------------------------------------------------------------

export interface IRWarning {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  /** One of the degradation reasons below */
  reason: IRWarningReason;
  /** Human-readable detail string for warnings.json and stdout summary */
  detail: string;
}

export type IRWarningReason =
  | "unknown_node_type"       // no category mapping found → stub emitted
  | "credential_reference"    // credentials detected → credentials.example.env needed
  | "webhook_trigger"         // webhook trigger → mapped to OpenClaw native webhook
  | "database_node"           // DB node → bash CLI fallback or TODO stub
  | "expression_present"      // n8n expression found → runtime resolution needed
  | "unsupported_parameter"   // parameter shape not understood by parser
  | "dangling_edge"           // connection references a node not in the node list
  | "transpile_validation"   // transpile-phase validation issue (tsc failure/skip)
  | "deterministic_transpile"; // output from non-LLM template (linear HTTP GET chain)

// ---------------------------------------------------------------------------
// Top-level IR — output of the parse stage, input to the transpile stage.
// ---------------------------------------------------------------------------

export interface WorkflowIR {
  /** Workflow name, normalized to kebab-case for use as directory name */
  name: string;
  /** Raw workflow name as defined in n8n */
  displayName: string;
  triggerType: TriggerType;
  nodes: IRNode[];
  edges: IREdge[];
  /**
   * Deduplicated credential refs across all nodes.
   * Used to generate credentials.example.env.
   */
  credentialRefs: CredentialRef[];
  warnings: IRWarning[];
  /** Original workflow JSON — preserved verbatim for debugging */
  raw: unknown;
}
