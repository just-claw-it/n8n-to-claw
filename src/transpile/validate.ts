import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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
  const ownNodeModules = fileURLToPath(new URL("../../node_modules", import.meta.url));
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

    const tscCmd = resolveTscCommand();
    if (tscCmd === null) {
      return {
        valid: false,
        error:
          "Could not resolve the `typescript` package to run `lib/tsc.js` — skipping validation.",
      };
    }

    return await runTsc(dir, tscCmd);
  } finally {
    await import("node:fs/promises")
      .then((fs) => fs.rm(dir, { recursive: true, force: true }))
      .catch(() => undefined);
  }
}

/**
 * Resolve how to run the TypeScript compiler.
 *
 * We run `node path/to/typescript/lib/tsc.js` (not `bin/tsc`) so validation works
 * on Windows: `bin/tsc` is a Unix shebang script and is often not spawnable as
 * an executable there.
 */
function resolveTscCommand(): { exe: string; args: string[] } | null {
  try {
    const require = createRequire(import.meta.url);
    const tscMain = require.resolve("typescript");
    const tscJs = join(dirname(tscMain), "tsc.js");
    return {
      exe: process.execPath,
      args: [tscJs, "--project", "tsconfig.json"],
    };
  } catch {
    return null;
  }
}

const TSC_TIMEOUT_MS = 30_000;

function runTsc(cwd: string, command: { exe: string; args: string[] }): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const proc = spawn(command.exe, command.args, {
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
