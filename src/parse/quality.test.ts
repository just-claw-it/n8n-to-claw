import { describe, it, expect } from "vitest";
import { assessIRQuality } from "./quality.js";
import type { IRWarning } from "../ir/types.js";

const baseWarn = (reason: IRWarning["reason"]): IRWarning => ({
  nodeId: "n1",
  nodeName: "X",
  nodeType: "t",
  reason,
  detail: "d",
});

describe("assessIRQuality()", () => {
  it("scores high with no warnings and a known trigger", () => {
    const q = assessIRQuality([], "manual");
    expect(q.level).toBe("high");
    expect(q.score).toBe(100);
    expect(q.highRiskWarningCount).toBe(0);
  });

  it("downgrades when trigger is unknown", () => {
    const q = assessIRQuality([], "unknown");
    // +3 for zero warnings, -6 for unknown trigger
    expect(q.score).toBe(97);
    expect(q.level).toBe("high");
  });

  it("counts high-risk warnings", () => {
    const q = assessIRQuality(
      [baseWarn("unknown_node_type"), baseWarn("expression_present")],
      "schedule"
    );
    expect(q.highRiskWarningCount).toBe(1);
    expect(q.level).toBe("medium");
  });
});
