import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger, enableVerbose } from "../utils/logger.js";

describe("logger", () => {
  const originalDebug = process.env["DEBUG"];
  let stderrOutput: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  beforeEach(() => {
    stderrOutput = [];
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrOutput.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    if (originalDebug === undefined) {
      delete process.env["DEBUG"];
    } else {
      process.env["DEBUG"] = originalDebug;
    }
  });

  it("does not write when DEBUG is not set", () => {
    delete process.env["DEBUG"];
    logger.debug("test", "should not appear");
    expect(stderrOutput).toHaveLength(0);
  });

  it("writes when DEBUG=n8n-to-claw", () => {
    process.env["DEBUG"] = "n8n-to-claw";
    logger.debug("test", "hello");
    expect(stderrOutput.join("")).toContain("hello");
  });

  it("writes when DEBUG=*", () => {
    process.env["DEBUG"] = "*";
    logger.info("test", "wildcard");
    expect(stderrOutput.join("")).toContain("wildcard");
  });

  it("includes scope and level in output", () => {
    process.env["DEBUG"] = "n8n-to-claw";
    logger.warn("myscope", "mymessage");
    const out = stderrOutput.join("");
    expect(out).toContain("WARN");
    expect(out).toContain("myscope");
    expect(out).toContain("mymessage");
  });

  it("serialises data objects", () => {
    process.env["DEBUG"] = "n8n-to-claw";
    logger.debug("scope", "msg", { key: "value" });
    expect(stderrOutput.join("")).toContain("value");
  });

  it("timeEnd returns elapsed ms", () => {
    process.env["DEBUG"] = "n8n-to-claw";
    logger.time("op");
    const elapsed = logger.timeEnd("op");
    expect(typeof elapsed).toBe("number");
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it("enableVerbose sets DEBUG env var", () => {
    delete process.env["DEBUG"];
    enableVerbose();
    expect(process.env["DEBUG"]).toBe("n8n-to-claw");
  });

  it("enableVerbose appends to existing DEBUG value", () => {
    process.env["DEBUG"] = "other-ns";
    enableVerbose();
    expect(process.env["DEBUG"]).toBe("other-ns,n8n-to-claw");
  });

  it("enableVerbose does not duplicate when already present", () => {
    process.env["DEBUG"] = "n8n-to-claw";
    enableVerbose();
    expect(process.env["DEBUG"]).toBe("n8n-to-claw");
  });
});
