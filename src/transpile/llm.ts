// ---------------------------------------------------------------------------
// LLM client — wraps any OpenAI-compatible API.
// Config via environment variables:
//   LLM_BASE_URL      — e.g. https://api.openai.com/v1 or https://api.groq.com/openai/v1  (required)
//   LLM_API_KEY       — API key                          (required)
//   LLM_MODEL         — model name                       (required)
//   LLM_TIMEOUT_MS    — per-request timeout in ms        (default: 60000)
//   LLM_MAX_RETRIES   — max retries on 429               (default: 3)
//   LLM_MAX_TOKENS    — max completion tokens per call    (default: 4096)
// ---------------------------------------------------------------------------

import { logger } from "../utils/logger.js";

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  /**
   * Max completion tokens per chat/completions request.
   * Lower values finish sooner on slow local models (risk: truncated SKILL.md/skill.ts).
   */
  maxOutputTokens?: number | undefined;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: number | undefined;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number | undefined,
    public readonly body?: string | undefined
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export function loadLLMConfig(): LLMConfig {
  const baseUrl = process.env["LLM_BASE_URL"];
  const apiKey = process.env["LLM_API_KEY"];
  const model = process.env["LLM_MODEL"];

  const missing: string[] = [];
  if (!baseUrl) missing.push("LLM_BASE_URL");
  if (!apiKey) missing.push("LLM_API_KEY");
  if (!model) missing.push("LLM_MODEL");

  if (missing.length > 0) {
    throw new LLMError(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `  Copy .env.example to .env, fill in values, then: source .env`
    );
  }

  const timeoutMs = parseInt(process.env["LLM_TIMEOUT_MS"] ?? "60000", 10);
  const maxRetries = parseInt(process.env["LLM_MAX_RETRIES"] ?? "3", 10);
  const maxTokRaw = parseInt(process.env["LLM_MAX_TOKENS"] ?? "4096", 10);
  const maxOutputTokens =
    Number.isFinite(maxTokRaw) && maxTokRaw > 0 ? Math.min(maxTokRaw, 128_000) : 4096;

  return {
    baseUrl: baseUrl!.replace(/\/$/, ""),
    apiKey: apiKey!,
    model: model!,
    timeoutMs: isNaN(timeoutMs) ? 60_000 : timeoutMs,
    maxRetries: isNaN(maxRetries) ? 3 : maxRetries,
    maxOutputTokens,
  };
}

