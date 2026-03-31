/**
 * Golden snapshots: mocked LLM returns exact on-disk SKILL.md + skill.ts per fixture.
 * Catches regressions in output parsing, transpile wiring, and prompt block format.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { loadFromFile } from "../adapters/file.js";
import { parse } from "../parse/parser.js";
import { transpile } from "../transpile/transpile.js";
import * as llmModule from "../transpile/llm.js";
import { validateTypeScript } from "../transpile/validate.js";
import {
  GOLDEN_TRANSPILE_ROOT,
  buildMockLlmTranspileResponse,
  loadGoldenTranspileFiles,
} from "./golden-transpile-helpers.js";

const MOCK_LLM_CONFIG = {
  baseUrl: "http://mock",
  timeoutMs: 30_000,
  maxRetries: 1,
  apiKey: "mock-key",
  model: "mock-model",
};

let hasTscCache: boolean | undefined;
async function hasTscAvailable(): Promise<boolean> {
  if (hasTscCache !== undefined) return hasTscCache;
  const probe = await validateTypeScript("const ok: string = 'x'; console.log(ok);");
  hasTscCache = probe.valid === true;
  return hasTscCache;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("golden transpile snapshots (mocked LLM)", () => {
  it("transpile output matches on-disk golden SKILL.md + skill.ts for each golden fixture", async () => {
    const names = await readdir(GOLDEN_TRANSPILE_ROOT);
    const stems: string[] = [];
    for (const name of names) {
      const st = await stat(join(GOLDEN_TRANSPILE_ROOT, name));
      if (st.isDirectory()) stems.push(name);
    }
    stems.sort((a, b) => a.localeCompare(b));
    expect(stems.length).toBeGreaterThan(0);

    for (const stem of stems) {
      const fixturePath = `test-fixtures/${stem}.json`;
      const { skillMd, skillTs } = await loadGoldenTranspileFiles(stem);
      const raw = await loadFromFile(fixturePath);
      const ir = parse(raw);

      const llmRaw = buildMockLlmTranspileResponse(skillMd, skillTs);
      vi.spyOn(llmModule, "callLLM").mockResolvedValue({ content: llmRaw });
      vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue(MOCK_LLM_CONFIG);

      const result = await transpile(ir);

      const norm = (s: string): string => s.replace(/\r\n/g, "\n").trim();
      // parseLLMOutput trims fenced bodies; golden files may have trailing newlines.
      expect(norm(result.output.skillMd), stem).toBe(norm(skillMd));
      expect(norm(result.output.skillTs), stem).toBe(norm(skillTs));

      if (await hasTscAvailable()) {
        expect(result.status, stem).toBe("success");
      } else {
        expect(result.status, stem).toBe("validation_skip");
      }
    }
  }, 120_000);
});
