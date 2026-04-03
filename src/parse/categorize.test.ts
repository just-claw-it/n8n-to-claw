import { describe, it, expect } from "vitest";
import {
  categorizeNode,
  categorizeNodeWithSource,
  deriveTriggerType,
  knownNodeTypes,
} from "../parse/categorize.js";

describe("categorizeNode()", () => {
  // Existing coverage
  it("maps manualTrigger to trigger", () => {
    expect(categorizeNode("n8n-nodes-base.manualTrigger")).toBe("trigger");
  });
  it("maps httpRequest to http", () => {
    expect(categorizeNode("n8n-nodes-base.httpRequest")).toBe("http");
  });
  it("maps postgres to database", () => {
    expect(categorizeNode("n8n-nodes-base.postgres")).toBe("database");
  });
  it("maps unknown to unknown", () => {
    expect(categorizeNode("n8n-nodes-community.neverHeardOf")).toBe("unknown");
  });

  // New node types
  it("maps respondToWebhook to webhook", () => {
    expect(categorizeNode("n8n-nodes-base.respondToWebhook")).toBe("webhook");
  });
  it("maps slack to http", () => {
    expect(categorizeNode("n8n-nodes-base.slack")).toBe("http");
  });
  it("maps notion to http", () => {
    expect(categorizeNode("n8n-nodes-base.notion")).toBe("http");
  });
  it("maps googleSheets to http", () => {
    expect(categorizeNode("n8n-nodes-base.googleSheets")).toBe("http");
  });
  it("maps github to http", () => {
    expect(categorizeNode("n8n-nodes-base.github")).toBe("http");
  });
  it("maps stripe to http", () => {
    expect(categorizeNode("n8n-nodes-base.stripe")).toBe("http");
  });
  it("maps s3 to file", () => {
    expect(categorizeNode("n8n-nodes-base.s3")).toBe("file");
  });
  it("maps googleDrive to file", () => {
    expect(categorizeNode("n8n-nodes-base.googleDrive")).toBe("file");
  });
  it("maps supabase to database", () => {
    expect(categorizeNode("n8n-nodes-base.supabase")).toBe("database");
  });
  it("maps sendGrid to email", () => {
    expect(categorizeNode("n8n-nodes-base.sendGrid")).toBe("email");
  });
  it("maps splitOut to transform", () => {
    expect(categorizeNode("n8n-nodes-base.splitOut")).toBe("transform");
  });
  it("maps removeDuplicates to transform", () => {
    expect(categorizeNode("n8n-nodes-base.removeDuplicates")).toBe("transform");
  });

  // LangChain nodes
  it("maps lmChatOpenAi to transform", () => {
    expect(categorizeNode("@n8n/n8n-nodes-langchain.lmChatOpenAi")).toBe("transform");
  });
  it("maps lmChatAnthropic to transform", () => {
    expect(categorizeNode("@n8n/n8n-nodes-langchain.lmChatAnthropic")).toBe("transform");
  });
  it("maps chainLlm to transform", () => {
    expect(categorizeNode("@n8n/n8n-nodes-langchain.chainLlm")).toBe("transform");
  });
  it("maps agent to transform", () => {
    expect(categorizeNode("@n8n/n8n-nodes-langchain.agent")).toBe("transform");
  });
  it("maps vectorStorePinecone to database", () => {
    expect(categorizeNode("@n8n/n8n-nodes-langchain.vectorStorePinecone")).toBe("database");
  });
  it("maps toolWorkflow to flow", () => {
    expect(categorizeNode("@n8n/n8n-nodes-langchain.toolWorkflow")).toBe("flow");
  });
  it("maps unknown langchain node via prefix to transform", () => {
    expect(categorizeNode("@n8n/n8n-nodes-langchain.someFutureNode")).toBe("transform");
  });

  // New node types
  it("maps stickyNote to flow", () => {
    expect(categorizeNode("n8n-nodes-base.stickyNote")).toBe("flow");
  });
  it("maps executeCommand to transform", () => {
    expect(categorizeNode("n8n-nodes-base.executeCommand")).toBe("transform");
  });
  it("maps openAi to http", () => {
    expect(categorizeNode("n8n-nodes-base.openAi")).toBe("http");
  });
  it("maps readPdf to file", () => {
    expect(categorizeNode("n8n-nodes-base.readPdf")).toBe("file");
  });
  it("maps spreadsheetFile to file", () => {
    expect(categorizeNode("n8n-nodes-base.spreadsheetFile")).toBe("file");
  });
  it("maps awsS3 to file", () => {
    expect(categorizeNode("n8n-nodes-base.awsS3")).toBe("file");
  });
  it("maps awsSns to http", () => {
    expect(categorizeNode("n8n-nodes-base.awsSns")).toBe("http");
  });
  it("maps awsSqs to http", () => {
    expect(categorizeNode("n8n-nodes-base.awsSqs")).toBe("http");
  });
  it("maps googleCalendar to http", () => {
    expect(categorizeNode("n8n-nodes-base.googleCalendar")).toBe("http");
  });

  // New: databases added in coverage expansion
  it("maps snowflake to database", () => {
    expect(categorizeNode("n8n-nodes-base.snowflake")).toBe("database");
  });
  it("maps oracleSql to database", () => {
    expect(categorizeNode("n8n-nodes-base.oracleSql")).toBe("database");
  });
  it("maps elasticsearch to database", () => {
    expect(categorizeNode("n8n-nodes-base.elasticsearch")).toBe("database");
  });
  it("maps googleBigQuery to database", () => {
    expect(categorizeNode("n8n-nodes-base.googleBigQuery")).toBe("database");
  });
  it("maps azureCosmosDb to database", () => {
    expect(categorizeNode("n8n-nodes-base.azureCosmosDb")).toBe("database");
  });
  it("maps databricks to database", () => {
    expect(categorizeNode("n8n-nodes-base.databricks")).toBe("database");
  });

  // New: email nodes
  it("maps mailgun to email", () => {
    expect(categorizeNode("n8n-nodes-base.mailgun")).toBe("email");
  });
  it("maps awsSes to email", () => {
    expect(categorizeNode("n8n-nodes-base.awsSes")).toBe("email");
  });
  it("maps brevo to email", () => {
    expect(categorizeNode("n8n-nodes-base.brevo")).toBe("email");
  });

  // New: file/storage nodes
  it("maps nextCloud to file", () => {
    expect(categorizeNode("n8n-nodes-base.nextCloud")).toBe("file");
  });
  it("maps azureStorage to file", () => {
    expect(categorizeNode("n8n-nodes-base.azureStorage")).toBe("file");
  });

  // New: service-specific triggers
  it("maps shopifyTrigger to trigger", () => {
    expect(categorizeNode("n8n-nodes-base.shopifyTrigger")).toBe("trigger");
  });
  it("maps githubTrigger to trigger", () => {
    expect(categorizeNode("n8n-nodes-base.githubTrigger")).toBe("trigger");
  });
  it("maps stripeTrigger to trigger", () => {
    expect(categorizeNode("n8n-nodes-base.stripeTrigger")).toBe("trigger");
  });
  it("maps telegramTrigger to trigger", () => {
    expect(categorizeNode("n8n-nodes-base.telegramTrigger")).toBe("trigger");
  });
  it("maps slackTrigger to trigger", () => {
    expect(categorizeNode("n8n-nodes-base.slackTrigger")).toBe("trigger");
  });

  // New: SaaS integrations
  it("maps shopify to http", () => {
    expect(categorizeNode("n8n-nodes-base.shopify")).toBe("http");
  });
  it("maps twitter to http", () => {
    expect(categorizeNode("n8n-nodes-base.twitter")).toBe("http");
  });
  it("maps whatsApp to http", () => {
    expect(categorizeNode("n8n-nodes-base.whatsApp")).toBe("http");
  });
  it("maps zoom to http", () => {
    expect(categorizeNode("n8n-nodes-base.zoom")).toBe("http");
  });

  // New: suffix fallback for future/unknown triggers
  it("falls back to trigger for unknown *Trigger suffix", () => {
    expect(categorizeNode("n8n-nodes-base.someFutureServiceTrigger")).toBe("trigger");
  });
  it("falls back to trigger for community trigger nodes", () => {
    expect(categorizeNode("n8n-nodes-community.customTrigger")).toBe("trigger");
  });
  it("does not treat non-Trigger suffix as trigger", () => {
    expect(categorizeNode("n8n-nodes-community.customWidget")).toBe("unknown");
  });
});

