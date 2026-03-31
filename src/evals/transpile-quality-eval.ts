import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { loadFromFile } from "../adapters/file.js";
import { parse } from "../parse/parser.js";
import { parseLLMOutput } from "../transpile/output-parser.js";
import { validateTypeScript } from "../transpile/validate.js";
import { PROMPT_VERSION } from "../transpile/prompt.js";

export type QualityOutcome = "success" | "draft" | "validation_skip" | "parse_error";

export interface QualityFixtureResult {
  fixture: string;
  scenario: string;
  parseSuccess: boolean;
  usedRetry: boolean;
  retryRescued: boolean;
  outcome: QualityOutcome;
}

export interface QualityScenarioReport {
  scenario: string;
  fixtureCount: number;
  parseSuccessCount: number;
  usedRetryCount: number;
  retryRescuedCount: number;
  outcomes: Record<QualityOutcome, number>;
  fixtures: QualityFixtureResult[];
}

export interface TranspileQualityEvalReport {
  promptVersion: string;
  tscAvailable: boolean;
  scenarioCount: number;
  scenarios: QualityScenarioReport[];
}

interface ScenarioDefinition {
  name: string;
  attempt1: (workflowName: string) => string;
  attempt2: (workflowName: string) => string;
}

const VALID_SKILL_MD = (workflowName: string): string => `---
name: ${workflowName}
description: Deterministic eval output for quality scoring.
metadata: {"openclaw":{"requires":{"bins":["node"],"env":[]},"emoji":"🧪"}}
---

# ${workflowName}

Generated for transpile quality evaluation.
`;

const VALID_SKILL_TS = `#!/usr/bin/env node
import { argv } from "node:process";

const name = argv[2] ?? "world";
console.log(\`hello \${name}\`);
`;

const BROKEN_SKILL_TS = `#!/usr/bin/env node
const x: string = 42;
console.log(x);
`;

const INVALID_OUTPUT = "This response is missing required fenced code blocks.";

function makeRawOutput(skillMd: string, skillTs: string): string {
  return `\`\`\`skill-md\n${skillMd}\n\`\`\`\n\n\`\`\`typescript\n${skillTs}\n\`\`\``;
}

const SCENARIOS: ScenarioDefinition[] = [
  {
    name: "valid_first_try",
    attempt1: (workflowName) => makeRawOutput(VALID_SKILL_MD(workflowName), VALID_SKILL_TS),
    attempt2: (workflowName) => makeRawOutput(VALID_SKILL_MD(workflowName), VALID_SKILL_TS),
  },
  {
    name: "fixed_on_retry",
    attempt1: (workflowName) => makeRawOutput(VALID_SKILL_MD(workflowName), BROKEN_SKILL_TS),
    attempt2: (workflowName) => makeRawOutput(VALID_SKILL_MD(workflowName), VALID_SKILL_TS),
  },
  {
    name: "still_broken_after_retry",
    attempt1: (workflowName) => makeRawOutput(VALID_SKILL_MD(workflowName), BROKEN_SKILL_TS),
    attempt2: (workflowName) => makeRawOutput(VALID_SKILL_MD(workflowName), BROKEN_SKILL_TS),
  },
  {
    name: "unparseable_first_try",
    attempt1: () => INVALID_OUTPUT,
    attempt2: (workflowName) => makeRawOutput(VALID_SKILL_MD(workflowName), VALID_SKILL_TS),
  },
];

async function detectTscAvailability(): Promise<boolean> {
  const probe = await validateTypeScript("const ok: string = 'x'; console.log(ok);");
  return probe.valid === true;
}

async function evaluateSingleFixture(
  fixture: string,
  scenario: ScenarioDefinition,
  fixturesDir: string
): Promise<QualityFixtureResult> {
  const raw = await loadFromFile(join(fixturesDir, fixture));
  const ir = parse(raw);
  const workflowName = ir.name;

  const raw1 = scenario.attempt1(workflowName);
  let parsed1: ReturnType<typeof parseLLMOutput>;
  try {
    parsed1 = parseLLMOutput(raw1);
  } catch {
    return {
      fixture,
      scenario: scenario.name,
      parseSuccess: false,
      usedRetry: false,
      retryRescued: false,
      outcome: "parse_error",
    };
  }

  const v1 = await validateTypeScript(parsed1.skillTs);
  if (v1.valid) {
    return {
      fixture,
      scenario: scenario.name,
      parseSuccess: true,
      usedRetry: false,
      retryRescued: false,
      outcome: "success",
    };
  }

  if (v1.error?.includes("tsc not found") || v1.error?.includes("skipping validation")) {
    return {
      fixture,
      scenario: scenario.name,
      parseSuccess: true,
      usedRetry: false,
      retryRescued: false,
      outcome: "validation_skip",
    };
  }

  const raw2 = scenario.attempt2(workflowName);
  let parsed2: ReturnType<typeof parseLLMOutput>;
  try {
    parsed2 = parseLLMOutput(raw2);
  } catch {
    return {
      fixture,
      scenario: scenario.name,
      parseSuccess: true,
      usedRetry: true,
      retryRescued: false,
      outcome: "parse_error",
    };
  }

  const v2 = await validateTypeScript(parsed2.skillTs);
  if (v2.valid) {
    return {
      fixture,
      scenario: scenario.name,
      parseSuccess: true,
      usedRetry: true,
      retryRescued: true,
      outcome: "success",
    };
  }

  if (v2.error?.includes("tsc not found") || v2.error?.includes("skipping validation")) {
    return {
      fixture,
      scenario: scenario.name,
      parseSuccess: true,
      usedRetry: true,
      retryRescued: false,
      outcome: "validation_skip",
    };
  }

  return {
    fixture,
    scenario: scenario.name,
    parseSuccess: true,
    usedRetry: true,
    retryRescued: false,
    outcome: "draft",
  };
}

export async function buildTranspileQualityEvalReport(
  fixturesDir = "test-fixtures"
): Promise<TranspileQualityEvalReport> {
  const names = await readdir(fixturesDir);
  const fixtureFiles = names
    .filter((name) => extname(name) === ".json")
    .sort((a, b) => a.localeCompare(b));

  const scenarios: QualityScenarioReport[] = [];

  for (const scenario of SCENARIOS) {
    const fixtureResults: QualityFixtureResult[] = [];
    for (const fixture of fixtureFiles) {
      fixtureResults.push(await evaluateSingleFixture(fixture, scenario, fixturesDir));
    }

    const outcomes: Record<QualityOutcome, number> = {
      success: 0,
      draft: 0,
      validation_skip: 0,
      parse_error: 0,
    };
    let parseSuccessCount = 0;
    let usedRetryCount = 0;
    let retryRescuedCount = 0;

    for (const result of fixtureResults) {
      outcomes[result.outcome] += 1;
      if (result.parseSuccess) parseSuccessCount += 1;
      if (result.usedRetry) usedRetryCount += 1;
      if (result.retryRescued) retryRescuedCount += 1;
    }

    scenarios.push({
      scenario: scenario.name,
      fixtureCount: fixtureResults.length,
      parseSuccessCount,
      usedRetryCount,
      retryRescuedCount,
      outcomes,
      fixtures: fixtureResults,
    });
  }

  return {
    promptVersion: PROMPT_VERSION,
    tscAvailable: await detectTscAvailability(),
    scenarioCount: scenarios.length,
    scenarios,
  };
}
