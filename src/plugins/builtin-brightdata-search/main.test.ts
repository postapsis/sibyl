/*
 * Author: Jamius Siam
 * Since: 09/06/2026
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
  process.env.BRIGHTDATA_API_KEY = "test-key";
  process.env.BRIGHTDATA_SERP_API_ZONE = "test-zone";
  delete process.env.SIBYL_SEARCH_RESULTS_LIMIT;
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-brightdata-search", () => {
  it("throws when `BRIGHTDATA_API_KEY` is missing", async () => {
    delete process.env.BRIGHTDATA_API_KEY;

    await expect(searchFn("react", context)).rejects.toThrow(
      "Missing `BRIGHTDATA_API_KEY` environment variable.",
    );
  });

  it("throws when `BRIGHTDATA_SERP_API_ZONE` is missing", async () => {
    delete process.env.BRIGHTDATA_SERP_API_ZONE;

    await expect(searchFn("react", context)).rejects.toThrow(
      "Missing `BRIGHTDATA_SERP_API_ZONE` environment variable.",
    );
  });

  it("formats results with title and link only when show description flag is disabled/missing", async () => {
    stubFetch(
      makeResponse({
        json: {
          organic: [
            { title: "First", link: "https://a.com", description: "desc a" },
            { title: null, link: "https://b.com" },
          ],
        },
      }),
    );

    await expect(searchFn("react", context)).resolves.toEqual(
      "First\nhttps://a.com\n\n(untitled)\nhttps://b.com",
    );
  });

  it("includes descriptions and strips a trailing `Read more` when show description flag is enabled", async () => {
    process.env.SIBYL_SHOW_SEARCH_DESCRIPTION = "true";
    stubFetch(
      makeResponse({
        json: {
          organic: [
            { title: "First", link: "https://a.com", description: "desc a" },
            { title: "Second", link: "https://c.com", description: "Some text...Read more" },
            { title: null, link: "https://b.com" },
          ],
        },
      }),
    );

    await expect(searchFn("react", context)).resolves.toEqual(
      "First\nhttps://a.com\ndesc a\n\n" +
        "Second\nhttps://c.com\nSome text...\n\n" +
        "(untitled)\nhttps://b.com",
    );
  });

  it("requests the parsed-raw SERP with the default language and no country", async () => {
    const fetchMock = stubFetch(makeResponse({ json: { organic: [] } }));

    await searchFn("react", context);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brightdata.com/request",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"format":"raw"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brightdata.com/request",
      expect.objectContaining({ body: expect.stringContaining("q=react&hl=en") }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://api.brightdata.com/request",
      expect.objectContaining({ body: expect.stringContaining("&gl=") }),
    );
  });

  it("applies the configured language and country from env to the search url", async () => {
    process.env.BRIGHTDATA_SERP_API_LANGUAGE = "fr";
    process.env.BRIGHTDATA_SERP_API_COUNTRY = "us";
    const fetchMock = stubFetch(makeResponse({ json: { organic: [] } }));

    await searchFn("react", context);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brightdata.com/request",
      expect.objectContaining({ body: expect.stringContaining("q=react&hl=fr&gl=us") }),
    );
  });

  it("returns a no-results message when there are no organic results", async () => {
    stubFetch(makeResponse({ json: { organic: [] } }));

    await expect(searchFn("react", context)).resolves.toEqual("No results for: react");
  });

  it("returns a no-results message when the response body is null", async () => {
    stubFetch(makeResponse({ json: null }));

    await expect(searchFn("react", context)).resolves.toEqual("No results for: react");
  });

  it("throws when the response is not ok", async () => {
    stubFetch(makeResponse({ ok: false, status: 403, statusText: "Forbidden", text: "denied" }));

    await expect(searchFn("react", context)).rejects.toThrow(
      "Bright Data search failed: 403 Forbidden - denied",
    );
  });

  it("requests `num` and slices to `SIBYL_SEARCH_RESULTS_LIMIT`", async () => {
    process.env.SIBYL_SEARCH_RESULTS_LIMIT = "2";
    const fetchMock = stubFetch(
      makeResponse({
        json: {
          organic: [
            { title: "First", link: "https://a.com" },
            { title: "Second", link: "https://b.com" },
            { title: "Third", link: "https://c.com" },
          ],
        },
      }),
    );

    await expect(searchFn("react", context)).resolves.toEqual(
      "First\nhttps://a.com\n\nSecond\nhttps://b.com",
    );
  });
});
