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
  process.env.EXA_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-exa-search", () => {
  it("throws when `EXA_API_KEY` is missing", async () => {
    delete process.env.EXA_API_KEY;

    await expect(searchFn("react", context)).rejects.toThrow(
      "Missing `EXA_API_KEY` environment variable.",
    );
  });

  it("formats results, using `(untitled)` for a null title", async () => {
    stubFetch(
      makeResponse({
        json: {
          results: [
            { title: "First", url: "https://a.com" },
            { title: null, url: "https://b.com" },
          ],
        },
      }),
    );

    await expect(searchFn("react", context)).resolves.toEqual(
      "First\nhttps://a.com\n\n(untitled)\nhttps://b.com",
    );
  });

  it("appends processed highlights when show description flag is enabled", async () => {
    process.env.SIBYL_SHOW_SEARCH_DESCRIPTION = "true";
    const fetchMock = stubFetch(
      makeResponse({
        json: {
          results: [
            {
              title: "First",
              url: "https://a.com",
              highlights: ["foo [...] bar", "line1\nline2", "double  space"],
            },
            { title: null, url: "https://b.com" },
          ],
        },
      }),
    );

    await expect(searchFn("react", context)).resolves.toEqual(
      'First\nhttps://a.com\n"""foo ... bar line1 line2 double space"""\n\n(untitled)\nhttps://b.com',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.exa.ai/search",
      expect.objectContaining({ body: expect.stringContaining('"highlights":true') }),
    );
  });

  it("calls the Exa search endpoint with the api key header", async () => {
    const fetchMock = stubFetch(makeResponse({ json: { results: [] } }));

    await searchFn("react", context);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.exa.ai/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
      }),
    );
  });

  it("returns a no-results message when `results` is empty", async () => {
    stubFetch(makeResponse({ json: { results: [] } }));

    await expect(searchFn("react", context)).resolves.toEqual("No results for: react");
  });

  it("returns a no-results message when the response body is null", async () => {
    stubFetch(makeResponse({ json: null }));

    await expect(searchFn("react", context)).resolves.toEqual("No results for: react");
  });

  it("throws when the response is not ok", async () => {
    stubFetch(
      makeResponse({ ok: false, status: 500, statusText: "Internal Server Error", text: "boom" }),
    );

    await expect(searchFn("react", context)).rejects.toThrow(
      "Exa search failed: 500 Internal Server Error - boom",
    );
  });
});
