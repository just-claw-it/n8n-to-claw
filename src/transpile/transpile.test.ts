import { describe, it, expect, vi, afterEach } from "vitest";
import { loadFromFile } from "../adapters/file.js";
import { parse } from "../parse/parser.js";
import { buildMockLlmTranspileResponse } from "../evals/golden-transpile-helpers.js";
import { transpile } from "./transpile.js";
import * as llmModule from "./llm.js";

const MOCK_SKILL_MD = `---
name: forced_skill
description: Test output for forceLlm.
metadata: {"openclaw":{"requires":{"bins":["node"]},"emoji":"🧪"}}
---

# Forced LLM path

Placeholder.
`;

const MOCK_SKILL_TS = `#!/usr/bin/env node
// forced LLM path test — must be long enough for parseLLMOutput sanity check
console.log("ok");
`;

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env["N8N_TO_CLAW_FORCE_LLM"];
});

describe("transpile() deterministic vs LLM", () => {
  it("with forceLlm, calls LLM even for linear HTTP GET chain", async () => {
    vi.spyOn(llmModule, "callLLM").mockResolvedValue({
      content: buildMockLlmTranspileResponse(MOCK_SKILL_MD, MOCK_SKILL_TS),
    });
    vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue({
      baseUrl: "http://mock",
      timeoutMs: 30000,
      maxRetries: 1,
      apiKey: "k",
      model: "m",
    });

    const raw = await loadFromFile("test-fixtures/schedule-http-ping.json");
    const ir = parse(raw);
    await transpile(ir, { forceLlm: true });

    expect(llmModule.callLLM).toHaveBeenCalled();
  });

  it("respects N8N_TO_CLAW_FORCE_LLM=1", async () => {
    process.env["N8N_TO_CLAW_FORCE_LLM"] = "1";
    const spy = vi.spyOn(llmModule, "callLLM").mockResolvedValue({
      content: buildMockLlmTranspileResponse(MOCK_SKILL_MD, MOCK_SKILL_TS),
    });
    vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue({
      baseUrl: "http://mock",
      timeoutMs: 30000,
      maxRetries: 1,
      apiKey: "k",
      model: "m",
    });

    const raw = await loadFromFile("test-fixtures/schedule-http-ping.json");
    const ir = parse(raw);
    await transpile(ir);

    expect(spy).toHaveBeenCalled();
  });
});
