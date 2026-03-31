import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildTranspileQualityEvalReport } from "./transpile-quality-eval.js";

async function main(): Promise<void> {
  const outArg = process.argv[2];
  const report = await buildTranspileQualityEvalReport("test-fixtures");
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (!outArg) {
    process.stdout.write(json);
    return;
  }

  const outPath = resolve(outArg);
  await writeFile(outPath, json, "utf-8");
  process.stdout.write(`Wrote transpile quality eval report to ${outPath}\n`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`transpile quality eval failed: ${msg}\n`);
  process.exit(1);
});
