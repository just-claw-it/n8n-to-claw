/**
 * Integration test: full pipeline (Parse → Transpile → Package) with a
 * mocked LLM, using the fixture workflow in test-fixtures/.
 *
 * Does NOT require any LLM API credentials.
 * The mock LLM returns a canned, valid SKILL.md + skill.ts pair.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { readFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

// --- Imports under test ---
import { loadFromFile } from "./adapters/file.js";
import { parse } from "./parse/parser.js";
import { transpile } from "./transpile/transpile.js";
import { packageSkill } from "./package/package.js";
import * as llmModule from "./transpile/llm.js";
import { validateTypeScript } from "./transpile/validate.js";
import {
  buildMockLlmTranspileResponse,
  loadGoldenTranspileFiles,
} from "./evals/golden-transpile-helpers.js";

// ---------------------------------------------------------------------------
// Canned LLM response — same files as golden snapshot tests (notify-slack fixture)
// ---------------------------------------------------------------------------

let NOTIFY_GOLDEN_MD = "";
let NOTIFY_GOLDEN_LLM_RESPONSE = "";

beforeAll(async () => {
  const g = await loadGoldenTranspileFiles("notify-slack-on-postgres");
  NOTIFY_GOLDEN_MD = g.skillMd;
  NOTIFY_GOLDEN_LLM_RESPONSE = buildMockLlmTranspileResponse(g.skillMd, g.skillTs);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `n8n-to-claw-int-${randomBytes(6).toString("hex")}`);
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

let hasTscAvailableCache: boolean | undefined;
async function hasTscAvailable(): Promise<boolean> {
  if (hasTscAvailableCache !== undefined) return hasTscAvailableCache;
  const probe = await validateTypeScript("const ok: string = 'x'; console.log(ok);");
  hasTscAvailableCache = probe.valid === true;
  return hasTscAvailableCache;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Full pipeline integration (mocked LLM)", () => {
  it("parses the fixture workflow correctly", async () => {
    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);

    expect(ir.displayName).toBe("Notify Slack on New Postgres Row");
    expect(ir.name).toBe("notify-slack-on-new-postgres-row");
    expect(ir.triggerType).toBe("schedule");
    expect(ir.nodes).toHaveLength(5);
    expect(ir.edges).toHaveLength(4);
  });

  it("identifies credential refs from the fixture", async () => {
    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);

    expect(ir.credentialRefs.length).toBeGreaterThanOrEqual(1);
    const types = ir.credentialRefs.map((c) => c.type);
    expect(types).toContain("postgres");
  });

  it("emits warnings for expressions and database nodes", async () => {
    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);

    const reasons = ir.warnings.map((w) => w.reason);
    expect(reasons).toContain("expression_present");
    expect(reasons).toContain("database_node");
    expect(reasons).toContain("credential_reference");
  });

  it("runs parse → transpile → package end-to-end with mock LLM", async () => {
    // Mock callLLM to return our canned response without hitting a real API
    vi.spyOn(llmModule, "callLLM").mockResolvedValue({
      content: NOTIFY_GOLDEN_LLM_RESPONSE,
    });
    // Mock loadLLMConfig so no env vars are needed
    vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue({
      baseUrl: "http://mock", timeoutMs: 30000, maxRetries: 1,
      apiKey: "mock-key",
      model: "mock-model",
    });

    const outputBase = await makeTempDir();

    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);
    const transpileResult = await transpile(ir);
    const pkg = await packageSkill(
      ir,
      transpileResult.output,
      [...ir.warnings, ...transpileResult.transpileWarnings],
      transpileResult.status,
      { outputBase, force: true }
    );

    // Skill directory created
    expect(pkg.skillDir).toContain("notify-slack-on-new-postgres-row");

    // SKILL.md written and contains the right name
    const skillMd = await readFile(join(pkg.skillDir, "SKILL.md"), "utf-8");
    expect(skillMd).toContain("name: notify_slack_on_postgres");
    expect(skillMd).toContain("{baseDir}");

    // skill.ts written and is valid TypeScript (tsc validates it internally)
    const skillTs = await readFile(join(pkg.skillDir, "skill.ts"), "utf-8");
    expect(skillTs).toContain("POSTGRES_CONNECTION_STRING");
    expect(skillTs).toContain("SLACK_WEBHOOK_URL");

    // credentials.example.env generated (workflow uses credentials)
    const credsExists = await fileExists(join(pkg.skillDir, "credentials.example.env"));
    expect(credsExists).toBe(true);
    const creds = await readFile(join(pkg.skillDir, "credentials.example.env"), "utf-8");
    expect(creds).toContain("POSTGRES=");

    // warnings.json written
    const warningsRaw = await readFile(join(pkg.skillDir, "warnings.json"), "utf-8");
    const warnings = JSON.parse(warningsRaw) as unknown[];
    expect(warnings.length).toBeGreaterThan(0);
  }, 30_000);

  it("linear schedule → HTTP GET chain uses deterministic template without callLLM", async () => {
    const spy = vi.spyOn(llmModule, "callLLM");
    vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue({
      baseUrl: "http://mock",
      timeoutMs: 30000,
      maxRetries: 1,
      apiKey: "mock-key",
      model: "mock-model",
    });

    const raw = await loadFromFile("test-fixtures/schedule-http-ping.json");
    const ir = parse(raw);
    const result = await transpile(ir);

    expect(spy).not.toHaveBeenCalled();
    expect(result.transpileWarnings.some((w) => w.reason === "deterministic_transpile")).toBe(
      true
    );
    expect(result.output.skillTs).toContain("fetch(url, { method:");
    if (await hasTscAvailable()) {
      expect(result.status).toBe("success");
    } else {
      expect(result.status).toBe("validation_skip");
    }
  }, 30_000);

  it("status is success when mock LLM returns valid TypeScript", async () => {
    vi.spyOn(llmModule, "callLLM").mockResolvedValue({ content: NOTIFY_GOLDEN_LLM_RESPONSE });
    vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue({
      baseUrl: "http://mock", timeoutMs: 30000, maxRetries: 1,
      apiKey: "mock-key",
      model: "mock-model",
    });

    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);
    const result = await transpile(ir);

    if (await hasTscAvailable()) {
      expect(result.status).toBe("success");
      return;
    }
    expect(result.status).toBe("validation_skip");
  }, 30_000);

  it("status is draft when mock LLM consistently returns broken TypeScript", async () => {
    const BROKEN_TS = `
const x: string = 42;  // type error
const y = {{{;          // syntax error
`;
    const BROKEN_RESPONSE = `\`\`\`skill-md\n${NOTIFY_GOLDEN_MD}\`\`\`\n\n\`\`\`typescript\n${BROKEN_TS}\n\`\`\``;

    vi.spyOn(llmModule, "callLLM").mockResolvedValue({ content: BROKEN_RESPONSE });
    vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue({
      baseUrl: "http://mock", timeoutMs: 30000, maxRetries: 1,
      apiKey: "mock-key",
      model: "mock-model",
    });

    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);
    const result = await transpile(ir);

    if (await hasTscAvailable()) {
      expect(result.status).toBe("draft");
      expect(result.validationError).toBeDefined();
      return;
    }
    expect(result.status).toBe("validation_skip");
  }, 30_000);

  it("callLLM is called twice on first validation failure (retry)", async () => {
    const BROKEN_TS = `#!/usr/bin/env node\n// broken skill\nconst x: string = 42;\nconsole.log(x);`;
    const BROKEN_RESPONSE = `\`\`\`skill-md\n${NOTIFY_GOLDEN_MD}\`\`\`\n\n\`\`\`typescript\n${BROKEN_TS}\n\`\`\``;

    const spy = vi.spyOn(llmModule, "callLLM").mockResolvedValue({ content: BROKEN_RESPONSE });
    vi.spyOn(llmModule, "loadLLMConfig").mockReturnValue({
      baseUrl: "http://mock", timeoutMs: 30000, maxRetries: 1,
      apiKey: "mock-key",
      model: "mock-model",
    });

    const raw = await loadFromFile("test-fixtures/notify-slack-on-postgres.json");
    const ir = parse(raw);
    await transpile(ir);

    if (!(await hasTscAvailable())) {
      // Without tsc, transpile short-circuits after one attempt.
      expect(spy).toHaveBeenCalledTimes(1);
      return;
    }

    // Should have been called exactly twice (attempt + retry)
    expect(spy).toHaveBeenCalledTimes(2);

    // Second call should include the tsc error in the messages
    const secondCallMessages = spy.mock.calls[1]?.[1] ?? [];
    const hasErrorMessage = secondCallMessages.some(
      (m) => m.role === "user" && m.content.includes("TypeScript compiler")
    );
    expect(hasErrorMessage).toBe(true);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Fixture: GitHub PR Review Notifier (webhook trigger, IF branching, Slack)
// ---------------------------------------------------------------------------

describe("Fixture: GitHub PR Review Notifier", () => {
  it("parses as a webhook-triggered workflow with branching", async () => {
    const raw = await loadFromFile("test-fixtures/github-webhook-to-slack.json");
    const ir = parse(raw);

    expect(ir.displayName).toBe("GitHub PR Review Notifier");
    expect(ir.name).toBe("github-pr-review-notifier");
    expect(ir.triggerType).toBe("webhook");
    expect(ir.nodes).toHaveLength(5);
    expect(ir.edges).toHaveLength(4);
  });

  it("detects webhook trigger and credential warnings", async () => {
    const raw = await loadFromFile("test-fixtures/github-webhook-to-slack.json");
    const ir = parse(raw);

    const reasons = ir.warnings.map((w) => w.reason);
    expect(reasons).toContain("webhook_trigger");
    expect(reasons).toContain("credential_reference");
    expect(reasons).toContain("expression_present");
  });

  it("resolves IF node with two output branches", async () => {
    const raw = await loadFromFile("test-fixtures/github-webhook-to-slack.json");
    const ir = parse(raw);

    const ifEdges = ir.edges.filter((e) => {
      const ifNode = ir.nodes.find((n) => n.name === "Is Review Submitted");
      return ifNode !== undefined && e.sourceNodeId === ifNode.id;
    });
    expect(ifEdges).toHaveLength(2);
    expect(ifEdges.map((e) => e.sourceOutputIndex).sort()).toEqual([0, 1]);
  });
});

// ---------------------------------------------------------------------------
// Fixture: AI Support Chatbot (LangChain ai_* connections)
// ---------------------------------------------------------------------------

describe("Fixture: AI Support Chatbot", () => {
  it("parses with correct node count and trigger type", async () => {
    const raw = await loadFromFile("test-fixtures/ai-support-chatbot.json");
    const ir = parse(raw);

    expect(ir.displayName).toBe("AI Support Chatbot");
    expect(ir.triggerType).toBe("webhook");
    expect(ir.nodes).toHaveLength(6);
  });

  it("captures ai_* connection types from LangChain nodes", async () => {
    const raw = await loadFromFile("test-fixtures/ai-support-chatbot.json");
    const ir = parse(raw);

    const connTypes = ir.edges.map((e) => e.connectionType);
    expect(connTypes).toContain("ai_languageModel");
    expect(connTypes).toContain("ai_memory");
    expect(connTypes).toContain("ai_tool");
    expect(connTypes).toContain("main");
  });

  it("has edges from LangChain nodes into the AI Agent", async () => {
    const raw = await loadFromFile("test-fixtures/ai-support-chatbot.json");
    const ir = parse(raw);

    const agentNode = ir.nodes.find((n) => n.name === "AI Agent");
    expect(agentNode).toBeDefined();

    const incomingToAgent = ir.edges.filter((e) => e.targetNodeId === agentNode!.id);
    expect(incomingToAgent).toHaveLength(4);
  });

  it("detects credentials on the OpenAI model node", async () => {
    const raw = await loadFromFile("test-fixtures/ai-support-chatbot.json");
    const ir = parse(raw);

    const credTypes = ir.credentialRefs.map((c) => c.type);
    expect(credTypes).toContain("openAiApi");
    expect(credTypes).toContain("httpHeaderAuth");
  });
});

// ---------------------------------------------------------------------------
// Fixture: Daily Hacker News Digest (cron, HTTP, Code, Email)
// ---------------------------------------------------------------------------

describe("Fixture: Daily Hacker News Digest", () => {
  it("parses as a schedule-triggered 6-node pipeline", async () => {
    const raw = await loadFromFile("test-fixtures/daily-hacker-news-digest.json");
    const ir = parse(raw);

    expect(ir.displayName).toBe("Daily Hacker News Digest");
    expect(ir.triggerType).toBe("schedule");
    expect(ir.nodes).toHaveLength(6);
    expect(ir.edges).toHaveLength(5);
  });

  it("categorizes code node as transform", async () => {
    const raw = await loadFromFile("test-fixtures/daily-hacker-news-digest.json");
    const ir = parse(raw);

    const codeNode = ir.nodes.find((n) => n.name === "Format Digest");
    expect(codeNode?.category).toBe("transform");
    expect(codeNode?.type).toBe("n8n-nodes-base.code");
  });

  it("categorizes emailSend as email", async () => {
    const raw = await loadFromFile("test-fixtures/daily-hacker-news-digest.json");
    const ir = parse(raw);

    const emailNode = ir.nodes.find((n) => n.name === "Send Email");
    expect(emailNode?.category).toBe("email");
  });

  it("detects expressions in the HTTP URL template", async () => {
    const raw = await loadFromFile("test-fixtures/daily-hacker-news-digest.json");
    const ir = parse(raw);

    const storyNode = ir.nodes.find((n) => n.name === "Fetch Story Details");
    expect(storyNode?.hasExpressions).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture: Sync CRM with Custom Nodes (unknown community node, stickyNote)
// ---------------------------------------------------------------------------

describe("Fixture: Sync CRM with Custom Nodes", () => {
  it("filters out stickyNote and keeps 5 real nodes", async () => {
    const raw = await loadFromFile("test-fixtures/sync-crm-with-custom-nodes.json");
    const ir = parse(raw);

    expect(ir.nodes).toHaveLength(5);
    expect(ir.nodes.every((n) => n.type !== "n8n-nodes-base.stickyNote")).toBe(true);
  });

  it("flags the community CRM node as unknown", async () => {
    const raw = await loadFromFile("test-fixtures/sync-crm-with-custom-nodes.json");
    const ir = parse(raw);

    const crmNode = ir.nodes.find((n) => n.name === "Fetch CRM Contacts");
    expect(crmNode?.category).toBe("unknown");
    expect(ir.warnings.some((w) => w.reason === "unknown_node_type")).toBe(true);
  });

  it("handles extra top-level fields (pinData, staticData, tags) without error", async () => {
    const raw = await loadFromFile("test-fixtures/sync-crm-with-custom-nodes.json");
    const ir = parse(raw);

    expect(ir.displayName).toBe("Sync CRM Contacts to Google Sheets");
    expect(ir.nodes.length).toBeGreaterThan(0);
  });

  it("detects credentials on community and Google Sheets nodes", async () => {
    const raw = await loadFromFile("test-fixtures/sync-crm-with-custom-nodes.json");
    const ir = parse(raw);

    const credTypes = ir.credentialRefs.map((c) => c.type);
    expect(credTypes).toContain("customCrmApi");
    expect(credTypes).toContain("googleSheetsOAuth2Api");
  });
});
