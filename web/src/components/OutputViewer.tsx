import { useState, useCallback } from "react";
import type { TranspileResponse } from "../types";

interface OutputViewerProps {
  result: TranspileResponse;
  workflowName: string;
  onReset: () => void;
  onBack: () => void;
}

type Tab = "skill-md" | "skill-ts" | "warnings";

export function OutputViewer({ result, workflowName, onReset, onBack }: OutputViewerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("skill-md");
  const [copied, setCopied] = useState(false);

  const currentContent =
    activeTab === "skill-md"
      ? result.skillMd
      : activeTab === "skill-ts"
        ? result.skillTs
        : JSON.stringify(result.warnings, null, 2);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentContent]);

  const handleDownload = useCallback(() => {
    const files: { name: string; content: string }[] = [
      { name: "SKILL.md", content: result.skillMd },
      { name: "skill.ts", content: result.skillTs },
      { name: "warnings.json", content: JSON.stringify(result.warnings, null, 2) },
    ];

    for (const file of files) {
      const blob = new Blob([file.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [result]);

  const statusColors: Record<string, string> = {
    success: "bg-green-500/20 text-green-400 border-green-500/30",
    draft: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    validation_skip: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };

  const statusLabels: Record<string, string> = {
    success: "Success — TypeScript validated",
    draft: "Draft — needs manual fix",
    validation_skip: "Validation skipped — tsc not available",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Conversion Complete
          </h2>
          <div
            className={`inline-block px-3 py-1 rounded-md border text-sm font-medium ${statusColors[result.status] ?? ""}`}
          >
            {statusLabels[result.status] ?? result.status}
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          Start over
        </button>
      </div>

      {/* Validation error banner */}
      {result.validationError && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
          <p className="font-medium text-red-400 mb-1">TypeScript validation error:</p>
          <pre className="text-red-300 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
            {result.validationError}
          </pre>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-800 flex gap-0">
        {(
          [
            { id: "skill-md" as Tab, label: "SKILL.md" },
            { id: "skill-ts" as Tab, label: "skill.ts" },
            { id: "warnings" as Tab, label: `Warnings (${result.warnings.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative">
        <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm text-zinc-300 overflow-x-auto max-h-[32rem] overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed">
          {currentContent}
        </pre>
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={handleCopy}
            className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 transition-colors cursor-pointer"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t border-zinc-800">
        <button
          onClick={handleDownload}
          className="flex-1 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 font-semibold transition-colors cursor-pointer text-center"
        >
          Download All Files
        </button>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition-colors cursor-pointer"
        >
          Back to Parse
        </button>
      </div>

      {/* CLI equivalent */}
      <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-4 text-sm space-y-2">
        <p className="text-zinc-400">Run this locally with the CLI:</p>
        <code className="block text-xs font-mono text-zinc-300 bg-zinc-900 rounded px-3 py-2">
          npx n8n-to-claw convert {workflowName}.json
        </code>
      </div>
    </div>
  );
}
