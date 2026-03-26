import { describe, it, expect } from "vitest";
import { parse, ParseError } from "../parse/parser.js";
import type { N8nWorkflowJson } from "../parse/n8n-schema.js";

// ---------------------------------------------------------------------------
// Minimal valid workflow fixture
// ---------------------------------------------------------------------------

const MINIMAL: N8nWorkflowJson = {
  name: "My Test Workflow",
  nodes: [
    {
      id: "node-1",
      name: "Manual Trigger",
      type: "n8n-nodes-base.manualTrigger",
      parameters: {},
    },
    {
      id: "node-2",
      name: "HTTP Request",
      type: "n8n-nodes-base.httpRequest",
      parameters: { url: "https://example.com", method: "GET" },
    },
  ],
  connections: {
    "Manual Trigger": {
      main: [[{ node: "HTTP Request", type: "main", index: 0 }]],
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parse()", () => {
  it("rejects non-object input", () => {
    expect(() => parse("not an object")).toThrow(ParseError);
    expect(() => parse(null)).toThrow(ParseError);
    expect(() => parse([1, 2, 3])).toThrow(ParseError);
  });

  it("rejects workflow missing name", () => {
    expect(() => parse({ nodes: [] })).toThrow(ParseError);
  });

  it("rejects workflow missing nodes array", () => {
    expect(() => parse({ name: "test" })).toThrow(ParseError);
    expect(() => parse({ name: "test", nodes: "not-array" })).toThrow(ParseError);
  });

  it("parses a minimal valid workflow", () => {
    const ir = parse(MINIMAL);

    expect(ir.displayName).toBe("My Test Workflow");
    expect(ir.name).toBe("my-test-workflow"); // kebab-case
    expect(ir.nodes).toHaveLength(2);
    expect(ir.edges).toHaveLength(1);
  });

  it("correctly sets trigger type", () => {
    const ir = parse(MINIMAL);
    expect(ir.triggerType).toBe("manual");
  });

  it("correctly sets trigger type for webhook", () => {
    const wf: N8nWorkflowJson = {
      name: "Webhook Flow",
      nodes: [
        {
          id: "w1",
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          parameters: {},
        },
      ],
      connections: {},
    };
    expect(parse(wf).triggerType).toBe("webhook");
  });

  it("assigns correct categories", () => {
    const ir = parse(MINIMAL);
    const triggerNode = ir.nodes[0];
    const httpNode = ir.nodes[1];
    expect(triggerNode?.category).toBe("trigger");
    expect(httpNode?.category).toBe("http");
  });

  it("emits unknown_node_type warning for unrecognised node", () => {
    const wf: N8nWorkflowJson = {
      name: "Mystery Flow",
      nodes: [
        {
          id: "x1",
          name: "Weird Node",
          type: "n8n-nodes-community.unknownService",
          parameters: {},
        },
      ],
      connections: {},
    };
    const ir = parse(wf);
    expect(ir.nodes[0]?.category).toBe("unknown");
    const w = ir.warnings.find((w) => w.reason === "unknown_node_type");
    expect(w).toBeDefined();
    expect(w?.nodeType).toBe("n8n-nodes-community.unknownService");
  });

  it("detects expressions in parameters", () => {
    const wf: N8nWorkflowJson = {
      name: "Expr Flow",
      nodes: [
        {
          id: "e1",
          name: "Set",
          type: "n8n-nodes-base.set",
          parameters: { value: "={{ $json.name }}" },
        },
      ],
      connections: {},
    };
    const ir = parse(wf);
    expect(ir.nodes[0]?.hasExpressions).toBe(true);
    expect(ir.warnings.some((w) => w.reason === "expression_present")).toBe(true);
  });

  it("collects and deduplicates credential refs", () => {
    const wf: N8nWorkflowJson = {
      name: "Cred Flow",
      nodes: [
        {
          id: "c1",
          name: "DB 1",
          type: "n8n-nodes-base.postgres",
          parameters: {},
          credentials: { postgresApi: { id: "1", name: "My Postgres" } },
        },
        {
          id: "c2",
          name: "DB 2",
          type: "n8n-nodes-base.postgres",
          parameters: {},
          credentials: { postgresApi: { id: "1", name: "My Postgres" } }, // same cred
        },
      ],
      connections: {},
    };
    const ir = parse(wf);
    // Should deduplicate to one entry
    expect(ir.credentialRefs).toHaveLength(1);
    expect(ir.credentialRefs[0]?.type).toBe("postgresApi");
    expect(ir.credentialRefs[0]?.name).toBe("My Postgres");
  });

  it("skips edges referencing unknown node names and emits warnings", () => {
    const wf: N8nWorkflowJson = {
      name: "Bad Edge Flow",
      nodes: [
        { id: "n1", name: "Start", type: "n8n-nodes-base.manualTrigger", parameters: {} },
      ],
      connections: {
        Start: {
          main: [[{ node: "Ghost Node", type: "main", index: 0 }]],
        },
      },
    };
    const ir = parse(wf);
    expect(ir.edges).toHaveLength(0);
    expect(ir.warnings.some((w) => w.reason === "dangling_edge")).toBe(true);
  });

  it("preserves raw workflow JSON on the IR", () => {
    const ir = parse(MINIMAL);
    expect(ir.raw).toBe(MINIMAL);
  });

  it("preserves raw node JSON on each IRNode", () => {
    const ir = parse(MINIMAL);
    expect(ir.nodes[0]?.raw).toBe(MINIMAL.nodes?.[0]);
  });

  it("sets disabled flag on nodes", () => {
    const wf: N8nWorkflowJson = {
      name: "Disabled Flow",
      nodes: [
        { id: "d1", name: "Active", type: "n8n-nodes-base.set", parameters: {} },
        { id: "d2", name: "Inactive", type: "n8n-nodes-base.set", parameters: {}, disabled: true },
      ],
      connections: {},
    };
    const ir = parse(wf);
    expect(ir.nodes[0]?.disabled).toBe(false);
    expect(ir.nodes[1]?.disabled).toBe(true);
  });

  it("filters out stickyNote nodes", () => {
    const wf: N8nWorkflowJson = {
      name: "Sticky Flow",
      nodes: [
        { id: "s1", name: "Note", type: "n8n-nodes-base.stickyNote", parameters: {} },
        { id: "s2", name: "Set", type: "n8n-nodes-base.set", parameters: {} },
      ],
      connections: {},
    };
    const ir = parse(wf);
    expect(ir.nodes).toHaveLength(1);
    expect(ir.nodes[0]?.name).toBe("Set");
  });

  it("warns on duplicate node names", () => {
    const wf: N8nWorkflowJson = {
      name: "Dup Flow",
      nodes: [
        { id: "a1", name: "Same Name", type: "n8n-nodes-base.set", parameters: {} },
        { id: "a2", name: "Same Name", type: "n8n-nodes-base.set", parameters: {} },
      ],
      connections: {},
    };
    const ir = parse(wf);
    expect(ir.nodes).toHaveLength(2);
    const w = ir.warnings.find((w) => w.detail.includes("Duplicate node name"));
    expect(w).toBeDefined();
  });

  it("handles empty workflow (no nodes)", () => {
    const wf: N8nWorkflowJson = { name: "Empty", nodes: [] };
    const ir = parse(wf);
    expect(ir.nodes).toHaveLength(0);
    expect(ir.edges).toHaveLength(0);
    expect(ir.triggerType).toBe("unknown");
  });

  it("falls back to 'unnamed-workflow' for special-char-only name", () => {
    const wf: N8nWorkflowJson = { name: "!!!", nodes: [] };
    const ir = parse(wf);
    expect(ir.name).toBe("unnamed-workflow");
  });

  it("parses non-main connection types (ai_languageModel)", () => {
    const wf: N8nWorkflowJson = {
      name: "AI Flow",
      nodes: [
        { id: "lm1", name: "LLM", type: "@n8n/n8n-nodes-langchain.lmChatOpenAi", parameters: {} },
        { id: "ag1", name: "Agent", type: "@n8n/n8n-nodes-langchain.agent", parameters: {} },
      ],
      connections: {
        LLM: {
          ai_languageModel: [[{ node: "Agent", type: "ai_languageModel", index: 0 }]],
        },
      },
    };
    const ir = parse(wf);
    expect(ir.edges).toHaveLength(1);
    expect(ir.edges[0]?.connectionType).toBe("ai_languageModel");
  });

  it("sets connectionType to main for standard connections", () => {
    const ir = parse(MINIMAL);
    expect(ir.edges[0]?.connectionType).toBe("main");
  });

  it("falls back to node name then 'unknown' when id is missing", () => {
    const wf: N8nWorkflowJson = {
      name: "No ID Flow",
      nodes: [
        { name: "Named Node", type: "n8n-nodes-base.set", parameters: {} },
        { type: "n8n-nodes-base.set", parameters: {} },
      ],
      connections: {},
    };
    const ir = parse(wf);
    expect(ir.nodes[0]?.id).toBe("Named Node");
    expect(ir.nodes[1]?.id).toBe("unknown");
  });
});
