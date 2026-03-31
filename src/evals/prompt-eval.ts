import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { loadFromFile } from "../adapters/file.js";
import { parse } from "../parse/parser.js";
import { buildTranspilePrompt, PROMPT_VERSION } from "../transpile/prompt.js";

export interface PromptFixtureReport {
  fixture: string;
  workflowName: string;
  triggerType: string;
  nodeCount: number;
  edgeCount: number;
  warningCount: number;
  unknownNodeCount: number;
  expressionNodeCount: number;
  credentialRefCount: number;
  promptChars: number;
  estimatedTokens: number;
}

export interface PromptEvalReport {
  promptVersion: string;
  fixtureCount: number;
  totals: {
    nodes: number;
    edges: number;
    warnings: number;
    unknownNodes: number;
    expressionNodes: number;
    credentialRefs: number;
    promptChars: number;
    estimatedTokens: number;
  };
  fixtures: PromptFixtureReport[];
}

function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export async function buildPromptEvalReport(fixturesDir = "test-fixtures"): Promise<PromptEvalReport> {
  const names = await readdir(fixturesDir);
  const fixtureFiles = names
    .filter((name) => extname(name) === ".json")
    .sort((a, b) => a.localeCompare(b));

  const fixtures: PromptFixtureReport[] = [];

  for (const fixtureName of fixtureFiles) {
    const raw = await loadFromFile(join(fixturesDir, fixtureName));
    const ir = parse(raw);
    const messages = buildTranspilePrompt(ir);
    const promptChars = messages.reduce((sum, m) => sum + m.content.length, 0);

    fixtures.push({
      fixture: fixtureName,
      workflowName: ir.displayName,
      triggerType: ir.triggerType,
      nodeCount: ir.nodes.length,
      edgeCount: ir.edges.length,
      warningCount: ir.warnings.length,
      unknownNodeCount: ir.nodes.filter((n) => n.category === "unknown").length,
      expressionNodeCount: ir.nodes.filter((n) => n.hasExpressions).length,
      credentialRefCount: ir.credentialRefs.length,
      promptChars,
      estimatedTokens: estimateTokens(promptChars),
    });
  }

  const totals = fixtures.reduce(
    (acc, item) => {
      acc.nodes += item.nodeCount;
      acc.edges += item.edgeCount;
      acc.warnings += item.warningCount;
      acc.unknownNodes += item.unknownNodeCount;
      acc.expressionNodes += item.expressionNodeCount;
      acc.credentialRefs += item.credentialRefCount;
      acc.promptChars += item.promptChars;
      acc.estimatedTokens += item.estimatedTokens;
      return acc;
    },
    {
      nodes: 0,
      edges: 0,
      warnings: 0,
      unknownNodes: 0,
      expressionNodes: 0,
      credentialRefs: 0,
      promptChars: 0,
      estimatedTokens: 0,
    }
  );

  return {
    promptVersion: PROMPT_VERSION,
    fixtureCount: fixtures.length,
    totals,
    fixtures,
  };
}
