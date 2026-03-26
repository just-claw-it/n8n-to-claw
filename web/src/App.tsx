import { useState } from "react";
import { Layout } from "./components/Layout";
import { UploadPanel } from "./components/UploadPanel";
import { ParseResults } from "./components/ParseResults";
import { TranspileForm } from "./components/TranspileForm";
import { OutputViewer } from "./components/OutputViewer";
import { useWorkflow } from "./hooks/useWorkflow";
import type { LLMConfigInput } from "./types";

export default function App() {
  const {
    step,
    parseResult,
    transpileResult,
    error,
    loading,
    loadWorkflow,
    startTranspile,
    reset,
    backToParsed,
    clearError,
  } = useWorkflow();

  const [showLLMForm, setShowLLMForm] = useState(false);

  const handleTranspileClick = () => {
    setShowLLMForm(true);
  };

  const handleTranspileSubmit = (config: LLMConfigInput) => {
    setShowLLMForm(false);
    startTranspile(config);
  };

  const handleTranspileCancel = () => {
    setShowLLMForm(false);
  };

  const handleReset = () => {
    setShowLLMForm(false);
    reset();
  };

  return (
    <Layout>
      {/* Error banner */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300 ml-4 text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading overlay for transpiling */}
      {step === "transpiling" && (
        <div className="mb-6 px-4 py-6 rounded-lg bg-violet-500/5 border border-violet-500/20 text-center space-y-3">
          <div className="flex justify-center">
            <svg className="animate-spin h-8 w-8 text-violet-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-violet-300 font-medium">Transpiling with your LLM...</p>
          <p className="text-sm text-zinc-500">
            This may take 30-60 seconds depending on your model and workflow size.
          </p>
        </div>
      )}

      {/* Step views */}
      {step === "upload" && (
        <UploadPanel onSubmit={loadWorkflow} loading={loading} />
      )}

      {step === "parsed" && parseResult && !showLLMForm && (
        <ParseResults
          result={parseResult}
          onTranspile={handleTranspileClick}
          onReset={handleReset}
        />
      )}

      {step === "parsed" && showLLMForm && (
        <TranspileForm
          onSubmit={handleTranspileSubmit}
          onCancel={handleTranspileCancel}
          loading={loading}
        />
      )}

      {step === "done" && transpileResult && parseResult && (
        <OutputViewer
          result={transpileResult}
          workflowName={parseResult.name}
          onReset={handleReset}
          onBack={backToParsed}
        />
      )}
    </Layout>
  );
}
