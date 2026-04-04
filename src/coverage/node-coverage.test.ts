import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  aggregateTypeUsage,
  extractNodeTypesFromWorkflowJson,
  generateNodeCoverageMarkdown,
  scanTestFixtures,
} from "./node-coverage.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "test-fixtures");

describe("node coverage dashboard", () => {
  it("extracts node types and skips sticky notes", () => {
    const raw = {
      nodes: [
        { type: "n8n-nodes-base.set" },
        { type: "n8n-nodes-base.stickyNote" },
        { type: "n8n-nodes-base.code" },
      ],
    };
    expect(extractNodeTypesFromWorkflowJson(raw)).toEqual([
      "n8n-nodes-base.set",
      "n8n-nodes-base.code",
    ]);
  });

  it("scans all JSON fixtures and finds known workflow types", async () => {
    const scans = await scanTestFixtures(FIXTURES_DIR);
    const files = scans.map((s) => s.file).sort();
    expect(files).toContain("schedule-http-ping.json");
    expect(files).toContain("sync-crm-with-custom-nodes.json");

    const rows = aggregateTypeUsage(scans);
    const types = rows.map((r) => r.type);
    expect(types.some((t) => t.includes("langchain"))).toBe(true);
    expect(rows.some((r) => r.mappingSource === "unknown")).toBe(true);
  });

  it("generates markdown with summary sections", async () => {
    const md = await generateNodeCoverageMarkdown(FIXTURES_DIR);
    expect(md).toContain("# Node coverage dashboard");
    expect(md).toContain("## Summary");
    expect(md).toContain("## Node types in fixtures");
    expect(md).toContain("n8n-nodes-base.httpRequest");
  });
});
