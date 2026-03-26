import type { WorkflowIR, IRWarning } from "../ir/types.js";
import { callLLM, loadLLMConfig, type LLMConfig, type LLMMessage } from "./llm.js";
import { buildTranspilePrompt, buildRetryPrompt } from "./prompt.js";
import { parseLLMOutput, type TranspileOutput, ParseOutputError } from "./output-parser.js";
import { validateTypeScript } from "./validate.js";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type TranspileStatus =
  | "success"          // compiled cleanly
  | "draft"            // written to draft/ after failed retry
  | "validation_skip"; // tsc was not available; output written as-is

export interface TranspileResult {
  status: TranspileStatus;
  output: TranspileOutput;
  /**
   * Populated when status === "draft":
   * the tsc error from the final attempt.
   */
  validationError?: string | undefined;
  /** Warnings accumulated during transpilation (in addition to parse warnings) */
  transpileWarnings: IRWarning[];
}

export class TranspileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranspileError";
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function transpile(
  ir: WorkflowIR,
  config?: LLMConfig
): Promise<TranspileResult> {
  const llmConfig = config ?? loadLLMConfig();
  const transpileWarnings: IRWarning[] = [];

  // ---- Attempt 1 ----
  const messages = buildTranspilePrompt(ir);
  const attempt1 = await runAttempt(llmConfig, messages);

  if (attempt1.validationResult.valid) {
    return {
      status: "success",
      output: attempt1.output,
      transpileWarnings,
    };
  }

  // tsc wasn't available — pass the output through without retry
  if (attempt1.validationResult.error?.includes("tsc not found")) {
    transpileWarnings.push({
      nodeId: "transpile",
      nodeName: "transpile",
      nodeType: "transpile",
      reason: "transpile_validation",
      detail: "TypeScript validation skipped: tsc not available.",
    });
    return {
      status: "validation_skip",
      output: attempt1.output,
      transpileWarnings,
    };
  }

  // ---- Attempt 2 (retry with error injected) ----
  const retryMessages = buildRetryPrompt(
    messages,
    buildRawOutput(attempt1.output),
    attempt1.validationResult.error!
  );

  const attempt2 = await runAttempt(llmConfig, retryMessages);

  if (attempt2.validationResult.valid) {
    return {
      status: "success",
      output: attempt2.output,
      transpileWarnings,
    };
  }

  // Both attempts failed — return as draft
  transpileWarnings.push({
    nodeId: "transpile",
    nodeName: "skill.ts",
    nodeType: "transpile",
    reason: "transpile_validation",
    detail: `skill.ts failed tsc validation after 2 attempts. Output written to draft/. Error: ${attempt2.validationResult.error?.slice(0, 300)}`,
  });

  return {
    status: "draft" as const,
    output: attempt2.output,
    ...(attempt2.validationResult.error !== undefined
      ? { validationError: attempt2.validationResult.error }
      : {}),
    transpileWarnings,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runAttempt(
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<{
  output: TranspileOutput;
  validationResult: { valid: boolean; error?: string };
}> {
  const llmResponse = await callLLM(config, messages, {
    maxTokens: 4096,
    temperature: 0.2,
  });

  let output: TranspileOutput;
  try {
    output = parseLLMOutput(llmResponse.content);
  } catch (err: unknown) {
    if (err instanceof ParseOutputError) {
      throw new TranspileError(
        `Failed to parse LLM output into SKILL.md + skill.ts: ${err.message}`
      );
    }
    throw err;
  }

  const validationResult = await validateTypeScript(output.skillTs);

  return { output, validationResult };
}

/**
 * Reconstruct the raw LLM output format from parsed output,
 * used when building the retry prompt.
 */
function buildRawOutput(output: TranspileOutput): string {
  return `\`\`\`skill-md\n${output.skillMd}\n\`\`\`\n\n\`\`\`typescript\n${output.skillTs}\n\`\`\``;
}
