/*
 * Author: Jamius Siam
 * Since: 09/06/2026
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SilbylPlugin } from "./main.ts";

const searchFn = SilbylPlugin.fn;

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

const ORGANIC = [
  { title: "First", link: "https://a.com", description: "desc a" },
  { title: null, link: "https://b.com" },
];
const FORMATTED = "First\nhttps://a.com\ndesc a\n\n(untitled)\nhttps://b.com";

let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  envSnapshot = { ...process.env };
  process.env.BRIGHTDATA_API_KEY = "test-key";
  process.env.BRIGHTDATA_SERP_API_ZONE = "test-zone";
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

    await expect(searchFn("react")).rejects.toThrow(
      "Missing `BRIGHTDATA_API_KEY` environment variable.",
    );
  });

  it("throws when `BRIGHTDATA_SERP_API_ZONE` is missing", async () => {
    delete process.env.BRIGHTDATA_SERP_API_ZONE;

    await expect(searchFn("react")).rejects.toThrow(
      "Missing `BRIGHTDATA_SERP_API_ZONE` environment variable.",
    );
  });

  it("formats organic results returned directly", async () => {
    stubFetch(makeResponse({ json: { organic: ORGANIC } }));

    await expect(searchFn("react")).resolves.toEqual(FORMATTED);
  });

  it("formats organic results wrapped in a `body` object", async () => {
    stubFetch(makeResponse({ json: { body: { organic: ORGANIC } } }));

    await expect(searchFn("react")).resolves.toEqual(FORMATTED);
  });

  it("formats organic results wrapped in a `body` JSON string", async () => {
    stubFetch(makeResponse({ json: { body: JSON.stringify({ organic: ORGANIC }) } }));

    await expect(searchFn("react")).resolves.toEqual(FORMATTED);
  });

  it("returns a no-results message when there are no organic results", async () => {
    stubFetch(makeResponse({ json: { organic: [] } }));

    await expect(searchFn("react")).resolves.toEqual("No results for: react");
  });

  it("returns a no-results message when the response body is null", async () => {
    stubFetch(makeResponse({ json: null }));

    await expect(searchFn("react")).resolves.toEqual("No results for: react");
  });

  it("throws when the response is not ok", async () => {
    stubFetch(makeResponse({ ok: false, status: 403, statusText: "Forbidden", text: "denied" }));

    await expect(searchFn("react")).rejects.toThrow(
      "Bright Data search failed: 403 Forbidden - denied",
    );
  });
});