describe("deriveTriggerType()", () => {
  it("returns webhook for webhook trigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.webhook" }])).toBe("webhook");
  });
  it("returns webhook for formTrigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.formTrigger" }])).toBe("webhook");
  });
  it("returns schedule for scheduleTrigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.scheduleTrigger" }])).toBe("schedule");
  });
  it("returns schedule for cronTrigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.cronTrigger" }])).toBe("schedule");
  });
  it("returns manual for manualTrigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.manualTrigger" }])).toBe("manual");
  });
  it("returns manual for start", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.start" }])).toBe("manual");
  });
  it("returns event for kafkaTrigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.kafkaTrigger" }])).toBe("event");
  });
  it("returns event for emailTrigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.emailTrigger" }])).toBe("event");
  });
  it("returns event for localFileTrigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.localFileTrigger" }])).toBe("event");
  });
  it("returns event for executeWorkflowTrigger", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.executeWorkflowTrigger" }])).toBe("event");
  });
  it("returns unknown for non-trigger nodes", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.httpRequest" }])).toBe("unknown");
  });
  it("returns unknown for empty array", () => {
    expect(deriveTriggerType([])).toBe("unknown");
  });

  // Suffix fallback tests
  it("returns event for shopifyTrigger via suffix fallback", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.shopifyTrigger" }])).toBe("event");
  });
  it("returns event for githubTrigger via suffix fallback", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.githubTrigger" }])).toBe("event");
  });
  it("returns event for telegramTrigger via suffix fallback", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.telegramTrigger" }])).toBe("event");
  });
  it("returns event for stripeTrigger via suffix fallback", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-base.stripeTrigger" }])).toBe("event");
  });
  it("returns event for any unknown *Trigger suffix", () => {
    expect(deriveTriggerType([{ type: "n8n-nodes-community.someFutureTrigger" }])).toBe("event");
  });
  it("prefers webhook over suffix fallback", () => {
    expect(deriveTriggerType([
      { type: "n8n-nodes-base.webhook" },
      { type: "n8n-nodes-base.slackTrigger" },
    ])).toBe("webhook");
  });
  it("prefers schedule over suffix fallback", () => {
    expect(deriveTriggerType([
      { type: "n8n-nodes-base.scheduleTrigger" },
      { type: "n8n-nodes-base.slackTrigger" },
    ])).toBe("schedule");
  });
});

