import { describe, it, expect } from "vitest";
import { loadFromFile } from "../../adapters/file.js";
import { parse } from "../../parse/parser.js";
import { tryDeterministicLinearHttpGet } from "./linear-http-chain.js";
import { validateTypeScript } from "../validate.js";

describe("tryDeterministicLinearHttpGet()", () => {
  it("returns SKILL.md + skill.ts for schedule → HTTP GET chain fixture", async () => {
    const raw = await loadFromFile("test-fixtures/schedule-http-ping.json");
    const ir = parse(raw);
    const out = tryDeterministicLinearHttpGet(ir);
    expect(out).not.toBeNull();
    expect(out!.skillMd).toContain("name: schedule_http_ping");
    expect(out!.skillMd).toContain("https://example.com/api/health");
    expect(out!.skillMd).toContain("https://example.org/status");
    expect(out!.skillTs).toContain("fetch(url");
    expect(out!.skillTs).toContain("example.com");
  });

  it("produces TypeScript that passes tsc when available", async () => {
    const raw = await loadFromFile("test-fixtures/schedule-http-ping.json");
    const ir = parse(raw);
    const out = tryDeterministicLinearHttpGet(ir);
    expect(out).not.toBeNull();
    const v = await validateTypeScript(out!.skillTs);
    if (v.error?.includes("Could not resolve")) {
      expect(v.valid).toBe(false);
      return;
    }
    expect(v.valid).toBe(true);
  });

  it("returns null for notify fixture (not a pure linear HTTP chain)", async () => {
    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);
    expect(tryDeterministicLinearHttpGet(ir)).toBeNull();
  });
});
