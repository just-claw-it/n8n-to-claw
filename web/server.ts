import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env["PORT"] ?? "3847", 10);

async function createApp() {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  // -----------------------------------------------------------------------
  // GET /health — liveness for Docker / load balancers (no auth)
  // -----------------------------------------------------------------------
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "n8n-to-claw-web" });
  });

  // Dynamically import from the parent project's compiled output
  const { parse } = await import("../dist/parse/parser.js");
  const { transpile } = await import("../dist/transpile/transpile.js");
  const { buildTranspilePrompt } = await import("../dist/transpile/prompt.js");

  // -----------------------------------------------------------------------
  // POST /api/parse — parse n8n workflow JSON into IR (no LLM needed)
  // -----------------------------------------------------------------------
  app.post("/api/parse", (req, res) => {
    try {
      const workflow = req.body?.workflow;
      if (!workflow || typeof workflow !== "object") {
        res.status(400).json({ error: "Request body must contain a 'workflow' object." });
        return;
      }

      const ir = parse(workflow);
      const messages = buildTranspilePrompt(ir);
      const prompt = messages.map((m: { role: string; content: string }) =>
        `--- ${m.role.toUpperCase()} ---\n${m.content}`
      ).join("\n\n");

      const nodeById = new Map(ir.nodes.map((n: { id: string; name: string }) => [n.id, n.name]));

      res.json({
        name: ir.name,
        displayName: ir.displayName,
        triggerType: ir.triggerType,
        quality: ir.quality,
        nodes: ir.nodes.map((n: {
          id: string; name: string; type: string; category: string;
          disabled: boolean; hasExpressions: boolean; credentials: { type: string; name: string }[];
        }) => ({
          id: n.id,
          name: n.name,
          type: n.type,
          category: n.category,
          disabled: n.disabled,
          hasExpressions: n.hasExpressions,
          credentialCount: n.credentials.length,
        })),
        edges: ir.edges.map((e: {
          sourceNodeId: string; targetNodeId: string;
          sourceOutputIndex: number; connectionType: string;
        }) => ({
          sourceName: nodeById.get(e.sourceNodeId) ?? e.sourceNodeId,
          targetName: nodeById.get(e.targetNodeId) ?? e.targetNodeId,
          sourceOutputIndex: e.sourceOutputIndex,
          connectionType: e.connectionType,
        })),
        credentials: ir.credentialRefs,
        warnings: ir.warnings.map((w: {
          nodeName: string; nodeType: string; reason: string; detail: string;
        }) => ({
          nodeName: w.nodeName,
          nodeType: w.nodeType,
          reason: w.reason,
          detail: w.detail,
        })),
        prompt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  // -----------------------------------------------------------------------
  // POST /api/transpile — full pipeline: parse + transpile with user's LLM
  // -----------------------------------------------------------------------
  app.post("/api/transpile", async (req, res) => {
    try {
      const { workflow, llmConfig } = req.body ?? {};
      if (!workflow || typeof workflow !== "object") {
        res.status(400).json({ error: "Request body must contain a 'workflow' object." });
        return;
      }
      if (!llmConfig?.baseUrl || !llmConfig?.apiKey || !llmConfig?.model) {
        res.status(400).json({ error: "llmConfig must include baseUrl, apiKey, and model." });
        return;
      }

      const ir = parse(workflow);
      const result = await transpile(ir, {
        baseUrl: llmConfig.baseUrl,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        timeoutMs: 120_000,
        maxRetries: 2,
      });

      const allWarnings = [...ir.warnings, ...result.transpileWarnings];

      res.json({
        status: result.status,
        skillMd: result.output.skillMd,
        skillTs: result.output.skillTs,
        warnings: allWarnings.map((w: {
          nodeName: string; nodeType: string; reason: string; detail: string;
        }) => ({
          nodeName: w.nodeName,
          nodeType: w.nodeType,
          reason: w.reason,
          detail: w.detail,
        })),
        validationError: result.validationError,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("API") ? 502 : 500;
      res.status(status).json({ error: message });
    }
  });

  // -----------------------------------------------------------------------
  // Serve test fixtures for example buttons
  // -----------------------------------------------------------------------
  const fixturesDir = join(__dirname, "..", "test-fixtures");
  if (existsSync(fixturesDir)) {
    app.use("/fixtures", express.static(fixturesDir));
  }

  // -----------------------------------------------------------------------
  // Serve static files in production
  // -----------------------------------------------------------------------
  const clientDir = join(__dirname, "dist", "client");
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(join(clientDir, "index.html"));
    });
  }

  return app;
}

const HOST = process.env["HOST"] ?? "0.0.0.0";

createApp().then((app) => {
  app.listen(PORT, HOST, () => {
    console.log(`n8n-to-claw web server listening on http://${HOST}:${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
