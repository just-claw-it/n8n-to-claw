import { useState, useEffect, useMemo } from "react";
import type { LLMConfigInput } from "../types";
import {
  LLM_PROVIDER_PRESETS,
  CUSTOM_MODEL_VALUE,
  findPresetById,
  findPresetByBaseUrl,
  type LLMProviderPreset,
} from "../llmPresets";

const STORAGE_KEY = "n8n-to-claw:llm-config-v2";

interface SavedLlm {
  presetId?: string;
  baseUrl?: string;
  model?: string;
}

function loadSaved(): SavedLlm {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return tryLegacyStorage();
    return JSON.parse(raw) as SavedLlm;
  } catch {
    return tryLegacyStorage();
  }
}

/** Migrate v1 saves that only had baseUrl + model */
function tryLegacyStorage(): SavedLlm {
  try {
    const raw = localStorage.getItem("n8n-to-claw:llm-config");
    if (!raw) return {};
    const o = JSON.parse(raw) as { baseUrl?: string; model?: string };
    const preset = o.baseUrl ? findPresetByBaseUrl(o.baseUrl) : undefined;
    return {
      presetId: preset?.id,
      baseUrl: o.baseUrl,
      model: o.model,
    };
  } catch {
    return {};
  }
}

function saveToStorage(presetId: string, baseUrl: string, model: string): void {
  const payload: SavedLlm = { presetId, baseUrl, model };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

interface TranspileFormProps {
  onSubmit: (config: LLMConfigInput) => void;
  onCancel: () => void;
  loading: boolean;
}

export function TranspileForm({ onSubmit, onCancel, loading }: TranspileFormProps) {
  const defaultPreset = LLM_PROVIDER_PRESETS[0]!;
  const [providerId, setProviderId] = useState(defaultPreset.id);
  const [baseUrl, setBaseUrl] = useState(defaultPreset.baseUrl);
  const [modelSelect, setModelSelect] = useState(defaultPreset.models[0] ?? "");
  const [customModel, setCustomModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  const preset = useMemo(
    () => findPresetById(providerId) ?? defaultPreset,
    [providerId, defaultPreset],
  );

  useEffect(() => {
    const saved = loadSaved();
    if (!saved.baseUrl && !saved.model && !saved.presetId) return;

    let p: LLMProviderPreset | undefined;
    if (saved.presetId) p = findPresetById(saved.presetId);
    if (!p && saved.baseUrl) p = findPresetByBaseUrl(saved.baseUrl);
    if (!p && saved.baseUrl?.includes("11434")) {
      p = saved.baseUrl.includes("host.docker.internal")
        ? findPresetById("ollama-docker")
        : findPresetById("ollama");
    }
    if (!p) p = findPresetById("custom") ?? defaultPreset;

    setProviderId(p.id);
    setBaseUrl(saved.baseUrl ?? p.baseUrl);

    const m = saved.model?.trim();
    if (m && p.models.includes(m)) {
      setModelSelect(m);
      setCustomModel("");
    } else if (m) {
      setModelSelect(CUSTOM_MODEL_VALUE);
      setCustomModel(m);
    } else {
      setModelSelect(p.models[0] ?? "");
      setCustomModel("");
    }
  }, []);

  const effectiveModel =
    modelSelect === CUSTOM_MODEL_VALUE ? customModel.trim() : modelSelect;

  const handleProviderChange = (id: string) => {
    setProviderId(id);
    const next = findPresetById(id);
    if (!next) return;
    setBaseUrl(next.baseUrl);
    setModelSelect(next.models[0] ?? "");
    setCustomModel("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key =
      preset.apiKeyOptional && !apiKey.trim()
        ? preset.fallbackApiKey
        : apiKey.trim();
    const config: LLMConfigInput = {
      baseUrl: baseUrl.trim().replace(/\/$/, ""),
      apiKey: key,
      model: effectiveModel,
    };
    saveToStorage(preset.id, config.baseUrl, effectiveModel);
    onSubmit(config);
  };

  const apiKeyOk = preset.apiKeyOptional || apiKey.trim().length > 0;
  const isValid =
    baseUrl.trim().length > 0 && effectiveModel.length > 0 && apiKeyOk;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">LLM Configuration</h2>
        <p className="text-zinc-400 text-sm">
          Choose an OpenAI-compatible provider and model. Your API key is sent to this server only to
          call the provider — it is not stored on disk.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="provider" className="block text-sm font-medium text-zinc-300">
            Provider
          </label>
          <select
            id="provider"
            value={providerId}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 cursor-pointer"
          >
            {LLM_PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {preset.hint && <p className="text-xs text-zinc-500">{preset.hint}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="baseUrl" className="block text-sm font-medium text-zinc-300">
            API base URL
          </label>
          <input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 font-mono text-xs"
          />
          <p className="text-xs text-zinc-500">
            Must expose <code className="text-zinc-400">POST /v1/chat/completions</code> in OpenAI
            format. Override if you use a proxy or tunnel.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="model" className="block text-sm font-medium text-zinc-300">
            Model
          </label>
          <select
            id="model"
            value={modelSelect}
            onChange={(e) => setModelSelect(e.target.value)}
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 cursor-pointer"
          >
            {preset.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={CUSTOM_MODEL_VALUE}>Custom model…</option>
          </select>
          {modelSelect === CUSTOM_MODEL_VALUE && (
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="Exact model id from provider docs"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 font-mono text-xs mt-2"
            />
          )}
          <p className="text-xs text-zinc-500">
            Lists are examples only — providers rename models often. Use &quot;Custom model…&quot; when
            yours is not listed.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="apiKey" className="block text-sm font-medium text-zinc-300">
            API key
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={preset.apiKeyPlaceholder}
            autoComplete="off"
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
          />
          <p className="text-xs text-zinc-500">
            {preset.apiKeyOptional
              ? "Optional for local Ollama; a placeholder is sent if empty."
              : "Not persisted in the browser by default (only URL + model are saved)."}
          </p>
        </div>

        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={!isValid || loading}
            className="flex-1 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Transpiling...
              </span>
            ) : (
              "Start Transpilation"
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
