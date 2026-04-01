export interface NodeSummary {
  id: string;
  name: string;
  type: string;
  category: string;
  disabled: boolean;
  hasExpressions: boolean;
  credentialCount: number;
}

export interface EdgeSummary {
  sourceName: string;
  targetName: string;
  sourceOutputIndex: number;
  connectionType: string;
}

export interface WarningSummary {
  nodeName: string;
  nodeType: string;
  reason: string;
  detail: string;
}

export interface CredentialSummary {
  type: string;
  name: string;
}

export interface ParseQualitySummary {
  score: number;
  level: "high" | "medium" | "low";
  highRiskWarningCount: number;
  summary: string;
}

export interface ParseResponse {
  name: string;
  displayName: string;
  triggerType: string;
  quality: ParseQualitySummary;
  nodes: NodeSummary[];
  edges: EdgeSummary[];
  credentials: CredentialSummary[];
  warnings: WarningSummary[];
  prompt: string;
}

export interface TranspileResponse {
  status: "success" | "draft" | "validation_skip";
  skillMd: string;
  skillTs: string;
  warnings: WarningSummary[];
  validationError?: string;
}

export interface LLMConfigInput {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ApiError {
  error: string;
}
