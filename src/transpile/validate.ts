import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

export interface ValidationResult {
  valid: boolean;
  /** tsc stderr output on failure */
  error?: string;
}

/**
 * Validate generated TypeScript by writing it to a temp file and running
 * `tsc --noEmit --strict --target ES2022 --module NodeNext`.
 *
 * We do NOT use the project tsconfig to keep this self-contained and fast.
 * The check is syntactic + basic type validity only.
 *
 * Note on the `typescript` dependency: it is listed as a runtime dependency
 * (not devDependency) because tsc is invoked here at runtime. Making it a
 * peerDependency would silently break validation for users without a global tsc.
 */
export async function validateTypeScript(
  code: string
): Promise<ValidationResult> {
  const id = randomBytes(6).toString("hex");
  const dir = join(tmpdir(), `n8n-to-claw-${id}`);
  const filePath = join(dir, "skill.ts");
  const tsconfigPath = join(dir, "tsconfig.json");

  // Minimal tsconfig for validation — strict but no imports to resolve.
  // typeRoots points at our own node_modules so generated code can use Node.js
  // built-ins (node:process, node:fs, etc.) without the user needing @types/node.
  const ownNodeModules = new URL("../../node_modules", import.meta.url).pathname;
  const tsconfig = JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      noEmit: true,
      lib: ["ES2022"],
      types: ["node"],
      typeRoots: [join(ownNodeModules, "@types")],
    },
    files: ["skill.ts"],
  });

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, code, "utf-8");
    await writeFile(tsconfigPath, tsconfig, "utf-8");

    const tscBin = resolveTsc();
    if (tscBin === null) {
      return {
        valid: false,
        error: "tsc not found on PATH or in package node_modules — skipping validation.",
      };
    }

    return await runTsc(dir, tscBin);
  } finally {
    await import("node:fs/promises")
      .then((fs) => fs.rm(dir, { recursive: true, force: true }))
      .catch(() => undefined);
  }
}

/**
 * Resolve the tsc binary path.
 * Priority:
 *   1. The tsc that ships with this package's own TypeScript devDependency
 *   2. tsc on PATH (system install)
 * Returns null if neither is found.
 */
function resolveTsc(): string | null {
  // 1. Try to resolve from our own package's node_modules using createRequire
  try {
    const require = createRequire(import.meta.url);
    const tscMain = require.resolve("typescript");
    // typescript resolves to .../typescript/lib/typescript.js
    // tsc is at .../typescript/bin/tsc
    const tscBin = join(tscMain, "..", "..", "bin", "tsc");
    return tscBin;
  } catch {
    // TypeScript not installed — fall through
  }

  // 2. Fall back to PATH (e.g. global tsc install)
  return "tsc";
}

const TSC_TIMEOUT_MS = 30_000;

function runTsc(cwd: string, tscBin: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const proc = spawn(tscBin, ["--project", "tsconfig.json"], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, TSC_TIMEOUT_MS);

    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        valid: false,
        error: `tsc not found or failed to launch: ${err.message}. Skipping validation.`,
      });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        resolve({
          valid: false,
          error: `tsc timed out after ${TSC_TIMEOUT_MS}ms. The generated code may be pathologically complex.`,
        });
        return;
      }
      const output = (stdout + stderr).trim();
      if (code === 0) {
        resolve({ valid: true });
      } else {
        resolve({ valid: false, error: output || `tsc exited with code ${code}` });
      }
    });
  });
}
