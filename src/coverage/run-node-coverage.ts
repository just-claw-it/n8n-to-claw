import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateNodeCoverageMarkdown } from "./node-coverage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const fixturesDir = join(root, "test-fixtures");
const outPath = join(root, "docs", "node-coverage.md");

async function main(): Promise<void> {
  const md = await generateNodeCoverageMarkdown(fixturesDir);
  await writeFile(outPath, md, "utf-8");
  process.stdout.write(`Wrote ${outPath}\n`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`node coverage: ${msg}\n`);
  process.exit(1);
});
