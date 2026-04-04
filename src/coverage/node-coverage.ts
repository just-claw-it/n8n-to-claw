import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NodeCategory } from "../ir/types.js";
import {
  categorizeNodeWithSource,
  knownNodeTypes,
  type NodeMappingSource,
} from "../parse/categorize.js";

const STICKY = "n8n-nodes-base.stickyNote";

export interface FixtureNodeScan {
  file: string;
  nodeTypes: string[];
}

export function extractNodeTypesFromWorkflowJson(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null) return [];
  const nodes = (raw as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  const out: string[] = [];
  for (const n of nodes) {
    if (typeof n !== "object" || n === null) continue;
    const t = (n as { type?: unknown }).type;
    if (typeof t !== "string" || t === STICKY) continue;
    out.push(t);
  }
  return out;
}

export async function scanTestFixtures(fixturesDir: string): Promise<FixtureNodeScan[]> {
  const names = await readdir(fixturesDir);
  const jsonFiles = names.filter((f) => f.endsWith(".json")).sort((a, b) => a.localeCompare(b));
  const results: FixtureNodeScan[] = [];
  for (const file of jsonFiles) {
    const raw = JSON.parse(await readFile(join(fixturesDir, file), "utf-8")) as unknown;
    results.push({ file, nodeTypes: extractNodeTypesFromWorkflowJson(raw) });
  }
  return results;
}

export interface TypeUsageRow {
  type: string;
  category: NodeCategory;
  mappingSource: NodeMappingSource;
  occurrences: number;
  fixtures: string[];
}

export function aggregateTypeUsage(scans: FixtureNodeScan[]): TypeUsageRow[] {
  const map = new Map<string, { count: number; fixtures: Set<string> }>();
  for (const scan of scans) {
    for (const t of scan.nodeTypes) {
      const cur = map.get(t) ?? { count: 0, fixtures: new Set<string>() };
      cur.count += 1;
      cur.fixtures.add(scan.file);
      map.set(t, cur);
    }
  }
  const rows: TypeUsageRow[] = [];
  for (const [type, { count, fixtures }] of map) {
    const { category, mappingSource } = categorizeNodeWithSource(type);
    rows.push({
      type,
      category,
      mappingSource,
      occurrences: count,
      fixtures: [...fixtures].sort((a, b) => a.localeCompare(b)),
    });
  }
  rows.sort((a, b) => a.type.localeCompare(b.type));
  return rows;
}

export function buildNodeCoverageMarkdown(options: {
  scans: FixtureNodeScan[];
  typeRows: TypeUsageRow[];
}): string {
  const exactCount = knownNodeTypes().length;
  const bySource: Record<NodeMappingSource, number> = {
    exact_map: 0,
    prefix_fallback: 0,
    suffix_trigger: 0,
    unknown: 0,
  };
  for (const r of options.typeRows) {
    bySource[r.mappingSource] += r.occurrences;
  }
  const byCategory = new Map<NodeCategory, number>();
  for (const r of options.typeRows) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.occurrences);
  }

  const totalInstances = options.typeRows.reduce((a, r) => a + r.occurrences, 0);

  const lines: string[] = [];
  lines.push("# Node coverage dashboard");
  lines.push("");
  lines.push(
    "This file is **generated** — run `npm run coverage:nodes` from the repo root after changing `test-fixtures/` or `src/parse/categorize.ts`."
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|------:|");
  lines.push(`| Explicit entries in \`EXACT_MAP\` | ${exactCount} |`);
  lines.push(`| Workflow JSON files scanned | ${options.scans.length} |`);
  lines.push(`| Unique node-type strings in fixtures | ${options.typeRows.length} |`);
  lines.push(`| Total node instances (non-sticky) | ${totalInstances} |`);
  lines.push("");
  lines.push("### Mapping source (per node *instance* in fixtures)");
  lines.push("");
  lines.push("| Source | Instances |");
  lines.push("|--------|----------:|");
  for (const k of ["exact_map", "prefix_fallback", "suffix_trigger", "unknown"] as const) {
    lines.push(`| \`${k}\` | ${bySource[k]} |`);
  }
  lines.push("");
  lines.push("### Category (instances in fixtures)");
  lines.push("");
  lines.push("| Category | Instances |");
  lines.push("|----------|----------:|");
  const cats = [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [c, n] of cats) {
    lines.push(`| \`${c}\` | ${n} |`);
  }
  lines.push("");
  lines.push("## Fixtures");
  lines.push("");
  lines.push("| File | Nodes (non-sticky) | Unique types |");
  lines.push("|------|-------------------:|-------------:|");
  for (const s of options.scans) {
    const uniq = new Set(s.nodeTypes).size;
    lines.push(`| \`${s.file}\` | ${s.nodeTypes.length} | ${uniq} |`);
  }
  lines.push("");
  lines.push("## Node types in fixtures");
  lines.push("");
  lines.push("| Node type | Category | Mapping source | Occurrences | Fixtures |");
  lines.push("|-----------|----------|----------------|------------:|----------|");
  for (const r of options.typeRows) {
    const fix = r.fixtures.map((f) => `\`${f}\``).join(", ");
    lines.push(
      `| \`${r.type}\` | \`${r.category}\` | \`${r.mappingSource}\` | ${r.occurrences} | ${fix} |`
    );
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- **`exact_map`** — full type string exists in `EXACT_MAP` (`src/parse/categorize.ts`).");
  lines.push("- **`prefix_fallback`** — matched a `PREFIX_MAP` prefix (e.g. Postgres family, webhook, LangChain).");
  lines.push("- **`suffix_trigger`** — short name ends with `Trigger` but the full type was not in `EXACT_MAP`.");
  lines.push(
    "- **`unknown`** — no rule matched; parse emits `unknown_node_type` and the LLM receives raw node JSON."
  );
  lines.push("");
  return lines.join("\n");
}

export async function generateNodeCoverageMarkdown(fixturesDir: string): Promise<string> {
  const scans = await scanTestFixtures(fixturesDir);
  const typeRows = aggregateTypeUsage(scans);
  return buildNodeCoverageMarkdown({ scans, typeRows });
}
