// ---------------------------------------------------------------------------
// Parse the LLM's raw text response into structured output.
// The LLM is prompted to emit exactly two fenced code blocks:
//   ```skill-md ... ```
//   ```typescript ... ```
// We extract them by fence language tag, not by position, so the LLM
// can include brief explanation text without breaking extraction.
// ---------------------------------------------------------------------------

export interface TranspileOutput {
  skillMd: string;
  skillTs: string;
}

export class ParseOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseOutputError";
  }
}

/**
 * Extract the content of a fenced code block by its language tag.
 * Uses a greedy match to handle nested triple-backtick fences inside
 * the code block (common when LLMs include usage examples in comments).
 * Returns null if not found.
 */
function extractFence(text: string, lang: string): string | null {
  // Find the opening fence for this language tag
  const openPattern = new RegExp(
    `\`\`\`${escapeRegex(lang)}[^\\S\\n]*\\n`,
    "i"
  );
  const openMatch = openPattern.exec(text);
  if (openMatch === null) return null;

  const contentStart = openMatch.index + openMatch[0].length;

  // Walk through the remaining text tracking fence depth.
  // A line that is exactly ``` (optional trailing whitespace) and NOT followed
  // by a non-whitespace char is a closing fence. A line that is ```<word> is
  // an opening fence (nested).
  const rest = text.slice(contentStart);
  const lines = rest.split("\n");
  let depth = 0;
  let endLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trimEnd();
    if (/^```[a-zA-Z]/.test(trimmed)) {
      depth++;
    } else if (trimmed === "```") {
      if (depth > 0) {
        depth--;
      } else {
        endLineIdx = i;
        break;
      }
    }
  }

  if (endLineIdx === -1) return null;
  return lines.slice(0, endLineIdx).join("\n").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseLLMOutput(raw: string): TranspileOutput {
  // Try the canonical fence tag first, then fall back to alternatives.
  const skillMd =
    extractFence(raw, "skill-md") ??
    extractFence(raw, "markdown") ??
    extractFence(raw, "md");

  const skillTs =
    extractFence(raw, "typescript") ??
    extractFence(raw, "ts");

  const missing: string[] = [];
  if (skillMd === null) missing.push("SKILL.md (```skill-md block)");
  if (skillTs === null) missing.push("skill.ts (```typescript block)");

  if (missing.length > 0) {
    throw new ParseOutputError(
      `LLM output is missing required sections: ${missing.join(", ")}.\n` +
        `First 500 chars of output:\n${raw.slice(0, 500)}`
    );
  }

  // Sanity-check: SKILL.md must have a frontmatter block.
  if (!skillMd!.startsWith("---")) {
    throw new ParseOutputError(
      `Generated SKILL.md does not start with YAML frontmatter (---). ` +
        `First 200 chars:\n${skillMd!.slice(0, 200)}`
    );
  }

  // Sanity-check: skill.ts must look like TypeScript, not empty.
  if (skillTs!.length < 50) {
    throw new ParseOutputError(
      `Generated skill.ts is suspiciously short (${skillTs!.length} chars). ` +
        `Content: ${skillTs}`
    );
  }

  return { skillMd: skillMd!, skillTs: skillTs! };
}