export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  opts: { maxTokens?: number | undefined; temperature?: number | undefined } = {}
): Promise<LLMResponse> {
  const url = `${config.baseUrl}/chat/completions`;
  let attempt = 0;

  const maxTokens = opts.maxTokens ?? config.maxOutputTokens ?? 4096;

  logger.debug("llm", "callLLM", {
    model: config.model,
    messages: messages.length,
    timeoutMs: config.timeoutMs,
    maxTokens,
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    logger.time(`llm-attempt-${attempt}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: maxTokens,
          temperature: opts.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const elapsed = logger.timeEnd(`llm-attempt-${attempt}`);
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout =
        err instanceof Error && err.name === "AbortError";

      if (isTimeout) {
        throw new LLMError(
          `LLM request timed out after ${elapsed}ms (LLM_TIMEOUT_MS=${config.timeoutMs}). ` +
            `Try increasing LLM_TIMEOUT_MS or using a faster model.`
        );
      }

      if (attempt < config.maxRetries) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 16_000);
        logger.warn("llm", `network error: ${msg}, retrying in ${backoffMs}ms`, { attempt });
        await sleep(backoffMs);
        continue;
      }

      throw new LLMError(formatLlmNetworkFailureMessage(config.baseUrl, attempt, msg));
    } finally {
      clearTimeout(timeoutId);
    }

    const elapsed = logger.timeEnd(`llm-attempt-${attempt}`);
    logger.debug("llm", `response`, { status: response.status, elapsed });

    // Rate limited — honour Retry-After and back off
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const defaultBackoff = Math.min(1000 * 2 ** (attempt - 1), 32_000);
      const parsed = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : NaN;
      const retryAfterMs = Number.isNaN(parsed) ? defaultBackoff : parsed;

      if (attempt >= config.maxRetries) {
        throw new LLMError(
          `LLM API rate limited after ${attempt} attempt(s). ` +
            `Try again in ${Math.ceil(retryAfterMs / 1000)}s, or reduce request frequency.`,
          429
        );
      }

      logger.warn("llm", `rate limited (429), retrying in ${retryAfterMs}ms`, {
        attempt,
        maxRetries: config.maxRetries,
      });
      await sleep(retryAfterMs);
      continue;
    }

    // Transient server errors — retry with backoff
    if (response.status >= 500 && response.status < 600) {
      if (attempt < config.maxRetries) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 16_000);
        logger.warn("llm", `server error ${response.status}, retrying in ${backoffMs}ms`, {
          attempt,
        });
        await sleep(backoffMs);
        continue;
      }
      throw new LLMError(
        `LLM API returned server error ${response.status} after ${attempt} attempt(s). ` +
          `The LLM provider may be experiencing issues.`,
        response.status
      );
    }

    let body: string;
    try {
      body = await response.text();
    } catch {
      body = "<unreadable>";
    }

    if (!response.ok) {
      let hint = "";
      if (response.status === 401) hint = " Check LLM_API_KEY.";
      if (response.status === 404) hint = " Check LLM_BASE_URL and LLM_MODEL.";
      if (response.status === 400) hint = " The model may not support this request format.";
      throw new LLMError(
        `LLM API returned HTTP ${response.status}.${hint}\n  Body: ${body.slice(0, 300)}`,
        response.status,
        body
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new LLMError(
        `LLM API returned non-JSON response. Is LLM_BASE_URL correct?\n  Body: ${body.slice(0, 200)}`
      );
    }

    const p = parsed as Record<string, unknown>;
    const choices = p["choices"] as Array<Record<string, unknown>> | undefined;
    const content = (
      (choices?.[0]?.["message"] as Record<string, unknown> | undefined)?.["content"]
    ) as string | undefined;

    if (typeof content !== "string" || content.length === 0) {
      throw new LLMError(
        `LLM response missing content field. The model may have refused to respond.\n` +
          `  Raw response: ${body.slice(0, 300)}`
      );
    }

    logger.response(content);

    const usage = p["usage"] as Record<string, unknown> | undefined;
    const tokensUsed =
      typeof usage?.["total_tokens"] === "number" ? usage["total_tokens"] : undefined;

    return {
      content,
      ...(tokensUsed !== undefined ? { tokensUsed } : {}),
    };
  }
}

/**
 * Human-readable hints when fetch() to the LLM API fails (connection refused, DNS, etc.).
 */
export function formatLlmNetworkFailureMessage(
  baseUrl: string,
  attempts: number,
  errMsg: string
): string {
  let out = `Network error calling LLM after ${attempts} attempt(s): ${errMsg}`;
  const lower = baseUrl.toLowerCase();
  if (lower.includes("127.0.0.1") || lower.includes("localhost")) {
    out +=
      "\n\nLocal OpenAI-compatible API (e.g. Ollama):" +
      "\n  • The API must be running on the same machine as this CLI process." +
      "\n  • CI runners, cloud agents, and remote SSH sessions cannot reach your laptop's localhost." +
      "\n  • Typical URL: LLM_BASE_URL=http://127.0.0.1:11434/v1 with Ollama running." +
      "\n  • Quick check: n8n-to-claw check-llm";
  } else {
    out +=
      "\n\nCheck LLM_BASE_URL, TLS/proxy, firewall, and VPN. " +
      "Run n8n-to-claw check-llm after setting LLM_* env vars.";
  }
  return out;
}

const PROBE_TIMEOUT_MS = 20_000;

/**
 * Single lightweight request to verify the OpenAI-compatible endpoint is reachable.
 * Use before long transpiles or in CI scripts (same env vars as convert).
 */
export async function probeLlmConnection(
  config: LLMConfig
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const url = `${config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const body = await response.text();
      const snippet = body.length > 200 ? `${body.slice(0, 200)}…` : body;
      return {
        ok: false,
        message: `HTTP ${response.status}: ${snippet}`,
      };
    }
    return {
      ok: true,
      message: `LLM endpoint OK — ${config.baseUrl} (model: ${config.model})`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const core = isAbort ? `probe timed out after ${PROBE_TIMEOUT_MS}ms` : msg;
    return {
      ok: false,
      message: formatLlmNetworkFailureMessage(config.baseUrl, 1, core),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
