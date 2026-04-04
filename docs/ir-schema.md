# WorkflowIR Schema Reference

Full field-by-field reference for the intermediate representation defined in
`src/ir/types.ts`. This is the contract between the parse and transpile stages.

## WorkflowIR (top level)

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Kebab-case workflow name — used as the output directory name |
| `displayName` | `string` | Original workflow name as defined in n8n |
| `triggerType` | `TriggerType` | How the workflow is initiated |
| `nodes` | `IRNode[]` | Normalized nodes |
| `edges` | `IREdge[]` | Normalized connections |
| `credentialRefs` | `CredentialRef[]` | Deduplicated credential references across all nodes |
| `warnings` | `IRWarning[]` | All parse-time degradation warnings |
| `quality` | `IRQuality` | Parse-time readiness/confidence score and summary |
| `raw` | `unknown` | Original workflow JSON — never mutated |

## TriggerType

`"webhook" | "schedule" | "manual" | "event" | "unknown"`

Derived from the trigger node type. Drives the OpenClaw skill metadata.

## IRNode

| Field | Type | Description |
|---|---|---|
| `id` | `string` | n8n internal node UUID |
| `name` | `string` | Human-readable name from the workflow editor |
| `type` | `string` | Full n8n type string (e.g. `"n8n-nodes-base.httpRequest"`) |
| `category` | `NodeCategory` | Normalized category for transpiler strategy selection |
| `parameters` | `Record<string, unknown>` | Resolved node parameters |
| `hasExpressions` | `boolean` | True if any parameter contains an n8n `={{...}}` expression |
| `disabled` | `boolean` | Whether the node was disabled in the n8n editor |
| `credentials` | `CredentialRef[]` | Credentials used by this node |
| `raw` | `unknown` | Original node JSON — never mutated |

## NodeCategory

| Value | Description |
|---|---|
| `"trigger"` | Workflow entry point |
| `"webhook"` | Inbound HTTP trigger (maps to OpenClaw native webhook) |
| `"http"` | Outbound HTTP calls |
| `"database"` | SQL/NoSQL nodes — bash CLI fallback or TODO stub |
| `"transform"` | Data reshaping (Set, Merge, Code, etc.) |
| `"flow"` | Control flow (IF, Switch, Wait, etc.) |
| `"email"` | Send/receive email |
| `"file"` | Read/write files |
| `"unknown"` | No mapping found — stub emitted |

## IREdge

| Field | Type | Description |
|---|---|---|
| `sourceNodeId` | `string` | Source node UUID |
| `targetNodeId` | `string` | Target node UUID |
| `sourceOutputIndex` | `number` | Output port index (0 for most nodes; IF/Switch have multiple) |
| `targetInputIndex` | `number` | Input port index (almost always 0) |
| `connectionType` | `string` | Connection type — `"main"` for standard edges; LangChain uses `"ai_tool"`, `"ai_languageModel"`, etc. |

## CredentialRef

| Field | Type | Description |
|---|---|---|
| `type` | `string` | n8n credential type (e.g. `"postgresApi"`) |
| `name` | `string` | User-defined credential name in n8n |

## IRWarning

| Field | Type | Description |
|---|---|---|
| `nodeId` | `string` | Node UUID that triggered the warning |
| `nodeName` | `string` | Human-readable node name |
| `nodeType` | `string` | n8n type string |
| `reason` | `IRWarningReason` | Structured reason code |
| `detail` | `string` | Human-readable detail for `warnings.json` and stdout |

## IRWarningReason

| Value | When emitted |
|---|---|
| `"unknown_node_type"` | No category mapping found |
| `"credential_reference"` | Node uses credentials |
| `"webhook_trigger"` | Webhook trigger detected |
| `"database_node"` | Database node detected |
| `"expression_present"` | n8n expression found in parameters |
| `"unsupported_parameter"` | Parameter shape not understood by parser |
| `"dangling_edge"` | Connection references a node not in the node list |
| `"transpile_validation"` | Transpile-phase validation issue (tsc failure/skip) |
| `"deterministic_transpile"` | Output from non-LLM deterministic HTTP template (linear or IF + GET chain) |

## IRQuality

| Field | Type | Description |
|---|---|---|
| `score` | `number` | 0..100 readiness score derived from warning signals |
| `level` | `"high" \| "medium" \| "low"` | Coarse confidence label for UI/CLI |
| `highRiskWarningCount` | `number` | Count of high-risk warnings (unknown node, dangling edge, etc.) |
| `summary` | `string` | Human-readable review guidance |
