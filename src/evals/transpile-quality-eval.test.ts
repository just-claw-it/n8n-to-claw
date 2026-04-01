import { describe, it, expect, beforeAll } from "vitest";
import { access, readFile } from "node:fs/promises";
import {
  buildTranspileQualityEvalReport,
  type TranspileQualityEvalReport,
} from "./transpile-quality-eval.js";

describe("transpile quality eval report", () => {
  let report: TranspileQualityEvalReport;

  beforeAll(async () => {
    report = await buildTranspileQualityEvalReport("test-fixtures");
  }, 300_000);

  it("returns a scenario report for each deterministic quality scenario", () => {
    expect(report.promptVersion).toBe("v1");
    expect(report.scenarioCount).toBe(report.scenarios.length);
    expect(report.scenarioCount).toBeGreaterThan(0);
  });

  it("has per-scenario totals that match fixture-level rows", () => {
    for (const scenario of report.scenarios) {
      expect(scenario.fixtureCount).toBe(scenario.fixtures.length);

      const recomputed = scenario.fixtures.reduce(
        (acc, row) => {
          acc.outcomes[row.outcome] += 1;
          if (row.parseSuccess) acc.parseSuccessCount += 1;
          if (row.usedRetry) acc.usedRetryCount += 1;
          if (row.retryRescued) acc.retryRescuedCount += 1;
          return acc;
        },
        {
          parseSuccessCount: 0,
          usedRetryCount: 0,
          retryRescuedCount: 0,
          outcomes: { success: 0, draft: 0, validation_skip: 0, parse_error: 0 },
        }
      );

      expect(scenario.parseSuccessCount).toBe(recomputed.parseSuccessCount);
      expect(scenario.usedRetryCount).toBe(recomputed.usedRetryCount);
      expect(scenario.retryRescuedCount).toBe(recomputed.retryRescuedCount);
      expect(scenario.outcomes).toEqual(recomputed.outcomes);
    }
  });

  it("unparseable_first_try scenario always records parse_error", () => {
    const unparseable = report.scenarios.find((s) => s.scenario === "unparseable_first_try");
    expect(unparseable).toBeDefined();
    expect(unparseable?.parseSuccessCount).toBe(0);
    expect(unparseable?.usedRetryCount).toBe(0);
    expect(unparseable?.outcomes.parse_error).toBe(unparseable?.fixtureCount);
  });

  it("matches baseline when committed and tsc availability matches", async () => {
    const baselinePath = "docs/prompt-evals/transpile-quality-v1-baseline.json";
    try {
      await access(baselinePath);
    } catch {
      return;
    }

    const baselineRaw = await readFile(baselinePath, "utf-8");
    const baseline = JSON.parse(baselineRaw) as { tscAvailable?: boolean };

    if (baseline.tscAvailable !== report.tscAvailable) {
      return;
    }

    expect(report).toEqual(baseline);
  });
});
