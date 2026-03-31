import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPromptEvalReport } from "./prompt-eval.js";

async function main(): Promise<void> {
  const outArg = process.argv[2];
  const report = await buildPromptEvalReport("test-fixtures");
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (!outArg) {
    process.stdout.write(json);
    return;
  }

  const outPath = resolve(outArg);
  await writeFile(outPath, json, "utf-8");
  process.stdout.write(`Wrote prompt eval report to ${outPath}\n`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`prompt eval failed: ${msg}\n`);
  process.exit(1);
});
