#!/usr/bin/env node
// ---------------------------------------------------------------------------
// n8n-to-claw CLI
//
// Usage:
//   n8n-to-claw convert workflow.json
//   n8n-to-claw convert --n8n-url https://my-n8n.com --api-key <key> --workflow-id <id>
//   n8n-to-claw convert workflow.json --dry-run
//   n8n-to-claw convert workflow.json --inspect
//   n8n-to-claw convert workflow.json --verbose
//   n8n-to-claw check-llm
// ---------------------------------------------------------------------------

import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { loadFromFile } from "../adapters/file.js";
import { loadFromApi } from "../adapters/api.js";
import { parse, ParseError } from "../parse/parser.js";
import { transpile, TranspileError } from "../transpile/transpile.js";
import { LLMError, loadLLMConfig, probeLlmConnection } from "../transpile/llm.js";
import { buildTranspilePrompt, PROMPT_VERSION } from "../transpile/prompt.js";
import { packageSkill } from "../package/package.js";
import { writeDebugBundle } from "./debug-bundle.js";
import { enableVerbose, logger } from "../utils/logger.js";
import { knownNodeTypes } from "../parse/categorize.js";

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`
n8n-to-claw — convert n8n workflows to OpenClaw skills

Usage:
  n8n-to-claw check-llm
  n8n-to-claw convert <workflow.json>
  n8n-to-claw convert --n8n-url <url> --api-key <key> --workflow-id <id>

Options:
  --n8n-url        n8n instance base URL (e.g. https://my-n8n.example.com)
  --api-key        n8n API key
  --workflow-id    n8n workflow ID to fetch
  --output-dir     Override output base directory
                   (default: ~/.openclaw/workspace/skills)
  --force          Overwrite existing skill output without prompting

Flags:
  --dry-run        Parse only: print IR summary + warnings, skip LLM + write
  --inspect        Print full IR as JSON + the LLM prompt, then exit (no LLM call)
  --debug-bundle   Write debug-bundle/ with IR, prompts, LLM output, and validation traces
  --verbose        Print LLM prompt, raw response, and tsc output to stderr
  --version        Print version and exit
  --help, -h       Show this help

Exit codes:
  0                Success — skill written and TypeScript validated
  1                Error — invalid input, LLM failure, or I/O error
  2                Draft — skill written to draft/ (TypeScript validation failed)

Commands:
  check-llm        Send a tiny chat request; verify LLM_* env and network (Ollama, etc.)

Environment variables (required for LLM):
  LLM_BASE_URL     OpenAI-compatible API base URL
  LLM_API_KEY      API key
  LLM_MODEL        Model name (recommend: gpt-4o or claude-sonnet tier minimum)
  LLM_TIMEOUT_MS   Per-request timeout in ms (default: 60000)
  LLM_MAX_RETRIES  Max retries on 429/5xx (default: 3)

Debug logging:
  DEBUG=n8n-to-claw n8n-to-claw convert workflow.json
`);
}

// ---------------------------------------------------------------------------
// Progress helpers — all to stderr; only the final output path goes to stdout
// ---------------------------------------------------------------------------

function step(msg: string): void {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  process.stderr.write(`[${ts}] ${msg}\n`);
}

function indent(msg: string): void {
  process.stderr.write(`         ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface CLIArgs {
  file?: string | undefined;
  n8nUrl?: string | undefined;
  apiKey?: string | undefined;
  workflowId?: string | undefined;
  outputDir?: string | undefined;
  dryRun: boolean;
  inspect: boolean;
  debugBundle: boolean;
  verbose: boolean;
  force: boolean;
}

async function getVersion(): Promise<string> {
  try {
    const pkgPath = new URL("../../package.json", import.meta.url).pathname;
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<string, unknown>;
    return typeof pkg["version"] === "string" ? pkg["version"] : "unknown";
  } catch {
    return "unknown";
  }
}

function parseCliArgs(): CLIArgs | "help" | "version" {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        "n8n-url": { type: "string" },
        "api-key": { type: "string" },
        "workflow-id": { type: "string" },
        "output-dir": { type: "string" },
        "dry-run": { type: "boolean", default: false },
        "inspect": { type: "boolean", default: false },
        "debug-bundle": { type: "boolean", default: false },
        "verbose": { type: "boolean", default: false },
        "force": { type: "boolean", default: false },
        "version": { type: "boolean", short: "v", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${msg}\n\n`);
    printHelp();
    process.exit(1);
  }

  const { values, positionals } = parsed;

  if (values.help) return "help";
  if (values.version) return "version";

  // Strip the optional "convert" subcommand (only the first positional)
  const rest =
    positionals.length > 0 && positionals[0] === "convert"
      ? positionals.slice(1)
      : positionals;

  const args: CLIArgs = {
    dryRun: values["dry-run"] === true,
    inspect: values["inspect"] === true,
    debugBundle: values["debug-bundle"] === true,
    verbose: values["verbose"] === true,
    force: values["force"] === true,
  };

  if (rest[0] !== undefined) args.file = rest[0];
  const n8nUrl = values["n8n-url"];
  const apiKey = values["api-key"];
  const workflowId = values["workflow-id"];
  const outputDir = values["output-dir"];
  if (typeof n8nUrl === "string") args.n8nUrl = n8nUrl;
  if (typeof apiKey === "string") args.apiKey = apiKey;
  if (typeof workflowId === "string") args.workflowId = workflowId;
  if (typeof outputDir === "string") args.outputDir = outputDir;

  return args;
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

