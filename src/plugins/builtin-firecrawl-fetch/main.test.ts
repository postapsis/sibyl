/*
 * Author: Jamius Siam
 * Since: 13/06/2026
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SilbylPlugin } from "./main.ts";
import type { ParsePlugin, PluginContext } from "../../@types/plugin.ts";

const fetchFn = SilbylPlugin.fn;

const url = "https://example.com";

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

const parseFn = vi.fn(async (html: string) => `parsed:${html}`);

const parsePlugin: ParsePlugin = { name: "mock-parse", type: "parse", fn: parseFn };

const context: PluginContext = {
  configuredPlugins: { parse: parsePlugin },
  allPlugins: [parsePlugin],
  getPlugin: (name) => (name === parsePlugin.name ? parsePlugin : null),
};
const emptyContext: PluginContext = {
  configuredPlugins: {},
  allPlugins: [],
  getPlugin: () => null,
};

let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  parseFn.mockClear();
  envSnapshot = { ...process.env };
  process.env.FIRECRAWL_API_KEY = "test-key";
  delete process.env.SIBYL_FIRECRAWL_FETCH_USE_HTML;
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-firecrawl-fetch", () => {
  it("throws when `FIRECRAWL_API_KEY` is missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;

    await expect(fetchFn(url, context)).rejects.toThrow(
      "Missing `FIRECRAWL_API_KEY` environment variable.",
    );
  });

  it("throws when the response is not ok", async () => {
    stubFetch(
      makeResponse({ ok: false, status: 500, statusText: "Internal Server Error", text: "boom" }),
    );

    await expect(fetchFn(url, context)).rejects.toThrow(
      "Firecrawl fetch failed: 500 Internal Server Error - boom",
    );
  });

  it("returns the markdown with collapsed blank lines by default", async () => {
    stubFetch(
      makeResponse({
        json: {
          success: true,
          data: { markdown: "# Title\n\n\n\nsome text\n\n\n", rawHtml: "<html>ignored</html>" },
        },
      }),
    );

    await expect(fetchFn(url, context)).resolves.toEqual("# Title\nsome text");
    expect(parseFn).not.toHaveBeenCalled();
  });

  it("returns a no-content message when the markdown is empty", async () => {
    stubFetch(makeResponse({ json: { success: true, data: { markdown: "", rawHtml: "" } } }));

    await expect(fetchFn(url, context)).resolves.toEqual("No content for https://example.com");
  });

  it("passes the raw html to the configured parse plugin when `SIBYL_FIRECRAWL_FETCH_USE_HTML` is true", async () => {
    process.env.SIBYL_FIRECRAWL_FETCH_USE_HTML = "true";
    stubFetch(
      makeResponse({
        json: {
          success: true,
          data: { markdown: "ignored", rawHtml: "<html><body>page</body></html>" },
        },
      }),
    );

    await expect(fetchFn(url, context)).resolves.toEqual("parsed:<html><body>page</body></html>");
    expect(parseFn).toHaveBeenCalledWith("<html><body>page</body></html>", context);
  });

  it("returns the raw html when no parse plugin is configured in html mode", async () => {
    process.env.SIBYL_FIRECRAWL_FETCH_USE_HTML = "true";
    stubFetch(
      makeResponse({
        json: {
          success: true,
          data: { markdown: "ignored", rawHtml: "<html><body>page</body></html>" },
        },
      }),
    );

    await expect(fetchFn(url, emptyContext)).resolves.toEqual("<html><body>page</body></html>");
  });

  it("returns a no-content message when the raw html is empty in html mode", async () => {
    process.env.SIBYL_FIRECRAWL_FETCH_USE_HTML = "true";
    stubFetch(
      makeResponse({ json: { success: true, data: { markdown: "ignored", rawHtml: "" } } }),
    );

    await expect(fetchFn(url, context)).resolves.toEqual("No content for https://example.com");
  });

  it("requests the markdown format with the bearer token by default", async () => {
    const fetchMock = stubFetch(
      makeResponse({ json: { success: true, data: { markdown: "x", rawHtml: "" } } }),
    );

    await fetchFn(url, context);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v2/scrape",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        body: JSON.stringify({ url, formats: ["markdown"] }),
      }),
    );
  });

  it("requests the rawHtml format when `SIBYL_FIRECRAWL_FETCH_USE_HTML` is true", async () => {
    process.env.SIBYL_FIRECRAWL_FETCH_USE_HTML = "true";
    const fetchMock = stubFetch(
      makeResponse({ json: { success: true, data: { markdown: "", rawHtml: "<html></html>" } } }),
    );

    await fetchFn(url, context);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v2/scrape",
      expect.objectContaining({
        body: JSON.stringify({ url, formats: ["rawHtml"] }),
      }),
    );
  });
});
