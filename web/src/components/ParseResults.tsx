import type { ParseResponse } from "../types";
import { PromptPreview } from "./PromptPreview";

interface ParseResultsProps {
  result: ParseResponse;
  onTranspile: () => void;
  onReset: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  trigger: "bg-green-500/20 text-green-400",
  webhook: "bg-blue-500/20 text-blue-400",
  http: "bg-cyan-500/20 text-cyan-400",
  database: "bg-amber-500/20 text-amber-400",
  transform: "bg-purple-500/20 text-purple-400",
  flow: "bg-pink-500/20 text-pink-400",
  email: "bg-orange-500/20 text-orange-400",
  file: "bg-teal-500/20 text-teal-400",
  unknown: "bg-red-500/20 text-red-400",
};

const TRIGGER_LABELS: Record<string, string> = {
  webhook: "Webhook (HTTP inbound)",
  schedule: "Schedule (cron / interval)",
  manual: "Manual (on demand)",
  event: "Event (external bus)",
  unknown: "Unknown",
};

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

export function ParseResults({ result, onTranspile, onReset }: ParseResultsProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {result.displayName}
          </h2>
          <p className="text-sm text-zinc-400 font-mono">{result.name}</p>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          Start over
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Trigger" value={TRIGGER_LABELS[result.triggerType] ?? result.triggerType} />
        <SummaryCard label="Nodes" value={String(result.nodes.length)} />
        <SummaryCard label="Edges" value={String(result.edges.length)} />
        <SummaryCard label="Warnings" value={String(result.warnings.length)} />
      </div>

      {/* Node table */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Nodes</h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/80 text-zinc-400 text-left">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium text-center">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {result.nodes.map((node) => (
                <tr key={node.id} className={`${node.disabled ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-zinc-200">
                    {node.name}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">
                    {node.type}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge color={CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.unknown}>
                      {node.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-center space-x-1">
                    {node.disabled && (
                      <Badge color="bg-zinc-600/30 text-zinc-400">disabled</Badge>
                    )}
                    {node.hasExpressions && (
                      <Badge color="bg-yellow-500/20 text-yellow-400">expr</Badge>
                    )}
                    {node.credentialCount > 0 && (
                      <Badge color="bg-sky-500/20 text-sky-400">creds</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edges */}
      {result.edges.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Edges</h3>
          <div className="space-y-1.5">
            {result.edges.map((edge, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-zinc-400 font-mono">
                <span className="text-zinc-200">{edge.sourceName}</span>
                <span className="text-zinc-500">
                  [{edge.sourceOutputIndex}]
                </span>
                <span className="text-violet-400">&rarr;</span>
                <span className="text-zinc-200">{edge.targetName}</span>
                {edge.connectionType !== "main" && (
                  <Badge color="bg-indigo-500/20 text-indigo-400">
                    {edge.connectionType}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Credentials */}
      {result.credentials.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Credentials</h3>
          <div className="flex flex-wrap gap-2">
            {result.credentials.map((cred, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm">
                <span className="text-sky-400 font-mono">{cred.type}</span>
                <span className="text-zinc-500">&mdash;</span>
                <span className="text-zinc-300">{cred.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Warnings</h3>
          <div className="space-y-2">
            {result.warnings.map((w, i) => (
              <div key={i} className="px-4 py-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color="bg-amber-500/20 text-amber-400">{w.reason}</Badge>
                  <span className="text-zinc-400 font-mono text-xs">{w.nodeName}</span>
                </div>
                <p className="text-zinc-300">{w.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prompt preview */}
      <PromptPreview prompt={result.prompt} />

      {/* Action buttons */}
      <div className="flex gap-4 pt-4 border-t border-zinc-800">
        <button
          onClick={onTranspile}
          className="flex-1 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 font-semibold transition-colors cursor-pointer text-center"
        >
          Transpile with LLM
        </button>
        <button
          onClick={onReset}
          className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition-colors cursor-pointer"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
