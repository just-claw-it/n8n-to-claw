import type { ParseResponse, TranspileResponse, LLMConfigInput } from "./types";

async function request<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Server responded with ${res.status}`);
  }

  return data as T;
}

export function parseWorkflow(workflow: unknown): Promise<ParseResponse> {
  return request<ParseResponse>("/api/parse", { workflow });
}

export function transpileWorkflow(
  workflow: unknown,
  llmConfig: LLMConfigInput,
): Promise<TranspileResponse> {
  return request<TranspileResponse>("/api/transpile", { workflow, llmConfig });
}
