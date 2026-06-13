/*
 * Author: Jamius Siam
 * Since: 13/06/2026
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SilbylPlugin } from "./main.ts";
import type { PluginContext } from "../../@types/plugin.ts";

const searchFn = SilbylPlugin.fn;

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
  process.env.ALTERLAB_API_KEY = "test-key";
  delete process.env.SIBYL_SHOW_SEARCH_DESCRIPTION;
  delete process.env.SIBYL_SEARCH_RESULTS_LIMIT;
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-alterlab-search", () => {
  it("throws when `ALTERLAB_API_KEY` is missing", async () => {
    delete process.env.ALTERLAB_API_KEY;

    await expect(searchFn("react vite", context)).rejects.toThrow(
      "Missing `ALTERLAB_API_KEY` environment variable.",
    );
  });

  it("throws when the response is not ok", async () => {
    stubFetch(
      makeResponse({ ok: false, status: 500, statusText: "Internal Server Error", text: "boom" }),
    );

    await expect(searchFn("react vite", context)).rejects.toThrow(
      "AlterLab search failed: 500 Internal Server Error - boom",
    );
  });

  it("formats results as title + url", async () => {
    stubFetch(
      makeResponse({
        json: {
          query: "react vite",
          results: [
            { url: "https://a.com", title: "First", snippet: "ignored", position: 1 },
            { url: "https://b.com", title: "Second", snippet: "ignored", position: 2 },
          ],
        },
      }),
    );

    await expect(searchFn("react vite", context)).resolves.toEqual(
      "First\nhttps://a.com\n\nSecond\nhttps://b.com",
    );
  });

  it("appends the snippet and strips a localized date prefix when the show description flag is enabled", async () => {
    process.env.SIBYL_SHOW_SEARCH_DESCRIPTION = "true";
    stubFetch(
      makeResponse({
        json: {
          query: "react vite",
          results: [
            {
              url: "https://a.com",
              title: "First",
              snippet: "2025年9月15日 · real text",
              position: 1,
            },
            { url: "https://b.com", title: "Second", snippet: "", position: 2 },
          ],
        },
      }),
    );

    await expect(searchFn("react vite", context)).resolves.toEqual(
      "First\nhttps://a.com\nreal text\n\nSecond\nhttps://b.com",
    );
  });

  it("returns a no-results message when `results` is empty", async () => {
    stubFetch(makeResponse({ json: { query: "react vite", results: [] } }));

    await expect(searchFn("react vite", context)).resolves.toEqual("No results for: react vite");
  });

  it("returns a no-results message when the response body is null", async () => {
    stubFetch(makeResponse({ json: null }));

    await expect(searchFn("react vite", context)).resolves.toEqual("No results for: react vite");
  });

  it("posts to the AlterLab search api with the api key header and query body", async () => {
    const fetchMock = stubFetch(makeResponse({ json: { query: "react vite", results: [] } }));

    await searchFn("react vite", context);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.alterlab.io/api/v1/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-API-Key": "test-key" }),
        body: JSON.stringify({ query: "react vite", num_results: 10 }),
      }),
    );
  });

  it("requests and slices to `SIBYL_SEARCH_RESULTS_LIMIT`", async () => {
    process.env.SIBYL_SEARCH_RESULTS_LIMIT = "2";
    const fetchMock = stubFetch(
      makeResponse({
        json: {
          query: "react vite",
          results: [
            { url: "https://a.com", title: "First", snippet: "", position: 1 },
            { url: "https://b.com", title: "Second", snippet: "", position: 2 },
            { url: "https://c.com", title: "Third", snippet: "", position: 3 },
          ],
        },
      }),
    );

    await expect(searchFn("react vite", context)).resolves.toEqual(
      "First\nhttps://a.com\n\nSecond\nhttps://b.com",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.alterlab.io/api/v1/search",
      expect.objectContaining({
        body: JSON.stringify({ query: "react vite", num_results: 2 }),
      }),
    );
  });
});
