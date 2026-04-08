import type { IRWarning, TriggerType } from "../ir/types.js";

const PENALTIES: Record<string, number> = {
  unknown_node_type: 24,
  dangling_edge: 14,
  unsupported_parameter: 10,
  database_node: 8,
  code_execution_node: 10,
  ai_agent_node: 9,
  expression_present: 5,
  credential_reference: 3,
  webhook_trigger: 1,
};

const HIGH_RISK_REASONS = new Set([
  "unknown_node_type",
  "dangling_edge",
  "unsupported_parameter",
  "database_node",
  "code_execution_node",
  "ai_agent_node",
]);

export interface IRQualityAssessment {
  score: number;
  level: "high" | "medium" | "low";
  highRiskWarningCount: number;
  summary: string;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function qualityLevel(score: number): "high" | "medium" | "low" {
  if (score >= 85) return "high";
  if (score >= 65) return "medium";
  return "low";
}

export function assessIRQuality(
  warnings: IRWarning[],
  triggerType: TriggerType
): IRQualityAssessment {
  let score = 100;
  let highRiskWarningCount = 0;

  for (const w of warnings) {
    const penalty = PENALTIES[w.reason] ?? 2;
    score -= penalty;
    if (HIGH_RISK_REASONS.has(w.reason)) highRiskWarningCount += 1;
  }

  if (warnings.length === 0) score += 3;
  if (triggerType === "unknown") score -= 6;

  score = clampScore(score);
  const level = qualityLevel(score);

  let summary = "Likely production-ready after standard credential setup.";
  if (level === "medium") {
    summary = "Needs human review before production use.";
  }
  if (level === "low") {
    summary = "High review required: expect manual fixes in generated skill.";
  }

  return {
    score,
    level,
    highRiskWarningCount,
    summary,
  };
}