describe("categorizeNodeWithSource()", () => {
  it("marks exact_map", () => {
    expect(categorizeNodeWithSource("n8n-nodes-base.httpRequest")).toEqual({
      category: "http",
      mappingSource: "exact_map",
    });
  });

  it("marks prefix_fallback when EXACT_MAP misses but PREFIX_MAP matches", () => {
    const r = categorizeNodeWithSource("n8n-nodes-base.postgresBackup");
    expect(r.category).toBe("database");
    expect(r.mappingSource).toBe("prefix_fallback");
  });

  it("marks suffix_trigger for unlisted *Trigger types", () => {
    expect(categorizeNodeWithSource("n8n-nodes-base.acmeCorpTrigger")).toEqual({
      category: "trigger",
      mappingSource: "suffix_trigger",
    });
  });

  it("marks unknown for unmapped community types", () => {
    expect(categorizeNodeWithSource("n8n-nodes-community.neverHeardOf")).toEqual({
      category: "unknown",
      mappingSource: "unknown",
    });
  });
});

describe("knownNodeTypes()", () => {
  it("returns an array with more than 350 entries", () => {
    expect(knownNodeTypes().length).toBeGreaterThan(350);
  });
  it("includes core node types", () => {
    const types = knownNodeTypes();
    expect(types).toContain("n8n-nodes-base.httpRequest");
    expect(types).toContain("n8n-nodes-base.slack");
    expect(types).toContain("@n8n/n8n-nodes-langchain.agent");
  });
});
