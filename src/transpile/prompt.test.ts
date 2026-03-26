import { describe, it, expect } from "vitest";
import { buildTranspilePrompt, buildRetryPrompt } from "../transpile/prompt.js";
import type { WorkflowIR } from "../ir/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_IR: WorkflowIR = {
  name: "my-test-workflow",
  displayName: "My Test Workflow",
  triggerType: "manual",
  nodes: [
    {
      id: "n1",
      name: "Manual Trigger",
      type: "n8n-nodes-base.manualTrigger",
      category: "trigger",
      parameters: {},
      hasExpressions: false,
      disabled: false,
      credentials: [],
      raw: {},
    },
    {
      id: "n2",
      name: "HTTP Request",
      type: "n8n-nodes-base.httpRequest",
      category: "http",
      parameters: { url: "https://api.example.com/data", method: "GET" },
      hasExpressions: false,
      disabled: false,
      credentials: [],
      raw: {},
    },
  ],
  edges: [
    {
      sourceNodeId: "n1",
      targetNodeId: "n2",
      sourceOutputIndex: 0,
      targetInputIndex: 0,
      connectionType: "main",
    },
  ],
  credentialRefs: [],
  warnings: [],
  raw: {},
};

const IR_WITH_CREDENTIALS: WorkflowIR = {
  ...BASE_IR,
  credentialRefs: [
    { type: "postgresApi", name: "My Postgres" },
    { type: "slackOAuth2Api", name: "Slack Workspace" },
  ],
  warnings: [
    {
      nodeId: "n2",
      nodeName: "HTTP Request",
      nodeType: "n8n-nodes-base.httpRequest",
      reason: "credential_reference",
      detail: "Node uses credentials: postgresApi(My Postgres)",
    },
  ],
};

const IR_WITH_UNKNOWN_NODE: WorkflowIR = {
  ...BASE_IR,
  nodes: [
    ...BASE_IR.nodes,
    {
      id: "n3",
      name: "Mystery Node",
      type: "n8n-nodes-community.weirdService",
      category: "unknown",
      parameters: { config: "value" },
      hasExpressions: false,
      disabled: false,
      credentials: [],
      raw: { id: "n3", type: "n8n-nodes-community.weirdService" },
    },
  ],
  warnings: [
    {
      nodeId: "n3",
      nodeName: "Mystery Node",
      nodeType: "n8n-nodes-community.weirdService",
      reason: "unknown_node_type",
      detail: 'Node type "n8n-nodes-community.weirdService" has no category mapping. A stub will be emitted.',
    },
  ],
};

// ---------------------------------------------------------------------------
// buildTranspilePrompt tests
// ---------------------------------------------------------------------------

describe("buildTranspilePrompt()", () => {
  it("returns exactly two messages: system + user", () => {
    const messages = buildTranspilePrompt(BASE_IR);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
  });

  it("includes the workflow display name in the user message", () => {
    const [, user] = buildTranspilePrompt(BASE_IR);
    expect(user?.content).toContain("My Test Workflow");
  });

  it("includes trigger type in the user message", () => {
    const [, user] = buildTranspilePrompt(BASE_IR);
    expect(user?.content).toContain("manual");
  });

  it("includes node names and types", () => {
    const [, user] = buildTranspilePrompt(BASE_IR);
    expect(user?.content).toContain("Manual Trigger");
    expect(user?.content).toContain("HTTP Request");
    expect(user?.content).toContain("n8n-nodes-base.httpRequest");
  });

  it("includes edge information", () => {
    const [, user] = buildTranspilePrompt(BASE_IR);
    expect(user?.content).toContain("Manual Trigger");
    expect(user?.content).toContain("HTTP Request");
    // Edge should show the → arrow
    expect(user?.content).toContain("→");
  });

  it("includes credential refs when present", () => {
    const [, user] = buildTranspilePrompt(IR_WITH_CREDENTIALS);
    expect(user?.content).toContain("postgresApi");
    expect(user?.content).toContain("Slack Workspace");
  });

  it("says no credentials required when there are none", () => {
    const [, user] = buildTranspilePrompt(BASE_IR);
    expect(user?.content).toContain("No credentials required");
  });

  it("includes warnings in the user message", () => {
    const [, user] = buildTranspilePrompt(IR_WITH_UNKNOWN_NODE);
    expect(user?.content).toContain("unknown_node_type");
    expect(user?.content).toContain("Mystery Node");
  });

  it("omits the warnings block when there are no warnings", () => {
    const [, user] = buildTranspilePrompt(BASE_IR);
    expect(user?.content).not.toContain("Parser warnings");
  });

  it("flags UNKNOWN_NODE nodes", () => {
    const [, user] = buildTranspilePrompt(IR_WITH_UNKNOWN_NODE);
    expect(user?.content).toContain("UNKNOWN_NODE");
  });

  it("includes parameters in node description", () => {
    const [, user] = buildTranspilePrompt(BASE_IR);
    expect(user?.content).toContain("https://api.example.com/data");
  });

  it("system prompt requires snake_case name", () => {
    const [system] = buildTranspilePrompt(BASE_IR);
    expect(system?.content).toContain("snake_case");
  });

  it("system prompt requires single-line metadata JSON", () => {
    const [system] = buildTranspilePrompt(BASE_IR);
    expect(system?.content).toContain("single-line JSON");
  });

  it("system prompt mentions {baseDir}", () => {
    const [system] = buildTranspilePrompt(BASE_IR);
    expect(system?.content).toContain("{baseDir}");
  });
});

// ---------------------------------------------------------------------------
// buildRetryPrompt tests
// ---------------------------------------------------------------------------

describe("buildRetryPrompt()", () => {
  const originalMessages = buildTranspilePrompt(BASE_IR);
  const previousOutput = "```skill-md\n---\nname: test\n---\n```\n\n```typescript\nbad code\n```";
  const tscError = "skill.ts(3,5): error TS2345: Argument of type 'string' is not assignable";

  it("includes all original messages", () => {
    const retry = buildRetryPrompt(originalMessages, previousOutput, tscError);
    expect(retry[0]).toEqual(originalMessages[0]);
    expect(retry[1]).toEqual(originalMessages[1]);
  });

  it("appends the previous assistant output as assistant role", () => {
    const retry = buildRetryPrompt(originalMessages, previousOutput, tscError);
    const assistantMsg = retry.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toBe(previousOutput);
  });

  it("appends a user message containing the tsc error", () => {
    const retry = buildRetryPrompt(originalMessages, previousOutput, tscError);
    const lastMsg = retry[retry.length - 1];
    expect(lastMsg?.role).toBe("user");
    expect(lastMsg?.content).toContain(tscError);
  });

  it("has length = original + 2 (assistant + new user)", () => {
    const retry = buildRetryPrompt(originalMessages, previousOutput, tscError);
    expect(retry).toHaveLength(originalMessages.length + 2);
  });
});
