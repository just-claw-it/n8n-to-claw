// ---------------------------------------------------------------------------
// Logger — structured debug output controlled by the DEBUG env var.
//
// Usage:
//   DEBUG=n8n-to-claw n8n-to-claw convert workflow.json
//
// In code:
//   import { logger } from "../utils/logger.js";
//   logger.debug("parse", "node mapped", { id, category });
//   logger.warn("transpile", "retry attempt 2");
//   logger.time("llm")  / logger.timeEnd("llm")
// ---------------------------------------------------------------------------

const NAMESPACE = "n8n-to-claw";

function isEnabled(): boolean {
  const debug = process.env["DEBUG"] ?? "";
  return debug === NAMESPACE || debug === "*" || debug.split(",").includes(NAMESPACE);
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function fmt(level: string, scope: string, msg: string, data?: unknown): string {
  const base = `[${timestamp()}] ${level.padEnd(5)} [${scope}] ${msg}`;
  if (data === undefined) return base;
  const extra =
    typeof data === "string" ? data : JSON.stringify(data, null, 0);
  return `${base} ${extra}`;
}

const timers = new Map<string, number>();

export const logger = {
  debug(scope: string, msg: string, data?: unknown): void {
    if (!isEnabled()) return;
    process.stderr.write(fmt("DEBUG", scope, msg, data) + "\n");
  },

  info(scope: string, msg: string, data?: unknown): void {
    if (!isEnabled()) return;
    process.stderr.write(fmt("INFO ", scope, msg, data) + "\n");
  },

  warn(scope: string, msg: string, data?: unknown): void {
    if (!isEnabled()) return;
    process.stderr.write(fmt("WARN ", scope, msg, data) + "\n");
  },

  error(scope: string, msg: string, data?: unknown): void {
    // Errors always print, even without DEBUG, but to stderr only
    process.stderr.write(fmt("ERROR", scope, msg, data) + "\n");
  },

  time(label: string): void {
    timers.set(label, Date.now());
  },

  timeEnd(label: string): number {
    const start = timers.get(label);
    const elapsed = start !== undefined ? Date.now() - start : 0;
    timers.delete(label);
    if (isEnabled()) {
      process.stderr.write(fmt("TIMER", label, `${elapsed}ms`) + "\n");
    }
    return elapsed;
  },

  /** Print the full prompt to stderr — only when verbose flag is set */
  prompt(messages: Array<{ role: string; content: string }>): void {
    if (!isEnabled()) return;
    for (const m of messages) {
      process.stderr.write(
        `\n${"─".repeat(60)}\n[PROMPT:${m.role.toUpperCase()}]\n${"─".repeat(60)}\n${m.content}\n`
      );
    }
  },

  /** Print raw LLM response to stderr */
  response(content: string): void {
    if (!isEnabled()) return;
    process.stderr.write(
      `\n${"─".repeat(60)}\n[LLM RESPONSE]\n${"─".repeat(60)}\n${content}\n`
    );
  },
};

/** Verbose mode: always print prompt + response regardless of DEBUG */
export function enableVerbose(): void {
  const existing = process.env["DEBUG"] ?? "";
  if (!existing.split(",").includes(NAMESPACE)) {
    process.env["DEBUG"] = existing ? `${existing},${NAMESPACE}` : NAMESPACE;
  }
}
