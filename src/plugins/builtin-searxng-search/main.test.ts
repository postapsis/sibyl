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

function stubFetchReject(err: unknown) {
  const mock = vi.fn(async () => {
    throw err;
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

let warnSpy: ReturnType<typeof vi.spyOn>;
let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  envSnapshot = { ...process.env };

  delete process.env.SIBYL_SEARXNG_URL;
  delete process.env.SIBYL_SEARXNG_ENGINES;
  delete process.env.SIBYL_SHOW_SEARCH_DESCRIPTION;
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-searxng-search", () => {
  it("queries the default url with `format=json` and no `engines` when unset", async () => {
    const fetchMock = stubFetch(makeResponse({ json: { results: [] } }));

    await searchFn("react vite", context);

    const mockCallArgs = fetchMock.mock.calls[0] as string[];
    const calledUrl = mockCallArgs[0];

    expect(calledUrl).toContain("http://localhost:8080/search?");
    expect(calledUrl).toContain("format=json");
    expect(calledUrl).toContain("q=react+vite");
    expect(calledUrl).not.toContain("engines=");
  });

  it("adds the `engines` param when `SIBYL_SEARXNG_ENGINES` is set", async () => {
    process.env.SIBYL_SEARXNG_ENGINES = "google";
    const fetchMock = stubFetch(makeResponse({ json: { results: [] } }));

    await searchFn("react vite", context);

    const mockCallArgs = fetchMock.mock.calls[0] as string[];
    const calledUrl = mockCallArgs[0];

    expect(calledUrl).toContain("engines=google");
  });

  it("uses the instance url from `SIBYL_SEARXNG_URL`", async () => {
    process.env.SIBYL_SEARXNG_URL = "http://searxng.local:9999";
    const fetchMock = stubFetch(makeResponse({ json: { results: [] } }));

    await searchFn("react vite", context);

    const mockCallArgs = fetchMock.mock.calls[0] as string[];
    const calledUrl = mockCallArgs[0];

    expect(calledUrl).toContain("http://searxng.local:9999/search?");
  });

  it("formats results as title + url", async () => {
    stubFetch(
      makeResponse({
        json: {
          results: [
            { title: "First", url: "https://a.com", content: "ignored", engine: "google" },
            { title: "Second", url: "https://b.com", content: "ignored", engine: "google" },
          ],
        },
      }),
    );

    await expect(searchFn("react vite", context)).resolves.toEqual(
      "First\nhttps://a.com\n\nSecond\nhttps://b.com",
    );
  });

  it("appends content when the show description flag is enabled", async () => {
    process.env.SIBYL_SHOW_SEARCH_DESCRIPTION = "true";
    stubFetch(
      makeResponse({
        json: {
          results: [
            { title: "First", url: "https://a.com", content: "some content", engine: "google" },
            { title: "Second", url: "https://b.com", content: "", engine: "google" },
          ],
        },
      }),
    );

    await expect(searchFn("react vite", context)).resolves.toEqual(
      "First\nhttps://a.com\nsome content\n\nSecond\nhttps://b.com",
    );
  });

  it("returns a no-results message when `results` is empty", async () => {
    stubFetch(makeResponse({ json: { results: [] } }));

    await expect(searchFn("react vite", context)).resolves.toEqual("No results for: react vite");
  });

  it("returns a no-results message when the response body is null", async () => {
    stubFetch(makeResponse({ json: null }));

    await expect(searchFn("react vite", context)).resolves.toEqual("No results for: react vite");
  });

  it("throws an actionable error on 403, pointing to the discussions link", async () => {
    stubFetch(makeResponse({ ok: false, status: 403, statusText: "Forbidden" }));

    await expect(searchFn("react vite", context)).rejects.toThrow(
      "SearXNG search failed: 403 Forbidden",
    );

    // Posts the discussion link about enabling JSON output
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Ensure the JSON output format is enabled (see https://github.com/searxng/searxng/discussions/3542)",
      ),
    );
  });

  it("throws when the response is not ok", async () => {
    stubFetch(
      makeResponse({ ok: false, status: 500, statusText: "Internal Server Error", text: "boom" }),
    );

    await expect(searchFn("react vite", context)).rejects.toThrow(
      "SearXNG search failed: 500 Internal Server Error - boom",
    );
  });

  it("warns and rethrows when SearXNG is unreachable", async () => {
    stubFetchReject(new TypeError("ECONNREFUSED"));

    await expect(searchFn("react vite", context)).rejects.toThrow("ECONNREFUSED");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Is SearXNG reachable on"));
  });
});
