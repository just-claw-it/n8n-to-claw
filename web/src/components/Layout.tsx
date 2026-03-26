import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-sm">
              n8
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              n8n-to-claw
            </h1>
          </div>
          <a
            href="https://github.com/just-claw-it/n8n-to-claw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-zinc-800 py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-zinc-500">
          Convert n8n workflows to OpenClaw skills. Powered by your own LLM.
        </div>
      </footer>
    </div>
  );
}
