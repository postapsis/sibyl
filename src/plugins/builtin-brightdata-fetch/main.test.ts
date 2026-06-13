/*
 * Author: Jamius Siam
 * Since: 09/06/2026
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SilbylPlugin } from "./main.ts";
import type { ParsePlugin, PluginContext } from "../../@types/plugin.ts";

const fetchFn = SilbylPlugin.fn;

const parseFn = vi.fn(async (html: string) => `parsed:${html}`);
const parsePlugin: ParsePlugin = { name: "mock-parse", type: "parse", fn: parseFn };
const context: PluginContext = {
  configuredPlugins: { parse: parsePlugin },
  allPlugins: [parsePlugin],
  getPlugin: (name) => (name === parsePlugin.name ? parsePlugin : null),
};

function makeResponse({
  ok = true,
  status = 200,
  statusText = "OK",
  text = "",
}: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  text?: string;
}) {
  return { ok, status, statusText, text: async () => text };
}

function stubFetch(res: unknown) {
  const mock = vi.fn(async () => res);
  vi.stubGlobal("fetch", mock);
  return mock;
}

let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  parseFn.mockClear();
  envSnapshot = { ...process.env };
  process.env.BRIGHTDATA_API_KEY = "test-key";
  process.env.BRIGHTDATA_WEB_UNLOCKER_API_ZONE = "test-zone";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-brightdata-fetch", () => {
  it("an AbortSignal is present on the fetch", async () => {
    const fetchMock = stubFetch(makeResponse({ text: "<html></html>" }));

    await fetchFn("https://a.com", context);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("throws when `BRIGHTDATA_API_KEY` is missing", async () => {
    delete process.env.BRIGHTDATA_API_KEY;

    await expect(fetchFn("https://a.com", context)).rejects.toThrow(
      "Missing `BRIGHTDATA_API_KEY` environment variable.",
    );
  });

  it("throws when `BRIGHTDATA_WEB_UNLOCKER_API_ZONE` is missing", async () => {
    delete process.env.BRIGHTDATA_WEB_UNLOCKER_API_ZONE;

    await expect(fetchFn("https://a.com", context)).rejects.toThrow(
      "Missing `BRIGHTDATA_WEB_UNLOCKER_API_ZONE` environment variable.",
    );
  });

  it("passes the fetched html to the configured parse plugin", async () => {
    stubFetch(makeResponse({ text: "<html><body>page</body></html>" }));

    await expect(fetchFn("https://a.com", context)).resolves.toEqual(
      "parsed:<html><body>page</body></html>",
    );
    expect(parseFn).toHaveBeenCalledWith("<html><body>page</body></html>", context);
  });

  it("returns the raw html when no parse plugin is configured", async () => {
    stubFetch(makeResponse({ text: "<html><body>page</body></html>" }));
    const emptyContext: PluginContext = {
      configuredPlugins: {},
      allPlugins: [],
      getPlugin: () => null,
    };

    await expect(fetchFn("https://a.com", emptyContext)).resolves.toEqual(
      "<html><body>page</body></html>",
    );
  });

  it("throws when the response is not ok", async () => {
    stubFetch(
      makeResponse({ ok: false, status: 500, statusText: "Internal Server Error", text: "boom" }),
    );

    await expect(fetchFn("https://a.com", context)).rejects.toThrow(
      "Bright Data fetch failed: 500 Internal Server Error - boom",
    );
  });
});
