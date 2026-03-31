import { describe, it, expect } from "vitest";
import { validateTypeScript } from "../transpile/validate.js";

const VALID_TS = `
import { env } from "node:process";

const key = env["MY_KEY"] ?? "";
console.log(key.toUpperCase());
`;

// Type error: assigning a number to a string
const INVALID_TS = `
const x: string = 42;
console.log(x);
`;

// Syntax error
const SYNTAX_ERROR_TS = `
const x = {{{;
`;

function isValidationSkipped(error: string | undefined): boolean {
  if (error === undefined) return false;
  return (
    error.includes("skipping validation") ||
    error.includes("tsc not found") ||
    error.includes("Could not resolve the `typescript` package")
  );
}

describe("validateTypeScript()", () => {
  it("returns valid:true for well-typed code", async () => {
    const result = await validateTypeScript(VALID_TS);
    // If tsc is unavailable the result is still valid:false with a specific message
    if (isValidationSkipped(result.error)) {
      console.warn("tsc not available in this environment — skipping positive assertion");
      return;
    }
    expect(result.valid).toBe(true);
  }, 15_000);

  it("returns valid:false for a type error", async () => {
    const result = await validateTypeScript(INVALID_TS);
    if (isValidationSkipped(result.error)) {
      console.warn("tsc not available — skipping");
      return;
    }
    expect(result.valid).toBe(false);
    expect(result.error).toContain("TS");
  }, 15_000);

  it("returns valid:false for a syntax error", async () => {
    const result = await validateTypeScript(SYNTAX_ERROR_TS);
    if (isValidationSkipped(result.error)) {
      console.warn("tsc not available — skipping");
      return;
    }
    expect(result.valid).toBe(false);
  }, 15_000);

  it("always returns an object with a valid boolean", async () => {
    const result = await validateTypeScript(VALID_TS);
    expect(typeof result.valid).toBe("boolean");
  }, 15_000);
});
