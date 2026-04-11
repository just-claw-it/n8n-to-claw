import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { WorkflowIR, IRWarning } from "../ir/types.js";
import type { TranspileOutput } from "../transpile/output-parser.js";
import type { TranspileStatus } from "../transpile/transpile.js";

// ---------------------------------------------------------------------------
// Output layout
//
// Live skill:
//   ~/.openclaw/workspace/skills/<workflow-name>/
//     SKILL.md
//     skill.ts
//     credentials.example.env   (if credentials are used)
//     warnings.json
//     skill-meta.json           (provenance + workflow fingerprint)
//
// Draft (failed validation):
//   ~/.openclaw/workspace/skills/<workflow-name>/draft/
//     SKILL.md
//     skill.ts
// ---------------------------------------------------------------------------

/** Optional context for skill-meta.json (CLI fills source + prompt version). */
export interface PackageProvenance {
  source?: {
    mode: "file" | "api";
    file?: string | undefined;
    n8nUrl?: string | undefined;
    workflowId?: string | undefined;
  };
  promptVersion?: string | undefined;
}

export interface PackageOptions {
  /**
   * Override the base output directory.
   * Defaults to ~/.openclaw/workspace/skills
   */
  outputBase?: string;
  /** If true, write to draft/ subdirectory regardless of validation status */
  forceDraft?: boolean;
  /** If true, overwrite existing output without checking */
  force?: boolean;
  /** Extra fields written into skill-meta.json */
  provenance?: PackageProvenance;
}

export interface PackageResult {
  /** Absolute path to the skill directory written */
  skillDir: string;
  /** Files written (relative to skillDir) */
  filesWritten: string[];
}

let cachedToolVersion: string | undefined;

async function readToolVersion(): Promise<string> {
  if (cachedToolVersion !== undefined) return cachedToolVersion;
  try {
    const pkgPath = new URL("../../package.json", import.meta.url);
    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    cachedToolVersion = typeof pkg["version"] === "string" ? pkg["version"] : "unknown";
  } catch {
    cachedToolVersion = "unknown";
  }
  return cachedToolVersion;
}

/** Deterministic JSON for hashing (sorted object keys at every depth). */
function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = sortDeep(obj[k]);
  }
  return out;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function workflowFingerprint(raw: unknown): string {
  const body = stableStringify(raw);
  const hex = createHash("sha256").update(body, "utf-8").digest("hex");
  return `sha256:${hex}`;
}

export async function packageSkill(
  ir: WorkflowIR,
  output: TranspileOutput,
  allWarnings: IRWarning[],
  status: TranspileStatus,
  opts: PackageOptions = {}
): Promise<PackageResult> {
  const base =
    opts.outputBase ??
    resolve(homedir(), ".openclaw", "workspace", "skills");

  if (ir.name.includes("..") || ir.name.includes("/") || ir.name.includes("\\")) {
    throw new Error(`Invalid skill name "${ir.name}": must not contain path separators or "..".`);
  }

  const skillDir = join(base, ir.name);
  const isDraft = opts.forceDraft || status === "draft";
  const targetDir = isDraft ? join(skillDir, "draft") : skillDir;

  if (!opts.force) {
    const exists = await access(join(targetDir, "skill.ts")).then(() => true, () => false);
    if (exists) {
      throw new Error(
        `Skill already exists at "${targetDir}". Use --force to overwrite.`
      );
    }
  }

  await mkdir(targetDir, { recursive: true });

  const filesWritten: string[] = [];

  // SKILL.md
  await writeFile(join(targetDir, "SKILL.md"), output.skillMd, "utf-8");
  filesWritten.push(isDraft ? "draft/SKILL.md" : "SKILL.md");

  // skill.ts
  await writeFile(join(targetDir, "skill.ts"), output.skillTs, "utf-8");
  filesWritten.push(isDraft ? "draft/skill.ts" : "skill.ts");

  // credentials.example.env — only in the live dir, not in draft
  if (!isDraft && ir.credentialRefs.length > 0) {
    const envContent = buildCredentialsEnv(ir);
    await writeFile(join(skillDir, "credentials.example.env"), envContent, "utf-8");
    filesWritten.push("credentials.example.env");
  }

  // warnings.json — always written to the live skillDir (not the draft subdir)
  const warningsPath = join(skillDir, "warnings.json");
  await writeFile(
    warningsPath,
    JSON.stringify(allWarnings, null, 2),
    "utf-8"
  );
  filesWritten.push("warnings.json");

  const toolVersion = await readToolVersion();
  const meta = {
    schemaVersion: 1,
    generator: {
      name: "n8n-to-claw",
      version: toolVersion,
    },
    generatedAt: new Date().toISOString(),
    workflow: {
      name: ir.name,
      displayName: ir.displayName,
      triggerType: ir.triggerType,
      fingerprint: workflowFingerprint(ir.raw),
    },
    transpile: {
      status,
      ...(opts.provenance?.promptVersion !== undefined
        ? { promptVersion: opts.provenance.promptVersion }
        : {}),
    },
    ...(opts.provenance?.source !== undefined ? { source: opts.provenance.source } : {}),
  };

  await writeFile(join(skillDir, "skill-meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  filesWritten.push("skill-meta.json");

  return { skillDir, filesWritten };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a credentials.example.env file from credential refs.
 * Converts n8n credential type names to SCREAMING_SNAKE_CASE env var names.
 */
function buildCredentialsEnv(ir: WorkflowIR): string {
  const header = [
    `# Credentials for the "${ir.displayName}" skill`,
    `# Copy this file to credentials.env and fill in your values.`,
    `# Then source it before running the skill: source credentials.env`,
    `#`,
    `# WARNING: Never commit credentials.env to version control.`,
    ``,
  ].join("\n");

  const vars = ir.credentialRefs.map((ref) => {
    const envName = toEnvVarName(ref.type);
    return [
      `# ${ref.type} — credential name in n8n: "${ref.name}"`,
      `${envName}=`,
    ].join("\n");
  });

  return header + vars.join("\n\n") + "\n";
}

/**
 * Convert an n8n credential type string to a SCREAMING_SNAKE_CASE env var name.
 * e.g. "postgresApi" → "POSTGRES_API"
 *      "slackOAuth2Api" → "SLACK_O_AUTH2_API"  (naïve but predictable)
 */
function toEnvVarName(credType: string): string {
  return credType
    .replace(/([A-Z])/g, "_$1")
    .toUpperCase()
    .replace(/^_/, "")
    .replace(/[^A-Z0-9_]/g, "_");
}
