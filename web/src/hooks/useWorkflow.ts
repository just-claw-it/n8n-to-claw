import { useState, useCallback } from "react";
import type { ParseResponse, TranspileResponse, LLMConfigInput } from "../types";
import { parseWorkflow, transpileWorkflow } from "../api";

export type AppStep = "upload" | "parsed" | "transpiling" | "done";

interface WorkflowState {
  step: AppStep;
  rawWorkflow: unknown | null;
  rawJson: string;
  parseResult: ParseResponse | null;
  transpileResult: TranspileResponse | null;
  error: string | null;
  loading: boolean;
}

const INITIAL_STATE: WorkflowState = {
  step: "upload",
  rawWorkflow: null,
  rawJson: "",
  parseResult: null,
  transpileResult: null,
  error: null,
  loading: false,
};

export function useWorkflow() {
  const [state, setState] = useState<WorkflowState>(INITIAL_STATE);

  const setError = useCallback((error: string) => {
    setState((s) => ({ ...s, error, loading: false }));
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const loadWorkflow = useCallback(async (jsonString: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));

    let workflow: unknown;
    try {
      workflow = JSON.parse(jsonString);
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Invalid JSON. Please check your workflow file.",
      }));
      return;
    }

    try {
      const parseResult = await parseWorkflow(workflow);
      setState({
        step: "parsed",
        rawWorkflow: workflow,
        rawJson: jsonString,
        parseResult,
        transpileResult: null,
        error: null,
        loading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({
        ...s,
        loading: false,
        error: `Parse failed: ${msg}`,
      }));
    }
  }, []);

  const startTranspile = useCallback(async (llmConfig: LLMConfigInput) => {
    if (!state.rawWorkflow) return;

    setState((s) => ({ ...s, step: "transpiling", loading: true, error: null }));

    try {
      const result = await transpileWorkflow(state.rawWorkflow, llmConfig);
      setState((s) => ({
        ...s,
        step: "done",
        transpileResult: result,
        loading: false,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({
        ...s,
        step: "parsed",
        loading: false,
        error: `Transpile failed: ${msg}`,
      }));
    }
  }, [state.rawWorkflow]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const backToParsed = useCallback(() => {
    setState((s) => ({
      ...s,
      step: "parsed",
      transpileResult: null,
      error: null,
    }));
  }, []);

  return {
    ...state,
    loadWorkflow,
    startTranspile,
    reset,
    backToParsed,
    setError,
    clearError,
  };
}
