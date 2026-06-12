/*
 * Author: Jamius Siam
 * Since: 09/06/2026
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SilbylPlugin } from "./main.ts";
import type { PluginContext } from "../../@types/plugin.ts";

const fetchFn = SilbylPlugin.fn;

const context: PluginContext = { configuredPlugins: {}, allPlugins: [], getPlugin: () => null };

function makeResponse({
  ok = true,
  status = 200,
  statusText = "OK",
  json = {},
  text = "",
}: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
  text?: string;
}) {
  return { ok, status, statusText, json: async () => json, text: async () => text };
}

function stubFetch(res: unknown) {
  const mock = vi.fn(async () => res);
  vi.stubGlobal("fetch", mock);
  return mock;
}

let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  envSnapshot = { ...process.env };
  process.env.EXA_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-exa-fetch", () => {
  it("throws when `EXA_API_KEY` is missing", async () => {
    delete process.env.EXA_API_KEY;

    await expect(fetchFn("https://a.com", context)).rejects.toThrow(
      "Missing `EXA_API_KEY` environment variable.",
    );
  });

  it("joins result text, using an empty string for missing text", async () => {
    stubFetch(
      makeResponse({
        json: {
          results: [{ url: "https://a.com", text: "alpha" }, { url: "https://b.com" }],
        },
      }),
    );

    await expect(fetchFn("https://a.com", context)).resolves.toEqual("alpha\n\n");
  });

  it("returns a no-content message when `results` is empty", async () => {
    stubFetch(makeResponse({ json: { results: [] } }));

    await expect(fetchFn("https://a.com", context)).resolves.toEqual(
      "No content for: https://a.com",
    );
  });

  it("throws when the response is not ok", async () => {
    stubFetch(makeResponse({ ok: false, status: 404, statusText: "Not Found", text: "missing" }));

    await expect(fetchFn("https://a.com", context)).rejects.toThrow(
      "Exa fetch failed: 404 Not Found - missing",
    );
  });
});
