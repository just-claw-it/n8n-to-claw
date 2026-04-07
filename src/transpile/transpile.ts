import type { WorkflowIR, IRWarning } from "../ir/types.js";
import { callLLM, loadLLMConfig, type LLMConfig, type LLMMessage } from "./llm.js";
import { buildTranspilePrompt, buildRetryPrompt } from "./prompt.js";
import { parseLLMOutput, type TranspileOutput, ParseOutputError } from "./output-parser.js";
import { validateTypeScript } from "./validate.js";
import { tryDeterministicHttpTemplate } from "./deterministic/linear-http-chain.js";

/** Optional second argument to `transpile()`, or pass a bare `LLMConfig` (web API). */
export interface TranspileOptions {
  llmConfig?: LLMConfig;
  /** Skip deterministic fast path; always call the LLM. */
  forceLlm?: boolean;
}

export interface TranspileAttemptDebug {
  attempt: number;
  messages: LLMMessage[];
  rawLlmOutput?: string | undefined;
  parseError?: string | undefined;
  validation: {
    valid: boolean;
    error?: string | undefined;
  };
}

export interface TranspileDebugInfo {
  path: "deterministic" | "llm";
  forceLlm: boolean;
  attempts: TranspileAttemptDebug[];
}

function isLLMConfigShape(x: unknown): x is LLMConfig {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o["baseUrl"] === "string" &&
    typeof o["apiKey"] === "string" &&
    typeof o["model"] === "string"
  );
}

function resolveTranspileInput(
  second?: LLMConfig | TranspileOptions
): { llmConfig?: LLMConfig; forceLlm: boolean } {
  let forceLlm = process.env["N8N_TO_CLAW_FORCE_LLM"] === "1";
  if (second === undefined) {
    return { forceLlm };
  }
  if (isLLMConfigShape(second)) {
    return { llmConfig: second, forceLlm };
  }
  const o = second as TranspileOptions;
  if (o.forceLlm === true) forceLlm = true;
  if (o.llmConfig !== undefined) {
    return { llmConfig: o.llmConfig, forceLlm };
  }
  return { forceLlm };
}

function deterministicTranspileWarning(ir: WorkflowIR): IRWarning {
  return {
    nodeId: "deterministic",
    nodeName: ir.displayName,
    nodeType: "n8n-to-claw.deterministic",
    reason: "deterministic_transpile",
    detail:
      "Skill generated with deterministic HTTP template (linear or IF + GET chain; no LLM call).",
  };
}

function isValidationSkippedError(error: string | undefined): boolean {
  if (error === undefined) return false;
  return (
    error.includes("tsc not found") ||
    error.includes("Could not resolve the `typescript`") ||
    error.includes("Skipping validation")
  );
}

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
  /** Optional runtime trace for diagnostics/debug bundle output. */
  debug: TranspileDebugInfo;
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
  second?: LLMConfig | TranspileOptions
): Promise<TranspileResult> {
  const { llmConfig: injectedLlmConfig, forceLlm } = resolveTranspileInput(second);
  const transpileWarnings: IRWarning[] = [];
  const debug: TranspileDebugInfo = {
    path: "llm",
    forceLlm,
    attempts: [],
  };

  if (!forceLlm) {
    const det = tryDeterministicHttpTemplate(ir);
    if (det !== null) {
      const detValidation = await validateTypeScript(det.skillTs);
      debug.path = "deterministic";
      debug.attempts.push({
        attempt: 1,
        messages: [],
        validation: {
          valid: detValidation.valid,
          ...(detValidation.error !== undefined ? { error: detValidation.error } : {}),
        },
      });
      if (detValidation.valid) {
        transpileWarnings.push(deterministicTranspileWarning(ir));
        return {
          status: "success",
          output: det,
          transpileWarnings,
          debug,
        };
      }
      if (isValidationSkippedError(detValidation.error)) {
        transpileWarnings.push({
          nodeId: "transpile",
          nodeName: "transpile",
          nodeType: "transpile",
          reason: "transpile_validation",
          detail: "TypeScript validation skipped: tsc not available.",
        });
        transpileWarnings.push(deterministicTranspileWarning(ir));
        return {
          status: "validation_skip",
          output: det,
          transpileWarnings,
          debug,
        };
      }
      // Template failed tsc — unusual; fall through to LLM.
    }
  }

  const llmConfig = injectedLlmConfig ?? loadLLMConfig();

  // ---- Attempt 1 ----
  const messages = buildTranspilePrompt(ir);
  const attempt1 = await runAttempt(llmConfig, messages, 1);
  debug.attempts.push(attempt1.debug);

  if (attempt1.validationResult.valid) {
    return {
      status: "success",
      output: attempt1.output,
      transpileWarnings,
      debug,
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
      debug,
    };
  }

  // ---- Attempt 2 (retry with error injected) ----
  const retryMessages = buildRetryPrompt(
    messages,
    buildRawOutput(attempt1.output),
    attempt1.validationResult.error!
  );

  const attempt2 = await runAttempt(llmConfig, retryMessages, 2);
  debug.attempts.push(attempt2.debug);

  if (attempt2.validationResult.valid) {
    return {
      status: "success",
      output: attempt2.output,
      transpileWarnings,
      debug,
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
    debug,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runAttempt(
  config: LLMConfig,
  messages: LLMMessage[],
  attemptNum: number
): Promise<{
  output: TranspileOutput;
  validationResult: { valid: boolean; error?: string };
  debug: TranspileAttemptDebug;
}> {
  const llmResponse = await callLLM(config, messages, {
    temperature: 0.2,
  });

  let output: TranspileOutput;
  try {
    output = parseLLMOutput(llmResponse.content);
  } catch (err: unknown) {
    if (err instanceof ParseOutputError) {
      const parseErrMsg = `Failed to parse LLM output into SKILL.md + skill.ts: ${err.message}`;
      throw new TranspileError(
        parseErrMsg
      );
    }
    throw err;
  }

  const validationResult = await validateTypeScript(output.skillTs);

  return {
    output,
    validationResult,
    debug: {
      attempt: attemptNum,
      messages,
      rawLlmOutput: llmResponse.content,
      validation: {
        valid: validationResult.valid,
        ...(validationResult.error !== undefined ? { error: validationResult.error } : {}),
      },
    },
  };
}

/**
 * Reconstruct the raw LLM output format from parsed output,
 * used when building the retry prompt.
 */
function buildRawOutput(output: TranspileOutput): string {
  return `\`\`\`skill-md\n${output.skillMd}\n\`\`\`\n\n\`\`\`typescript\n${output.skillTs}\n\`\`\``;
}