function fatalError(label: string, err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n✗ ${label}:\n  ${msg.split("\n").join("\n  ")}\n`);

  if (err instanceof LLMError) {
    if (err.statusCode === 401) process.stderr.write("\n  → Check LLM_API_KEY is set and valid.\n");
    if (err.statusCode === 404) process.stderr.write("\n  → Check LLM_BASE_URL and LLM_MODEL.\n");
    if (err.statusCode === 429) process.stderr.write("\n  → You are rate limited. Wait a moment or increase LLM_MAX_RETRIES.\n");
    if (msg.includes("timed out")) process.stderr.write(`\n  → Increase LLM_TIMEOUT_MS (current: ${process.env["LLM_TIMEOUT_MS"] ?? "60000"}ms).\n`);
    if (msg.includes("Network error calling LLM") && !msg.includes("check-llm")) {
      process.stderr.write("\n  → Run n8n-to-claw check-llm with the same LLM_* environment.\n");
    }
  }
  if (err instanceof ParseError) {
    process.stderr.write("\n  → Ensure the file is a valid n8n workflow JSON export.\n");
  }

  process.exit(1);
}

// ---------------------------------------------------------------------------
// --inspect output — all to stderr so stdout stays pipeable
// ---------------------------------------------------------------------------

function runInspect(ir: ReturnType<typeof parse>): void {
  const print = (s: string) => process.stderr.write(s + "\n");

  print("\n═══ IR (WorkflowIR) ═══════════════════════════════════════\n");
  const { raw: _raw, nodes, ...rest } = ir;
  const irSummary = {
    ...rest,
    nodes: nodes.map(({ raw: _r, ...n }) => n),
  };
  print(JSON.stringify(irSummary, null, 2));

  print("\n═══ LLM Prompt ═════════════════════════════════════════════\n");
  const messages = buildTranspilePrompt(ir);
  for (const m of messages) {
    print(`--- [${m.role.toUpperCase()}] ---`);
    print(m.content);
    print("");
  }

  print("\n═══ Known node types (" + knownNodeTypes().length + ") ════════\n");
  print(knownNodeTypes().sort().join("\n"));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runCheckLlmCommand(): Promise<void> {
  let config;
  try {
    config = loadLLMConfig();
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${m}\n`);
    process.exit(1);
  }
  process.stderr.write(`Probing ${config.baseUrl} (model: ${config.model})...\n`);
  const result = await probeLlmConnection(config);
  if (result.ok) {
    process.stdout.write(`✓ ${result.message}\n`);
    process.exit(0);
  }
  process.stderr.write(`✗ ${result.message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] === "check-llm" || argv[0] === "llm-check") {
    await runCheckLlmCommand();
    return;
  }

  const args = parseCliArgs();
  if (args === "help") { printHelp(); process.exit(0); }
  if (args === "version") {
    const v = await getVersion();
    console.log(`n8n-to-claw ${v}`);
    process.exit(0);
  }

  if (args.verbose) enableVerbose();

  logger.debug("cli", "args parsed", args);

  // Validate input mode
  const isApiMode = !!(args.n8nUrl ?? args.apiKey ?? args.workflowId);
  const isFileMode = !!args.file;

  if (isApiMode && isFileMode) {
    process.stderr.write("Error: specify either a workflow file or API flags (--n8n-url + --api-key + --workflow-id), not both.\n");
    process.exit(1);
  }

  if (!isApiMode && !isFileMode) {
    process.stderr.write("Error: provide either a workflow JSON file or --n8n-url + --api-key + --workflow-id\n\n");
    printHelp();
    process.exit(1);
  }

  if (isApiMode) {
    const missing: string[] = [];
    if (!args.n8nUrl) missing.push("--n8n-url");
    if (!args.apiKey) missing.push("--api-key");
    if (!args.workflowId) missing.push("--workflow-id");
    if (missing.length > 0) {
      process.stderr.write(`Error: API mode requires: ${missing.join(", ")}\n`);
      process.exit(1);
    }
  }

  // ── Stage 1: Load ──────────────────────────────────────────────────────
  step("Loading workflow...");
  let rawJson: unknown;
  try {
    if (isFileMode) {
      rawJson = await loadFromFile(args.file!);
      indent(`Source: ${args.file}`);
    } else {
      rawJson = await loadFromApi({
        baseUrl: args.n8nUrl!,
        apiKey: args.apiKey!,
        workflowId: args.workflowId!,
      });
      indent(`Source: ${args.n8nUrl} / workflow ${args.workflowId}`);
    }
  } catch (err: unknown) {
    fatalError("Failed to load workflow", err);
  }

  // ── Stage 1b: Parse ────────────────────────────────────────────────────
  let ir: ReturnType<typeof parse>;
  try {
    ir = parse(rawJson);
  } catch (err: unknown) {
    fatalError("Failed to parse workflow", err);
  }

  indent(`Workflow: "${ir.displayName}"`);
  indent(`Trigger:  ${ir.triggerType}`);
  indent(`Confidence: ${ir.quality.score}/100 (${ir.quality.level})`);
  indent(`Nodes:    ${ir.nodes.length} (${summarizeCategories(ir)})`);
  indent(`Edges:    ${ir.edges.length}`);
  indent(`Readiness: ${ir.quality.summary}`);

  if (ir.warnings.length > 0) {
    indent(`Warnings: ${ir.warnings.length}`);
    const byReason = groupBy(ir.warnings, (w) => w.reason);
    for (const [reason, ws] of byReason) {
      indent(`  ${reason}: ${ws.length}`);
    }
  }

  // --inspect: print IR + prompt + known types, exit
  if (args.inspect) {
    runInspect(ir);
  }

  // --dry-run: stop here
  if (args.dryRun) {
    process.stderr.write("\n✓ Dry run complete — workflow is valid. Re-run without --dry-run to transpile.\n");
    process.exit(0);
  }

  // ── Stage 2: Transpile ─────────────────────────────────────────────────
  step("Transpiling...");

  let transpileResult: Awaited<ReturnType<typeof transpile>>;
  try {
    transpileResult = await transpile(ir);
  } catch (err: unknown) {
    if (err instanceof TranspileError || err instanceof LLMError) {
      fatalError("Transpile failed", err);
    }
    throw err;
  }

  const usedDeterministic = transpileResult.transpileWarnings.some(
    (w) => w.reason === "deterministic_transpile"
  );
  if (usedDeterministic) {
    indent("Path: deterministic template (no LLM).");
  } else {
    indent(`Model: ${process.env["LLM_MODEL"] ?? "(LLM_MODEL not set)"}`);
  }

  const statusMsg = {
    success: "✓ TypeScript validated",
    draft: "⚠ TypeScript invalid after 2 attempts — output written to draft/",
    validation_skip: "~ TypeScript validation skipped (tsc unavailable)",
  }[transpileResult.status];
  indent(statusMsg);

  if (transpileResult.status === "success" && transpileResult.transpileWarnings.length === 0) {
    indent("No transpile warnings");
  }

  // ── Stage 3: Package ───────────────────────────────────────────────────
  step("Writing output...");
  const allWarnings = [...ir.warnings, ...transpileResult.transpileWarnings];
  const pkgOpts: Parameters<typeof packageSkill>[4] = {};
  if (args.outputDir !== undefined) pkgOpts.outputBase = args.outputDir;
  if (args.force) pkgOpts.force = true;
  pkgOpts.provenance = {
    promptVersion: PROMPT_VERSION,
    source: isFileMode
      ? { mode: "file", file: args.file }
      : { mode: "api", n8nUrl: args.n8nUrl, workflowId: args.workflowId },
  };
  let pkg: Awaited<ReturnType<typeof packageSkill>>;
  try {
    pkg = await packageSkill(ir, transpileResult.output, allWarnings, transpileResult.status, pkgOpts);
  } catch (err: unknown) {
    fatalError("Failed to write output", err);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  // Skill path → stdout (scriptable: backtick capture, xargs, etc.)
  // Everything else → stderr
  process.stdout.write(`${pkg.skillDir}\n`);
  process.stderr.write(`\n✓ Skill written to:\n  ${pkg.skillDir}\n`);
  process.stderr.write(`  Files: ${pkg.filesWritten.join(", ")}\n`);

  if (args.debugBundle) {
    const debugFiles = await writeDebugBundle({
      skillDir: pkg.skillDir,
      source: isFileMode
        ? { mode: "file", file: args.file }
        : { mode: "api", n8nUrl: args.n8nUrl, workflowId: args.workflowId },
      ir,
      parseWarnings: ir.warnings,
      transpileResult,
    });
    process.stderr.write(`  Debug bundle: ${debugFiles.join(", ")}\n`);
  }

  if (allWarnings.length > 0) {
    process.stderr.write(`\n⚠ ${allWarnings.length} warning(s) — see warnings.json for full detail:\n`);
    const byReason = groupBy(allWarnings, (w) => w.reason);
    for (const [reason, ws] of byReason) {
      process.stderr.write(`  ${reason}: ${ws.length}\n`);
    }
  }

  if (transpileResult.status === "draft") {
    process.stderr.write(
      "\n  The draft/ folder contains unvalidated output.\n" +
        "  Fix the TypeScript errors and move the files up one level when ready.\n" +
        "  Tip: run with --verbose to see what the LLM generated.\n"
    );
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function summarizeCategories(ir: ReturnType<typeof parse>): string {
  const counts = new Map<string, number>();
  for (const n of ir.nodes) {
    counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([k, v]) => `${v} ${k}`).join(", ");
}

function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    const existing = map.get(k);
    if (existing !== undefined) {
      existing.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}

main().catch((err: unknown) => {
  process.stderr.write(`Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`);
  logger.error("cli", "unexpected error", err);
  process.exit(1);
});
