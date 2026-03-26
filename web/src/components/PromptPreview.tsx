import { useState } from "react";

interface PromptPreviewProps {
  prompt: string;
}

export function PromptPreview({ prompt }: PromptPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="space-y-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-lg font-semibold hover:text-violet-400 transition-colors cursor-pointer"
      >
        <span className={`transition-transform text-sm ${expanded ? "rotate-90" : ""}`}>
          &#9654;
        </span>
        LLM Prompt Preview
      </button>

      {expanded && (
        <div className="relative">
          <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-xs text-zinc-300 overflow-x-auto max-h-96 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed">
            {prompt}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(prompt)}
            className="absolute top-3 right-3 px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 transition-colors cursor-pointer"
          >
            Copy
          </button>
        </div>
      )}
    </section>
  );
}
