/**
 * Curated OpenAI-compatible providers and example models.
 * The CLI / server only speak the OpenAI chat-completions API; providers that
 * are not compatible must use a gateway (e.g. Claude via OpenRouter).
 *
 * Model IDs change often — users can pick "Custom model…" and type any id.
 */

export const CUSTOM_MODEL_VALUE = "__custom_model__";

export interface LLMProviderPreset {
  id: string;
  label: string;
  /** OpenAI-compatible base URL (no trailing slash) */
  baseUrl: string;
  /** Shown in the API key field */
  apiKeyPlaceholder: string;
  /** If true, an empty key is replaced with `fallbackApiKey` before submit */
  apiKeyOptional: boolean;
  fallbackApiKey: string;
  models: string[];
  /** Short hint under the provider row */
  hint?: string;
}

export const LLM_PROVIDER_PRESETS: LLMProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyPlaceholder: "sk-...",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "o1",
      "o1-mini",
      "o3-mini",
    ],
    hint: "Official OpenAI API.",
  },
  {
    id: "openrouter",
    label: "OpenRouter (Claude, Gemini, many models)",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyPlaceholder: "sk-or-v1-...",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: [
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3.5-haiku",
      "anthropic/claude-3-opus",
      "openai/gpt-4o",
      "google/gemini-pro-1.5",
      "google/gemini-flash-1.5",
      "meta-llama/llama-3.3-70b-instruct",
      "mistralai/mistral-large",
      "x-ai/grok-2",
      "deepseek/deepseek-chat",
    ],
    hint: "One key for many vendors; model string includes the provider prefix.",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKeyPlaceholder: "Not required — leave empty for local Ollama",
    apiKeyOptional: true,
    fallbackApiKey: "ollama",
    models: [
      "llama3.2",
      "llama3.1",
      "llama3.1:70b",
      "mistral",
      "mixtral",
      "qwen2.5",
      "phi3",
      "deepseek-r1",
      "codellama",
    ],
    hint: "Run `ollama serve` on the same machine as this app (127.0.0.1). For Ollama on the host while the app runs in Docker, use “Ollama (Docker / host)” below.",
  },
  {
    id: "ollama-docker",
    label: "Ollama (Docker / host)",
    baseUrl: "http://host.docker.internal:11434/v1",
    apiKeyPlaceholder: "Not required — leave empty for local Ollama",
    apiKeyOptional: true,
    fallbackApiKey: "ollama",
    models: [
      "llama3.2",
      "llama3.1",
      "llama3.1:70b",
      "mistral",
      "mixtral",
      "qwen2.5",
      "phi3",
      "deepseek-r1",
      "codellama",
    ],
    hint: "Default URL reaches Ollama on the host from a Mac/Windows Docker container. On Linux you may need your LAN IP or docker-compose extra_hosts — then edit the base URL.",
  },
  {
    id: "groq",
    label: "Groq (GroqCloud)",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyPlaceholder: "gsk_...",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "groq/compound",
      "groq/compound-mini",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "moonshotai/kimi-k2-instruct-0905",
      "qwen/qwen3-32b",
      "openai/gpt-oss-safeguard-20b",
    ],
    hint: "GroqCloud (groq.com) — not xAI Grok; use the xAI provider for Grok. Model IDs: https://console.groq.com/docs/models",
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    apiKeyPlaceholder: "xai-...",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: ["grok-2-latest", "grok-2", "grok-beta"],
    hint: "See xAI docs for current model names.",
  },
  {
    id: "mistral",
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyPlaceholder: "...",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: [
      "mistral-large-latest",
      "mistral-small-latest",
      "open-mistral-7b",
      "open-mixtral-8x7b",
      "codestral-latest",
    ],
  },
  {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    apiKeyPlaceholder: "...",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "meta-llama/Llama-3.1-70B-Instruct-Turbo",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyPlaceholder: "sk-...",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    apiKeyPlaceholder: "fw_...",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: [
      "accounts/fireworks/models/llama-v3p3-70b-instruct",
      "accounts/fireworks/models/llama-v3p1-70b-instruct",
    ],
    hint: "Model ids often include the accounts/fireworks/models/ prefix.",
  },
  {
    id: "custom",
    label: "Custom (manual base URL)",
    baseUrl: "https://api.openai.com/v1",
    apiKeyPlaceholder: "Your API key",
    apiKeyOptional: false,
    fallbackApiKey: "",
    models: ["gpt-4o"],
    hint: "Set the base URL and model yourself (any OpenAI-compatible endpoint).",
  },
];

export function findPresetByBaseUrl(baseUrl: string): LLMProviderPreset | undefined {
  const n = baseUrl.replace(/\/$/, "");
  return LLM_PROVIDER_PRESETS.find((p) => p.baseUrl.replace(/\/$/, "") === n);
}

export function findPresetById(id: string): LLMProviderPreset | undefined {
  return LLM_PROVIDER_PRESETS.find((p) => p.id === id);
}
