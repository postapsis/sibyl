/*
 * Author: Jamius Siam
 * Since: 09/06/2026
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SilbylPlugin } from "./main.ts";

const fetchFn = SilbylPlugin.fn;

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
  it("throws when `BRIGHTDATA_API_KEY` is missing", async () => {
    delete process.env.BRIGHTDATA_API_KEY;

    await expect(fetchFn("https://a.com")).rejects.toThrow(
      "Missing `BRIGHTDATA_API_KEY` environment variable.",
    );
  });

  it("throws when `BRIGHTDATA_WEB_UNLOCKER_API_ZONE` is missing", async () => {
    delete process.env.BRIGHTDATA_WEB_UNLOCKER_API_ZONE;

    await expect(fetchFn("https://a.com")).rejects.toThrow(
      "Missing `BRIGHTDATA_WEB_UNLOCKER_API_ZONE` environment variable.",
    );
  });

  it("returns the raw response body verbatim", async () => {
    stubFetch(makeResponse({ text: "<html><body>page</body></html>" }));

    await expect(fetchFn("https://a.com")).resolves.toEqual("<html><body>page</body></html>");
  });

  it("throws when the response is not ok", async () => {
    stubFetch(
      makeResponse({ ok: false, status: 500, statusText: "Internal Server Error", text: "boom" }),
    );

    await expect(fetchFn("https://a.com")).rejects.toThrow(
      "Bright Data fetch failed: 500 Internal Server Error - boom",
    );
  });
});
