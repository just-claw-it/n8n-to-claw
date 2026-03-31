#!/usr/bin/env node
// Golden stub: ai-support-chatbot — n8n-to-claw snapshot test
import { env } from "node:process";

const base = env["LLM_BASE_URL"] ?? "";
const key = env["LLM_API_KEY"] ?? "";
const model = env["LLM_MODEL"] ?? "";
if (!base || !key || !model) {
  console.error("LLM_BASE_URL, LLM_API_KEY, LLM_MODEL required for golden stub check");
  process.exit(1);
}
console.log(JSON.stringify({ workflow: "ai-support-chatbot", model }));
