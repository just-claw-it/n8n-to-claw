import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ParseError } from "../parse/parser.js";

/**
 * Load a raw n8n workflow JSON from a local file path.
 * Returns the parsed JS object — does NOT produce a WorkflowIR.
 * Call parse() on the result.
 */
export async function loadFromFile(filePath: string): Promise<unknown> {
  const abs = resolve(filePath);

  let text: string;
  try {
    text = await readFile(abs, "utf-8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseError(`Cannot read workflow file "${abs}": ${msg}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseError(`File "${abs}" is not valid JSON: ${msg}`);
  }

  return json;
}
