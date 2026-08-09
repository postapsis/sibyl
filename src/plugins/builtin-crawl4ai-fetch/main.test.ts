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
}: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
}) {
  return { ok, status, statusText, json: async () => json };
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

let warnSpy: ReturnType<typeof vi.spyOn>;
let timeoutSpy: ReturnType<typeof vi.spyOn>;
let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
  parseFn.mockClear();
  envSnapshot = { ...process.env };
  delete process.env.SIBYL_CRAWL4AI_URL;
  delete process.env.SIBYL_CRAWL4AI_PROXY_SERVER;
  delete process.env.SIBYL_CRAWL4AI_PROXY_USERNAME;
  delete process.env.SIBYL_CRAWL4AI_PROXY_PASSWORD;
  delete process.env.SIBYL_FETCH_TIMEOUT;
});

afterEach(() => {
  warnSpy.mockRestore();
  timeoutSpy.mockRestore();
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

describe("builtin-crawl4ai-fetch", () => {
  it("uses the default timeout for the fetch", async () => {
    const fetchMock = stubFetch(makeResponse({ json: { success: true, results: [] } }));

    await fetchFn(url, context);

    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("uses the configured timeout for the fetch", async () => {
    process.env.SIBYL_FETCH_TIMEOUT = "1234";
    stubFetch(makeResponse({ json: { success: true, results: [] } }));

    await fetchFn(url, context);

    expect(timeoutSpy).toHaveBeenCalledWith(1234);
  });

  it("throws when the response is not ok", async () => {
    stubFetch(makeResponse({ ok: false, status: 500, statusText: "Internal Server Error" }));

    await expect(fetchFn(url, context)).rejects.toThrow(
      "Crawl4AI fetch failed: 500 Internal Server Error",
    );
  });

  it("warns and rethrows when Crawl4AI is unreachable (container not running)", async () => {
    stubFetchReject(new TypeError("fetch failed"));

    await expect(fetchFn(url, context)).rejects.toThrow("fetch failed");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("docker run"));
  });

  it("throws when the success flag is false", async () => {
    stubFetch(makeResponse({ json: { success: false } }));

    await expect(fetchFn(url, context)).rejects.toThrow(
      "Crawl4AI fetch failed: Crawl4AI success response false",
    );
  });

  it("returns a no-content message when `results` is undefined", async () => {
    stubFetch(makeResponse({ json: { success: true } }));

    await expect(fetchFn(url, context)).resolves.toEqual("No content for https://example.com");
  });

  it("returns a no-content message when `results` is null", async () => {
    stubFetch(makeResponse({ json: { success: true, results: null } }));

    await expect(fetchFn(url, context)).resolves.toEqual("No content for https://example.com");
  });

  it("returns a no-content message when `results` is an empty array", async () => {
    stubFetch(makeResponse({ json: { success: true, results: [] } }));

    await expect(fetchFn(url, context)).resolves.toEqual("No content for https://example.com");
  });

  it("returns a no-content message when the first result has no html", async () => {
    stubFetch(
      makeResponse({
        json: {
          success: true,
          results: [{ url, html: "", error_message: "", status_code: 403 }],
        },
      }),
    );

    await expect(fetchFn(url, context)).resolves.toEqual("No content for https://example.com");
  });

  it("passes the fetched html to the configured parse plugin", async () => {
    stubFetch(
      makeResponse({
        json: {
          success: true,
          results: [
            { url, html: "<html><body>page</body></html>", error_message: "", status_code: 200 },
          ],
        },
      }),
    );

    await expect(fetchFn(url, context)).resolves.toEqual("parsed:<html><body>page</body></html>");
    expect(parseFn).toHaveBeenCalledWith("<html><body>page</body></html>", context);
  });

  it("returns the raw html when no parse plugin is configured", async () => {
    stubFetch(
      makeResponse({
        json: {
          success: true,
          results: [
            { url, html: "<html><body>page</body></html>", error_message: "", status_code: 200 },
          ],
        },
      }),
    );

    await expect(fetchFn(url, emptyContext)).resolves.toEqual("<html><body>page</body></html>");
  });

  it("posts to the default Crawl4AI url when `SIBYL_CRAWL4AI_URL` is unset", async () => {
    const fetchMock = stubFetch(makeResponse({ json: { success: true, results: [] } }));

    await fetchFn(url, context);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11235/crawl",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"urls":["https://example.com"]'),
      }),
    );
  });

  it("posts to the configured Crawl4AI url from `SIBYL_CRAWL4AI_URL`", async () => {
    process.env.SIBYL_CRAWL4AI_URL = "http://crawler:9999";
    const fetchMock = stubFetch(makeResponse({ json: { success: true, results: [] } }));

    await fetchFn(url, context);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://crawler:9999/crawl",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("omits `proxy_config` when `SIBYL_CRAWL4AI_PROXY_SERVER` is unset", async () => {
    const fetchMock = stubFetch(makeResponse({ json: { success: true, results: [] } }));

    await fetchFn(url, context);

    const mockCallArgs = fetchMock.mock.calls[0] as RequestInit[];
    const req = mockCallArgs[1];
    expect(req?.body).not.toContain("proxy_config");
  });

  it("includes `proxy_config` with server, username and password when all are set", async () => {
    process.env.SIBYL_CRAWL4AI_PROXY_SERVER = "https://proxy.example.com:823";
    process.env.SIBYL_CRAWL4AI_PROXY_USERNAME = "user";
    process.env.SIBYL_CRAWL4AI_PROXY_PASSWORD = "pass";
    const fetchMock = stubFetch(makeResponse({ json: { success: true, results: [] } }));

    await fetchFn(url, context);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining(
          '"proxy_config":{"server":"https://proxy.example.com:823","username":"user","password":"pass"}',
        ),
      }),
    );
  });

  it("includes `proxy_config` with only server when username and password are unset", async () => {
    process.env.SIBYL_CRAWL4AI_PROXY_SERVER = "https://proxy.example.com:823";
    const fetchMock = stubFetch(makeResponse({ json: { success: true, results: [] } }));

    await fetchFn(url, context);

    const mockCallArgs = fetchMock.mock.calls[0] as RequestInit[];
    const req = mockCallArgs[1];
    const body = req?.body;

    expect(body).toContain('"proxy_config":{"server":"https://proxy.example.com:823"}');
    expect(body).not.toContain("username");
    expect(body).not.toContain("password");
  });
});
