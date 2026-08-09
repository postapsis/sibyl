/*
 * Author: Jamius Siam
 * Since: 18/06/2026
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { SilbylPlugin } from "./main.ts";
import type { FetchPlugin, PluginContext } from "../../@types/plugin.ts";

vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (modelName: string) => ({ provider: "openai", modelName })),
}));

const askFn = SilbylPlugin.fn;
const mockedGenerateText = vi.mocked(generateText);

function resolveAnswer(text: string): void {
  // @ts-expect-error Complicated type in mocked return, ignoring for now.
  mockedGenerateText.mockResolvedValue({ text });
}

function makeContext(fetchFn?: (url: string) => Promise<string>): PluginContext {
  const fetchPlugin: FetchPlugin | undefined = fetchFn
    ? { name: "mock-fetch", type: "fetch", fn: (url) => fetchFn(url) }
    : undefined;

  return {
    configuredPlugins: fetchPlugin ? { fetch: fetchPlugin } : {},
    allPlugins: fetchPlugin ? [fetchPlugin] : [],
    getPlugin: () => null,
  };
}

const okContext = makeContext(async () => "page body content");

let timeoutSpy: ReturnType<typeof vi.spyOn>;
let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
  envSnapshot = { ...process.env };
  process.env.SIBYL_AI_PROVIDER = "openai";
  process.env.SIBYL_MODEL_NAME = "gpt-test";
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.SIBYL_ASK_TIMEOUT;
  delete process.env.SIBYL_FETCH_TIMEOUT;

  mockedGenerateText.mockReset();
  resolveAnswer("the answer");
});

afterEach(() => {
  timeoutSpy.mockRestore();
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-ai-ask", () => {
  it("throws when no `fetch` plugin is configured", async () => {
    await expect(askFn("https://a.com", "what?", makeContext())).rejects.toThrow(
      "No `fetch` plugin configured. The `ask` plugin reads the URL through the configured " +
        "fetch plugin — set `plugins.fetch` in `~/.config/sibyl/config.json`.",
    );
  });

  it("throws when `SIBYL_AI_PROVIDER` is missing or invalid", async () => {
    process.env.SIBYL_AI_PROVIDER = "gemini";

    await expect(askFn("https://a.com", "what?", okContext)).rejects.toThrow(
      "Missing or invalid `SIBYL_AI_PROVIDER` environment variable.",
    );
  });

  it("throws when `SIBYL_MODEL_NAME` is missing", async () => {
    delete process.env.SIBYL_MODEL_NAME;

    await expect(askFn("https://a.com", "what?", okContext)).rejects.toThrow(
      "Missing `SIBYL_MODEL_NAME` environment variable.",
    );
  });

  it("throws when the provider API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(askFn("https://a.com", "what?", okContext)).rejects.toThrow(
      "Missing `OPENAI_API_KEY` environment variable.",
    );
  });

  it("throws when the fetch service is unreachable", async () => {
    const context = makeContext(() => Promise.reject(new Error("ECONNREFUSED")));

    await expect(askFn("https://a.com", "what?", context)).rejects.toThrow(
      /Failed to fetch `https:\/\/a\.com` using the configured fetch plugin `mock-fetch`/,
    );
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it("throws when the fetched content is empty", async () => {
    const context = makeContext(async () => "   ");

    await expect(askFn("https://a.com", "what?", context)).rejects.toThrow(
      "No content fetched from: https://a.com",
    );
  });

  it("throws when the AI provider is unreachable", async () => {
    mockedGenerateText.mockRejectedValue(new Error("fetch failed"));

    await expect(askFn("https://a.com", "what?", okContext)).rejects.toThrow(
      /AI provider `openai` failed to answer/,
    );
  });

  it("uses the default generation timeout", async () => {
    const answer = await askFn("https://a.com", "what is it about?", okContext);

    expect(answer).toBe("the answer");
    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("Reply with just the answer"),
        prompt: expect.stringContaining("page body content"),
        abortSignal: expect.any(AbortSignal),
      }),
    );
    expect(mockedGenerateText.mock.calls[0]?.[0]?.prompt).toContain("what is it about?");
  });

  it("uses the ask timeout rather than the fetch timeout for generation", async () => {
    process.env.SIBYL_FETCH_TIMEOUT = "5678";
    process.env.SIBYL_ASK_TIMEOUT = "12345";
    const timeoutSignal = new AbortController().signal;
    timeoutSpy.mockReturnValue(timeoutSignal);

    await askFn("https://a.com", "what is it about?", okContext);

    expect(timeoutSpy).toHaveBeenCalledWith(12345);
    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: timeoutSignal }),
    );
  });
});
