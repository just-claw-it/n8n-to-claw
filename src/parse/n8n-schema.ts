// ---------------------------------------------------------------------------
// Raw n8n workflow JSON shape.
// These are the types we receive *before* normalization.
// We treat all fields as optional/unknown where n8n has been inconsistent
// across versions, and validate explicitly in the parser.
// ---------------------------------------------------------------------------

export interface N8nWorkflowJson {
  id?: string | number;
  name?: string;
  nodes?: N8nRawNode[];
  connections?: N8nConnections;
  settings?: Record<string, unknown>;
  active?: boolean;
  tags?: Array<{ id: string; name: string }>;
  meta?: Record<string, unknown>;
  pinData?: Record<string, unknown>;
  staticData?: unknown;
  versionId?: string;
}

export interface N8nRawNode {
  id?: string;
  name?: string;
  type?: string;
  typeVersion?: number;
  position?: [number, number];
  parameters?: Record<string, unknown>;
  credentials?: Record<string, N8nCredential>;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
  executeOnce?: boolean;
  alwaysOutputData?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  continueOnFail?: boolean;
  onError?: string;
  webhookId?: string;
}

export interface N8nCredential {
  id?: string;
  name?: string;
}

/**
 * n8n connection map structure.
 *
 * Shape: { [sourceNodeName]: { main: ConnectionOutputs } }
 * ConnectionOutputs is an array-of-arrays:
 *   outer index = output port index on source
 *   inner items = each downstream connection from that port
 */
export type N8nConnections = Record<
  string,
  {
    main?: N8nConnectionTarget[][];
    [key: string]: N8nConnectionTarget[][] | undefined;
  }
>;

export interface N8nConnectionTarget {
  node: string;   // target node name
  type: string;   // usually "main"; LangChain nodes use ai_tool, ai_languageModel, etc.
  index: number;  // target input index
}
