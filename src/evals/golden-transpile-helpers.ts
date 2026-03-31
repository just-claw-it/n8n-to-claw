import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Root: `test-fixtures/golden-transpile/` (repo root). */
export const GOLDEN_TRANSPILE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test-fixtures",
  "golden-transpile"
);

/**
 * Wrap SKILL.md + skill.ts in the same fenced format the LLM is prompted to emit.
 */
export function buildMockLlmTranspileResponse(skillMd: string, skillTs: string): string {
  return `\`\`\`skill-md\n${skillMd}\`\`\`\n\n\`\`\`typescript\n${skillTs}\`\`\``;
}

export async function loadGoldenTranspileFiles(stem: string): Promise<{
  skillMd: string;
  skillTs: string;
}> {
  const skillMd = await readFile(join(GOLDEN_TRANSPILE_ROOT, stem, "SKILL.md"), "utf-8");
  const skillTs = await readFile(join(GOLDEN_TRANSPILE_ROOT, stem, "skill.ts"), "utf-8");
  return { skillMd, skillTs };
}
