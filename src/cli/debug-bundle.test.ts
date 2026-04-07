import { describe, it, expect, vi, afterEach } from "vitest";
import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { loadFromFile } from "../adapters/file.js";
import { parse } from "../parse/parser.js";
import { transpile } from "../transpile/transpile.js";
import * as llmModule from "../transpile/llm.js";
import { writeDebugBundle } from "./debug-bundle.js";
import { buildMockLlmTranspileResponse } from "../evals/golden-transpile-helpers.js";

async function makeTempDir(): Promise<string> {
  return join(tmpdir(), `n8n-to-claw-debug-${randomBytes(6).toString("hex")}`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("writeDebugBundle()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes deterministic debug artifacts", async () => {
    const skillDir = await makeTempDir();
    const raw = await loadFromFile("test-fixtures/schedule-http-ping.json");
    const ir = parse(raw);
    const transpileResult = await transpile(ir);

    const files = await writeDebugBundle({
      skillDir,
      source: { mode: "file", file: "test-fixtures/schedule-http-ping.json" },
      ir,
      parseWarnings: ir.warnings,
      transpileResult,
    });

    expect(files.some((f) => f.endsWith("meta.json"))).toBe(true);
    expect(await exists(join(skillDir, "debug-bundle", "ir.json"))).toBe(true);
    expect(await exists(join(skillDir, "debug-bundle", "validation-attempt-1.json"))).toBe(true);

    const metaRaw = await readFile(join(skillDir, "debug-bundle", "meta.json"), "utf-8");
    expect(metaRaw).toContain("\"path\": \"deterministic\"");
    expect(metaRaw).not.toContain("LLM_API_KEY");

    await rm(skillDir, { recursive: true, force: true });
  }, 30_000);

  it("writes LLM attempt prompts and responses", async () => {
    const skillDir = await makeTempDir();
    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);

    vi.spyOn(llmModule, "callLLM").mockResolvedValue({
      content: buildMockLlmTranspileResponse(
        `---\nname: debug_case\ndescription: x\nmetadata: {"openclaw":{"requires":{"bins":["node"]},"emoji":"🧪"}}\n---\n\n# x\n`,
        `#!/usr/bin/env node\n// keep long enough for parser sanity check\nconst msg = "ok";\nconsole.log(msg);\n`
      ),
    });
    vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue({
      baseUrl: "http://mock",
      timeoutMs: 30000,
      maxRetries: 1,
      apiKey: "k",
      model: "m",
    });

    const transpileResult = await transpile(ir, { forceLlm: true });
    await writeDebugBundle({
      skillDir,
      source: { mode: "file", file: "test-fixtures/notify-slack-on-postgres.json" },
      ir,
      parseWarnings: ir.warnings,
      transpileResult,
    });

    expect(await exists(join(skillDir, "debug-bundle", "prompt-attempt-1.txt"))).toBe(true);
    expect(await exists(join(skillDir, "debug-bundle", "llm-response-attempt-1.txt"))).toBe(true);
    await rm(skillDir, { recursive: true, force: true });
  }, 30_000);
});

