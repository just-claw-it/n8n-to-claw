import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkflowIR, IRWarning } from "../ir/types.js";
import type { TranspileResult } from "../transpile/transpile.js";

export interface WriteDebugBundleInput {
  skillDir: string;
  source: {
    mode: "file" | "api";
    file?: string | undefined;
    n8nUrl?: string | undefined;
    workflowId?: string | undefined;
  };
  ir: WorkflowIR;
  parseWarnings: IRWarning[];
  transpileResult: TranspileResult;
}

function promptText(messages: Array<{ role: string; content: string }>): string {
  return messages.map((m) => `--- ${m.role.toUpperCase()} ---\n${m.content}`).join("\n\n");
}

export async function writeDebugBundle(input: WriteDebugBundleInput): Promise<string[]> {
  const outDir = join(input.skillDir, "debug-bundle");
  await mkdir(outDir, { recursive: true });

  const files: string[] = [];
  const safeIr = {
    ...input.ir,
    raw: undefined,
    nodes: input.ir.nodes.map(({ raw: _raw, ...rest }) => rest),
  };

  const meta = {
    generatedAt: new Date().toISOString(),
    source: input.source,
    llm: {
      baseUrl: process.env["LLM_BASE_URL"] ?? null,
      model: process.env["LLM_MODEL"] ?? null,
      timeoutMs: process.env["LLM_TIMEOUT_MS"] ?? null,
      maxRetries: process.env["LLM_MAX_RETRIES"] ?? null,
      maxTokens: process.env["LLM_MAX_TOKENS"] ?? null,
    },
    transpile: {
      status: input.transpileResult.status,
      validationError: input.transpileResult.validationError,
      debug: input.transpileResult.debug,
    },
  };

  await writeFile(join(outDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  files.push("debug-bundle/meta.json");

  await writeFile(join(outDir, "ir.json"), JSON.stringify(safeIr, null, 2), "utf-8");
  files.push("debug-bundle/ir.json");

  await writeFile(join(outDir, "warnings.parse.json"), JSON.stringify(input.parseWarnings, null, 2), "utf-8");
  files.push("debug-bundle/warnings.parse.json");

  await writeFile(
    join(outDir, "warnings.transpile.json"),
    JSON.stringify(input.transpileResult.transpileWarnings, null, 2),
    "utf-8"
  );
  files.push("debug-bundle/warnings.transpile.json");

  for (const attempt of input.transpileResult.debug.attempts) {
    const suffix = `attempt-${attempt.attempt}`;
    if (attempt.messages.length > 0) {
      await writeFile(join(outDir, `prompt-${suffix}.txt`), promptText(attempt.messages), "utf-8");
      files.push(`debug-bundle/prompt-${suffix}.txt`);
    }
    if (attempt.rawLlmOutput !== undefined) {
      await writeFile(join(outDir, `llm-response-${suffix}.txt`), attempt.rawLlmOutput, "utf-8");
      files.push(`debug-bundle/llm-response-${suffix}.txt`);
    }
    await writeFile(
      join(outDir, `validation-${suffix}.json`),
      JSON.stringify(attempt.validation, null, 2),
      "utf-8"
    );
    files.push(`debug-bundle/validation-${suffix}.json`);
  }

  return files;
}

