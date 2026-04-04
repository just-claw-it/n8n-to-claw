import { describe, it, expect } from "vitest";
import { loadFromFile } from "../../adapters/file.js";
import { parse } from "../../parse/parser.js";
import {
  tryDeterministicConditionalHttpGet,
  tryDeterministicHttpTemplate,
  tryDeterministicLinearHttpGet,
} from "./linear-http-chain.js";
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

  it("matches webhook → HTTP GET chain (linear template)", async () => {
    const raw = await loadFromFile("test-fixtures/webhook-http-ping.json");
    const ir = parse(raw);
    const out = tryDeterministicLinearHttpGet(ir);
    expect(out).not.toBeNull();
    expect(out!.skillMd).toContain("name: webhook_http_ping");
    expect(out!.skillMd).toContain("Inbound webhook");
    expect(out!.skillMd).toContain("ingest-ping");
    expect(out!.skillTs).not.toContain("readFileSync");
  });

  it("matches schedule → noOp → HTTP GET", async () => {
    const raw = await loadFromFile("test-fixtures/schedule-noop-http-ping.json");
    const ir = parse(raw);
    const out = tryDeterministicLinearHttpGet(ir);
    expect(out).not.toBeNull();
    expect(out!.skillMd).toContain("schedule_noop_http_ping");
    expect(out!.skillTs).toContain("https://example.net/ping");
  });

  it(
    "produces TypeScript that passes tsc when available",
    async () => {
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
    },
    30_000,
  );

  it("returns null for notify fixture (not a pure linear HTTP chain)", async () => {
    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);
    expect(tryDeterministicLinearHttpGet(ir)).toBeNull();
  });

  it("returns null for webhook IF fixture (not linear)", async () => {
    const raw = await loadFromFile("test-fixtures/webhook-if-http-ping.json");
    const ir = parse(raw);
    expect(tryDeterministicLinearHttpGet(ir)).toBeNull();
  });
});

describe("tryDeterministicConditionalHttpGet()", () => {
  it("emits stdin JSON gate + HTTP GETs for webhook → IF → HTTP / noOp", async () => {
    const raw = await loadFromFile("test-fixtures/webhook-if-http-ping.json");
    const ir = parse(raw);
    const out = tryDeterministicConditionalHttpGet(ir);
    expect(out).not.toBeNull();
    expect(out!.skillMd).toContain("webhook_if_http_ping");
    expect(out!.skillMd).toContain("$json.kind");
    expect(out!.skillTs).toContain("readFileSync");
    expect(out!.skillTs).toContain('"kind"');
    expect(out!.skillTs).toContain('"ping"');
    expect(out!.skillTs).toContain("Condition not met");
  });

  it(
    "produces TypeScript that passes tsc when available",
    async () => {
      const raw = await loadFromFile("test-fixtures/webhook-if-http-ping.json");
      const ir = parse(raw);
      const out = tryDeterministicConditionalHttpGet(ir);
      expect(out).not.toBeNull();
      const v = await validateTypeScript(out!.skillTs);
      if (v.error?.includes("Could not resolve")) {
        expect(v.valid).toBe(false);
        return;
      }
      expect(v.valid).toBe(true);
    },
    30_000,
  );
});

describe("tryDeterministicHttpTemplate()", () => {
  it("prefers linear match over conditional when both could apply", async () => {
    const raw = await loadFromFile("test-fixtures/schedule-http-ping.json");
    const ir = parse(raw);
    const out = tryDeterministicHttpTemplate(ir);
    expect(out!.skillTs).not.toContain("readFileSync");
  });

  it("uses conditional when graph is not linear", async () => {
    const raw = await loadFromFile("test-fixtures/webhook-if-http-ping.json");
    const ir = parse(raw);
    const out = tryDeterministicHttpTemplate(ir);
    expect(out!.skillTs).toContain("readFileSync");
  });
});
