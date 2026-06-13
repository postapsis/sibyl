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
  process.env.ALTERLAB_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-alterlab-fetch", () => {
  it("an AbortSignal is present on the fetch", async () => {
    const fetchMock = stubFetch(
      makeResponse({ json: { url, status_code: 200, content: { html: "" } } }),
    );

    await fetchFn(url, context);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("throws when `ALTERLAB_API_KEY` is missing", async () => {
    delete process.env.ALTERLAB_API_KEY;

    await expect(fetchFn(url, context)).rejects.toThrow(
      "Missing `ALTERLAB_API_KEY` environment variable.",
    );
  });

  it("throws when the response is not ok", async () => {
    stubFetch(
      makeResponse({ ok: false, status: 500, statusText: "Internal Server Error", text: "boom" }),
    );

    await expect(fetchFn(url, context)).rejects.toThrow(
      "AlterLab fetch failed: 500 Internal Server Error - boom",
    );
  });

  it("returns a no-content message when `content.html` is empty", async () => {
    stubFetch(makeResponse({ json: { url, status_code: 200, content: { html: "" } } }));

    await expect(fetchFn(url, context)).resolves.toEqual("No content for https://example.com");
  });

  it("returns a no-content message when `content` is missing", async () => {
    stubFetch(makeResponse({ json: { url, status_code: 200 } }));

    await expect(fetchFn(url, context)).resolves.toEqual("No content for https://example.com");
  });

  it("passes the fetched html to the configured parse plugin", async () => {
    stubFetch(
      makeResponse({
        json: { url, status_code: 200, content: { html: "<html><body>page</body></html>" } },
      }),
    );

    await expect(fetchFn(url, context)).resolves.toEqual("parsed:<html><body>page</body></html>");
    expect(parseFn).toHaveBeenCalledWith("<html><body>page</body></html>", context);
  });

  it("returns the raw html when no parse plugin is configured", async () => {
    stubFetch(
      makeResponse({
        json: { url, status_code: 200, content: { html: "<html><body>page</body></html>" } },
      }),
    );

    await expect(fetchFn(url, emptyContext)).resolves.toEqual("<html><body>page</body></html>");
  });

  it("posts to the AlterLab scrape api with the api key header and url body", async () => {
    const fetchMock = stubFetch(
      makeResponse({ json: { url, status_code: 200, content: { html: "" } } }),
    );

    await fetchFn(url, context);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.alterlab.io/api/v1/scrape",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-API-Key": "test-key" }),
        body: JSON.stringify({ url, force_refresh: true, sync: true }),
      }),
    );
  });
});
