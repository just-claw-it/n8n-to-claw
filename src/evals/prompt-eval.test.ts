import { describe, it, expect } from "vitest";
import { access, readFile } from "node:fs/promises";
import { buildPromptEvalReport } from "./prompt-eval.js";

describe("prompt eval report", () => {
  it("covers all fixtures and has stable top-level shape", async () => {
    const report = await buildPromptEvalReport("test-fixtures");
    expect(report.promptVersion).toBe("v1");
    expect(report.fixtureCount).toBe(report.fixtures.length);
    expect(report.fixtureCount).toBeGreaterThan(0);
    expect(report.totals.nodes).toBeGreaterThan(0);
    expect(report.totals.promptChars).toBeGreaterThan(0);

    const fixtureNames = report.fixtures.map((f) => f.fixture);
    expect(fixtureNames).toEqual([...fixtureNames].sort((a, b) => a.localeCompare(b)));
  });

  it("reports internally consistent totals and fixture metrics", async () => {
    const report = await buildPromptEvalReport("test-fixtures");

    const recomputed = report.fixtures.reduce(
      (acc, item) => {
        expect(item.workflowName.length).toBeGreaterThan(0);
        expect(item.nodeCount).toBeGreaterThan(0);
        expect(item.edgeCount).toBeGreaterThanOrEqual(0);
        expect(item.warningCount).toBeGreaterThanOrEqual(0);
        expect(item.unknownNodeCount).toBeGreaterThanOrEqual(0);
        expect(item.expressionNodeCount).toBeGreaterThanOrEqual(0);
        expect(item.credentialRefCount).toBeGreaterThanOrEqual(0);
        expect(item.promptChars).toBeGreaterThan(0);
        expect(item.estimatedTokens).toBe(Math.ceil(item.promptChars / 4));

        acc.nodes += item.nodeCount;
        acc.edges += item.edgeCount;
        acc.warnings += item.warningCount;
        acc.unknownNodes += item.unknownNodeCount;
        acc.expressionNodes += item.expressionNodeCount;
        acc.credentialRefs += item.credentialRefCount;
        acc.promptChars += item.promptChars;
        acc.estimatedTokens += item.estimatedTokens;
        return acc;
      },
      {
        nodes: 0,
        edges: 0,
        warnings: 0,
        unknownNodes: 0,
        expressionNodes: 0,
        credentialRefs: 0,
        promptChars: 0,
        estimatedTokens: 0,
      }
    );

    expect(report.totals).toEqual(recomputed);
  });

  it("matches baseline when one is committed", async () => {
    const baselinePath = "docs/prompt-evals/prompt-v1-baseline.json";
    try {
      await access(baselinePath);
    } catch {
      return;
    }

    const report = await buildPromptEvalReport("test-fixtures");
    const baselineRaw = await readFile(baselinePath, "utf-8");
    const baseline = JSON.parse(baselineRaw) as unknown;
    expect(report).toEqual(baseline);
  });
});
