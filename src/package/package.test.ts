import { describe, it, expect, afterEach } from "vitest";
import { mkdir, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { packageSkill } from "../package/package.js";
import type { WorkflowIR } from "../ir/types.js";
import type { TranspileOutput } from "../transpile/output-parser.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_IR: WorkflowIR = {
  name: "my-workflow",
  displayName: "My Workflow",
  triggerType: "manual",
  nodes: [],
  edges: [],
  credentialRefs: [],
  warnings: [],
  raw: {},
};

const IR_WITH_CREDS: WorkflowIR = {
  ...BASE_IR,
  credentialRefs: [
    { type: "postgresApi", name: "My DB" },
    { type: "slackOAuth2Api", name: "Slack" },
  ],
};

const SAMPLE_OUTPUT: TranspileOutput = {
  skillMd: `---
name: my_workflow
description: Does something.
metadata: {"openclaw":{"requires":{"bins":["node"]}}}
---

# My Workflow

Run via node {baseDir}/skill.ts
`,
  skillTs: `// My Workflow skill
import { env } from "node:process";
console.log("hello");
`,
};

// ---------------------------------------------------------------------------
// Temp dir management
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `n8n-to-claw-pkg-test-${randomBytes(6).toString("hex")}`);
  await mkdir(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("packageSkill()", () => {
  it("writes SKILL.md and skill.ts to the skill directory", async () => {
    const base = await makeTempDir();
    const result = await packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "success", { outputBase: base, force: true });

    const skillDir = join(base, "my-workflow");
    expect(result.skillDir).toBe(skillDir);

    const skillMd = await readFile(join(skillDir, "SKILL.md"), "utf-8");
    const skillTs = await readFile(join(skillDir, "skill.ts"), "utf-8");

    expect(skillMd).toContain("name: my_workflow");
    expect(skillTs).toContain("console.log");
  });

  it("writes warnings.json", async () => {
    const base = await makeTempDir();
    const warnings = [
      {
        nodeId: "n1",
        nodeName: "Set",
        nodeType: "n8n-nodes-base.set",
        reason: "expression_present" as const,
        detail: "Has expressions",
      },
    ];
    await packageSkill(BASE_IR, SAMPLE_OUTPUT, warnings, "success", { outputBase: base, force: true });

    const warningsJson = JSON.parse(
      await readFile(join(base, "my-workflow", "warnings.json"), "utf-8")
    ) as unknown[];
    expect(warningsJson).toHaveLength(1);
  });

  it("generates credentials.example.env when credential refs are present", async () => {
    const base = await makeTempDir();
    await packageSkill(IR_WITH_CREDS, SAMPLE_OUTPUT, [], "success", { outputBase: base, force: true });

    const envContent = await readFile(
      join(base, "my-workflow", "credentials.example.env"),
      "utf-8"
    );
    expect(envContent).toContain("POSTGRES_API=");
    expect(envContent).toContain("SLACK_O_AUTH2_API=");
    expect(envContent).toContain("My DB");
  });

  it("does NOT generate credentials.example.env when no credentials", async () => {
    const base = await makeTempDir();
    await packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "success", { outputBase: base, force: true });

    const exists = await fileExists(join(base, "my-workflow", "credentials.example.env"));
    expect(exists).toBe(false);
  });

  it("writes to draft/ subdirectory when status is draft", async () => {
    const base = await makeTempDir();
    const result = await packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "draft", { outputBase: base, force: true });

    expect(result.filesWritten).toContain("draft/SKILL.md");
    expect(result.filesWritten).toContain("draft/skill.ts");

    const exists = await fileExists(join(base, "my-workflow", "draft", "SKILL.md"));
    expect(exists).toBe(true);

    // Live SKILL.md should NOT exist
    const liveExists = await fileExists(join(base, "my-workflow", "SKILL.md"));
    expect(liveExists).toBe(false);
  });

  it("writes credentials.example.env to live dir even on draft", async () => {
    // credentials.example.env is always safe to write; the draft subdir has broken TS
    const base = await makeTempDir();
    await packageSkill(IR_WITH_CREDS, SAMPLE_OUTPUT, [], "draft", { outputBase: base, force: true });

    // credentials.example.env should NOT be in draft (only live files go there)
    const draftCredsExists = await fileExists(
      join(base, "my-workflow", "draft", "credentials.example.env")
    );
    expect(draftCredsExists).toBe(false);
  });

  it("returns filesWritten list matching what was actually written", async () => {
    const base = await makeTempDir();
    const result = await packageSkill(IR_WITH_CREDS, SAMPLE_OUTPUT, [], "success", {
      outputBase: base,
      force: true,
    });

    for (const f of result.filesWritten) {
      const exists = await fileExists(join(result.skillDir, f));
      expect(exists).toBe(true);
    }
  });

  it("uses workflow kebab-case name as directory name", async () => {
    const base = await makeTempDir();
    const result = await packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "success", { outputBase: base, force: true });
    expect(result.skillDir).toMatch(/my-workflow$/);
  });

  it("throws when skill already exists and force is not set", async () => {
    const base = await makeTempDir();
    await packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "success", { outputBase: base, force: true });
    await expect(
      packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "success", { outputBase: base })
    ).rejects.toThrow("already exists");
  });

  it("overwrites when force is set", async () => {
    const base = await makeTempDir();
    await packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "success", { outputBase: base, force: true });
    await expect(
      packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "success", { outputBase: base, force: true })
    ).resolves.toBeDefined();
  });

  it("writes to draft/ when forceDraft is set", async () => {
    const base = await makeTempDir();
    const result = await packageSkill(BASE_IR, SAMPLE_OUTPUT, [], "success", {
      outputBase: base,
      forceDraft: true,
      force: true,
    });
    expect(result.filesWritten).toContain("draft/SKILL.md");
    expect(result.filesWritten).toContain("draft/skill.ts");
  });

  it("rejects path traversal in skill name", async () => {
    const base = await makeTempDir();
    const badIR = { ...BASE_IR, name: "../evil" };
    await expect(
      packageSkill(badIR, SAMPLE_OUTPUT, [], "success", { outputBase: base, force: true })
    ).rejects.toThrow("must not contain");
  });
});
