import { describe, it, expect, vi, afterEach } from "vitest";
import {
  callLLM,
  formatLlmNetworkFailureMessage,
  loadLLMConfig,
  LLMError,
  probeLlmConnection,
  type LLMConfig,
} from "../transpile/llm.js";

const BASE_CONFIG: LLMConfig = {
  baseUrl: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "test-model",
  timeoutMs: 5000,
  maxRetries: 2,
};

const GOOD_RESPONSE = JSON.stringify({
  choices: [{ message: { content: "Hello from the LLM" } }],
  usage: { total_tokens: 42 },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadLLMConfig()", () => {
  it("throws LLMError when env vars are missing", () => {
    const saved = {
      base: process.env["LLM_BASE_URL"],
      key: process.env["LLM_API_KEY"],
      model: process.env["LLM_MODEL"],
    };
    delete process.env["LLM_BASE_URL"];
    delete process.env["LLM_API_KEY"];
    delete process.env["LLM_MODEL"];

    expect(() => loadLLMConfig()).toThrow(LLMError);
    expect(() => loadLLMConfig()).toThrow("LLM_BASE_URL");

    if (saved.base !== undefined) process.env["LLM_BASE_URL"] = saved.base;
    if (saved.key !== undefined) process.env["LLM_API_KEY"] = saved.key;
    if (saved.model !== undefined) process.env["LLM_MODEL"] = saved.model;
  });

  it("reads LLM_TIMEOUT_MS from env", () => {
    process.env["LLM_BASE_URL"] = "https://x.com/v1";
    process.env["LLM_API_KEY"] = "k";
    process.env["LLM_MODEL"] = "m";
    process.env["LLM_TIMEOUT_MS"] = "12345";
    const cfg = loadLLMConfig();
    expect(cfg.timeoutMs).toBe(12345);
    delete process.env["LLM_TIMEOUT_MS"];
    delete process.env["LLM_BASE_URL"];
    delete process.env["LLM_API_KEY"];
    delete process.env["LLM_MODEL"];
  });

  it("uses default timeout when LLM_TIMEOUT_MS is absent", () => {
    process.env["LLM_BASE_URL"] = "https://x.com/v1";
    process.env["LLM_API_KEY"] = "k";
    process.env["LLM_MODEL"] = "m";
    delete process.env["LLM_TIMEOUT_MS"];
    const cfg = loadLLMConfig();
    expect(cfg.timeoutMs).toBe(60_000);
    delete process.env["LLM_BASE_URL"];
    delete process.env["LLM_API_KEY"];
    delete process.env["LLM_MODEL"];
  });

  it("reads LLM_MAX_TOKENS from env", () => {
    process.env["LLM_BASE_URL"] = "https://x.com/v1";
    process.env["LLM_API_KEY"] = "k";
    process.env["LLM_MODEL"] = "m";
    process.env["LLM_MAX_TOKENS"] = "2048";
    const cfg = loadLLMConfig();
    expect(cfg.maxOutputTokens).toBe(2048);
    delete process.env["LLM_MAX_TOKENS"];
    delete process.env["LLM_BASE_URL"];
    delete process.env["LLM_API_KEY"];
    delete process.env["LLM_MODEL"];
  });
});

