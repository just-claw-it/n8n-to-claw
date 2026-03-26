import { useState, useCallback, useRef } from "react";

const EXAMPLE_FIXTURES = [
  { label: "Postgres → Slack", file: "notify-slack-on-postgres.json" },
  { label: "GitHub PR → Slack", file: "github-webhook-to-slack.json" },
  { label: "AI Support Chatbot", file: "ai-support-chatbot.json" },
  { label: "HN Daily Digest", file: "daily-hacker-news-digest.json" },
  { label: "CRM → Google Sheets", file: "sync-crm-with-custom-nodes.json" },
];

interface UploadPanelProps {
  onSubmit: (json: string) => void;
  loading: boolean;
}

export function UploadPanel({ onSubmit, loading }: UploadPanelProps) {
  const [text, setText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === "string") {
          setText(content);
          onSubmit(content);
        }
      };
      reader.readAsText(file);
    },
    [onSubmit],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const loadExample = useCallback(
    async (filename: string) => {
      try {
        const res = await fetch(`/fixtures/${filename}`);
        if (!res.ok) throw new Error(`Failed to load fixture`);
        const json = await res.text();
        setText(json);
        onSubmit(json);
      } catch {
        setText(`// Failed to load example: ${filename}`);
      }
    },
    [onSubmit],
  );

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Upload your n8n workflow
        </h2>
        <p className="text-zinc-400">
          Paste JSON, drag-and-drop a file, or try one of the examples below.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${
            dragActive
              ? "border-violet-500 bg-violet-500/10"
              : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="space-y-2">
          <div className="text-3xl">
            {dragActive ? "+" : ""}
          </div>
          <p className="text-zinc-300 font-medium">
            {dragActive ? "Drop your file here" : "Drop a .json file here or click to browse"}
          </p>
          <p className="text-sm text-zinc-500">
            Accepts n8n workflow export JSON
          </p>
        </div>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-400">
          Or paste workflow JSON directly:
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"name": "My Workflow", "nodes": [...], "connections": {...}}'
          rows={8}
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm font-mono text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-y"
        />
        <button
          onClick={() => text.trim() && onSubmit(text)}
          disabled={!text.trim() || loading}
          className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? "Parsing..." : "Parse Workflow"}
        </button>
      </div>

      {/* Example fixtures */}
      <div className="space-y-3">
        <p className="text-sm text-zinc-500 text-center">
          Or try an example workflow:
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {EXAMPLE_FIXTURES.map((ex) => (
            <button
              key={ex.file}
              onClick={() => loadExample(ex.file)}
              disabled={loading}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
