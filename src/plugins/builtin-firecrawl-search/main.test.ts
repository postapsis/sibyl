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
  process.env.FIRECRAWL_API_KEY = "test-key";
  delete process.env.SIBYL_SHOW_SEARCH_DESCRIPTION;
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-firecrawl-search", () => {
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
    stubFetch(
      makeResponse({
        json: {
          success: true,
          data: {
            web: [
              { url: "https://a.com", title: "First", description: "ignored", position: 1 },
              { url: "https://b.com", title: "Second", description: "ignored", position: 2 },
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
  });

  it("appends the description when the show description flag is enabled", async () => {
    process.env.SIBYL_SHOW_SEARCH_DESCRIPTION = "true";
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
});
