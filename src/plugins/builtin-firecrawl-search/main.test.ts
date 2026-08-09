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

let timeoutSpy: ReturnType<typeof vi.spyOn>;
let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
  envSnapshot = { ...process.env };
  process.env.FIRECRAWL_API_KEY = "test-key";
  delete process.env.SIBYL_SHOW_SEARCH_DESCRIPTION;
  delete process.env.SIBYL_SEARCH_RESULTS_LIMIT;
  delete process.env.SIBYL_SEARCH_TIMEOUT;
});

afterEach(() => {
  timeoutSpy.mockRestore();
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-firecrawl-search", () => {
  it("uses the default timeout for the fetch", async () => {
    const fetchMock = stubFetch(
      makeResponse({ json: { success: true, data: { web: [] }, creditsUsed: 0, id: "abc" } }),
    );

    await searchFn("web scraping python", context);

    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("uses the configured timeout for the fetch", async () => {
    process.env.SIBYL_SEARCH_TIMEOUT = "1234";
    stubFetch(
      makeResponse({ json: { success: true, data: { web: [] }, creditsUsed: 0, id: "abc" } }),
    );

    await searchFn("web scraping python", context);

    expect(timeoutSpy).toHaveBeenCalledWith(1234);
  });

  it("throws when `FIRECRAWL_API_KEY` is missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;

    await expect(searchFn("web scraping python", context)).rejects.toThrow(
      "Missing `FIRECRAWL_API_KEY` environment variable.",
    );
  });

  it("throws when the response is not ok", async () => {
    stubFetch(
      makeResponse({ ok: false, status: 500, statusText: "Internal Server Error", text: "boom" }),
    );

    await expect(searchFn("web scraping python", context)).rejects.toThrow(
      "Firecrawl search failed: 500 Internal Server Error - boom",
    );
  });

  it("formats results as title + url", async () => {
    process.env.SIBYL_SHOW_SEARCH_DESCRIPTION = "false";
    stubFetch(
      makeResponse({
        json: {
          success: true,
          data: {
            web: [
              { url: "https://a.com", title: "First", description: "ignored", position: 1 },
              { url: "https://b.com", title: "Second", description: "ignored", position: 2 },
              { url: "https://c.com", title: null, description: "ignored", position: 3 },
            ],
          },
          creditsUsed: 1,
          id: "abc",
        },
      }),
    );

    await expect(searchFn("web scraping python", context)).resolves.toEqual(
      "First\nhttps://a.com\n\nSecond\nhttps://b.com\n\n(untitled)\nhttps://c.com",
    );
  });

  it("appends the description by default when the flag is unset", async () => {
    stubFetch(
      makeResponse({
        json: {
          success: true,
          data: {
            web: [
              {
                url: "https://a.com",
                title: "First",
                description: "real text",
                position: 1,
              },
              { url: "https://b.com", title: "Second", description: "", position: 2 },
            ],
          },
          creditsUsed: 1,
          id: "abc",
        },
      }),
    );

    await expect(searchFn("web scraping python", context)).resolves.toEqual(
      "First\nhttps://a.com\nreal text\n\nSecond\nhttps://b.com",
    );
  });

  it("returns a no-results message when `data.web` is empty", async () => {
    stubFetch(
      makeResponse({ json: { success: true, data: { web: [] }, creditsUsed: 0, id: "abc" } }),
    );

    await expect(searchFn("web scraping python", context)).resolves.toEqual(
      "No results for: web scraping python",
    );
  });

  it("returns a no-results message when the response body is null", async () => {
    stubFetch(makeResponse({ json: null }));

    await expect(searchFn("web scraping python", context)).resolves.toEqual(
      "No results for: web scraping python",
    );
  });

  it("posts to the Firecrawl search api with the bearer token header and query body", async () => {
    const fetchMock = stubFetch(
      makeResponse({ json: { success: true, data: { web: [] }, creditsUsed: 0, id: "abc" } }),
    );

    await searchFn("web scraping python", context);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v2/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        body: JSON.stringify({ query: "web scraping python", limit: 10 }),
      }),
    );
  });

  it("requests and slices to `SIBYL_SEARCH_RESULTS_LIMIT`", async () => {
    process.env.SIBYL_SEARCH_RESULTS_LIMIT = "2";
    const fetchMock = stubFetch(
      makeResponse({
        json: {
          success: true,
          data: {
            web: [
              { url: "https://a.com", title: "First", description: "", position: 1 },
              { url: "https://b.com", title: "Second", description: "", position: 2 },
              { url: "https://c.com", title: "Third", description: "", position: 3 },
            ],
          },
          creditsUsed: 1,
          id: "abc",
        },
      }),
    );

    await expect(searchFn("web scraping python", context)).resolves.toEqual(
      "First\nhttps://a.com\n\nSecond\nhttps://b.com",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v2/search",
      expect.objectContaining({
        body: JSON.stringify({ query: "web scraping python", limit: 2 }),
      }),
    );
  });
});