describe("callLLM()", () => {
  it("returns content on a 200 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(GOOD_RESPONSE, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLLM(BASE_CONFIG, [{ role: "user", content: "hi" }]);
    expect(result.content).toBe("Hello from the LLM");
    expect(result.tokensUsed).toBe(42);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(4096);
  });

  it("sends max_tokens from LLMConfig.maxOutputTokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(GOOD_RESPONSE, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    await callLLM(
      { ...BASE_CONFIG, maxOutputTokens: 2048 },
      [{ role: "user", content: "hi" }]
    );
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(2048);
  });

  it("throws LLMError on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401 })
    ));
    await expect(callLLM(BASE_CONFIG, [{ role: "user", content: "hi" }]))
      .rejects.toThrow(LLMError);
    await expect(callLLM(BASE_CONFIG, [{ role: "user", content: "hi" }]))
      .rejects.toThrow("401");
  });

  it("throws LLMError on 404 with hint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 })
    ));
    await expect(callLLM(BASE_CONFIG, [{ role: "user", content: "hi" }]))
      .rejects.toThrow("LLM_BASE_URL");
  });

  it("retries on 429 up to maxRetries then throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Rate limited", {
        status: 429,
        headers: { "retry-after": "0" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const cfg: LLMConfig = { ...BASE_CONFIG, maxRetries: 2 };
    await expect(callLLM(cfg, [{ role: "user", content: "hi" }]))
      .rejects.toThrow(LLMError);
    // Should have been called exactly maxRetries times
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("succeeds on second attempt after 429", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return new Response(GOOD_RESPONSE, { status: 200 });
    }));

    const cfg: LLMConfig = { ...BASE_CONFIG, maxRetries: 3 };
    const result = await callLLM(cfg, [{ role: "user", content: "hi" }]);
    expect(result.content).toBe("Hello from the LLM");
    expect(callCount).toBe(2);
  });

  it("retries on 500 then succeeds", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return new Response("server error", { status: 500 });
      return new Response(GOOD_RESPONSE, { status: 200 });
    }));

    const cfg: LLMConfig = { ...BASE_CONFIG, maxRetries: 3 };
    const result = await callLLM(cfg, [{ role: "user", content: "hi" }]);
    expect(result.content).toBe("Hello from the LLM");
    expect(callCount).toBe(2);
  });

  it("throws LLMError when content field is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 })
    ));
    await expect(callLLM(BASE_CONFIG, [{ role: "user", content: "hi" }]))
      .rejects.toThrow(LLMError);
  });

  it("throws LLMError on non-JSON response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("not json", { status: 200 })
    ));
    await expect(callLLM(BASE_CONFIG, [{ role: "user", content: "hi" }]))
      .rejects.toThrow("non-JSON");
  });

  it("retries on network failure then throws after exhausting retries", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);
    const cfg: LLMConfig = { ...BASE_CONFIG, maxRetries: 2 };
    await expect(callLLM(cfg, [{ role: "user", content: "hi" }]))
      .rejects.toThrow(LLMError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("succeeds on second attempt after network failure", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error("ECONNREFUSED");
      return new Response(GOOD_RESPONSE, { status: 200 });
    }));
    const cfg: LLMConfig = { ...BASE_CONFIG, maxRetries: 3 };
    const result = await callLLM(cfg, [{ role: "user", content: "hi" }]);
    expect(result.content).toBe("Hello from the LLM");
    expect(callCount).toBe(2);
  });

  it("throws after exhausting retries on persistent 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("server error", { status: 500 })
    ));
    const cfg: LLMConfig = { ...BASE_CONFIG, maxRetries: 2 };
    await expect(callLLM(cfg, [{ role: "user", content: "hi" }]))
      .rejects.toThrow("after 2 attempt(s)");
  });

  it("includes localhost / Ollama hints when fetch fails against 127.0.0.1", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);
    const cfg: LLMConfig = {
      ...BASE_CONFIG,
      baseUrl: "http://127.0.0.1:11434/v1",
      maxRetries: 1,
    };
    const err = await callLLM(cfg, [{ role: "user", content: "hi" }]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).message).toContain("Ollama");
    expect((err as LLMError).message).toContain("check-llm");
  });
});

describe("formatLlmNetworkFailureMessage()", () => {
  it("adds local-API hints for localhost URLs", () => {
    const m = formatLlmNetworkFailureMessage("http://127.0.0.1:11434/v1", 2, "fail");
    expect(m).toContain("Local OpenAI-compatible API");
    expect(m).toContain("check-llm");
  });

  it("adds generic hints for remote URLs", () => {
    const m = formatLlmNetworkFailureMessage("https://api.example.com/v1", 1, "fail");
    expect(m).toContain("firewall");
    expect(m).toContain("check-llm");
  });
});

describe("probeLlmConnection()", () => {
  it("returns ok on HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const r = await probeLlmConnection(BASE_CONFIG);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message).toContain("LLM endpoint OK");
  });

  it("returns failure with HTTP body snippet on non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 503 }))
    );
    const r = await probeLlmConnection(BASE_CONFIG);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("503");
      expect(r.message).toContain("nope");
    }
  });
});
