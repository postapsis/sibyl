/*
 * Author: Jamius Siam
 * Since: 10/06/2026
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collapseBlankLines,
  getPluginTimeout,
  getSearchResultsLimit,
  isValidHttpUrl,
  shouldShowSearchDescription,
  stripSearchResultDatePrefix,
} from "./utils.ts";

describe("isValidHttpUrl", () => {
  it.each([
    "http://example.com",
    "https://example.com",
    "https://example.com/path?q=1#frag",
    "http://localhost:3000",
    "HTTPS://EXAMPLE.COM",
  ])("returns true for the http(s) url %j", (url) => {
    expect(isValidHttpUrl(url)).toBe(true);
  });

  it.each([
    "ftp://example.com",
    "file:///etc/passwd",
    "ws://example.com",
    "mailto:user@example.com",
    "javascript:alert(1)",
  ])("returns false for the non-http url %j", (url) => {
    expect(isValidHttpUrl(url)).toBe(false);
  });

  it.each(["", "  ", "example.com", "//example.com", "not a url", "http://"])(
    "returns false for the unparseable value %j",
    (value) => {
      expect(isValidHttpUrl(value)).toBe(false);
    },
  );
});

describe("stripSearchResultDatePrefix", () => {
  it.each([
    ["১৫ সেপ, ২০২৫ · In this React tutorial", "In this React tutorial"],
    ["Sep 15, 2025 · Build websites and projects", "Build websites and projects"],
    ["2025年9月15日 · これはReactチュートリアルです", "これはReactチュートリアルです"],
    ["15. Sept. 2025 · Beschreibung des Tutorials", "Beschreibung des Tutorials"],
    ["१५ सित॰, २०२५ · हिंदी विवरण", "हिंदी विवरण"],
    ["١٥ سبتمبر ٢٠٢٥ · وصف عربي", "وصف عربي"],
  ])("strips the leading date prefix from %j", (input, expected) => {
    expect(stripSearchResultDatePrefix(input)).toBe(expected);
  });

  it.each([
    "In this React tutorial, build websites",
    "React · A JavaScript library for building UIs",
    "",
  ])("leaves %j unchanged when there is no leading date prefix", (input) => {
    expect(stripSearchResultDatePrefix(input)).toBe(input);
  });
});

describe("collapseBlankLines", () => {
  it.each([
    ["a\n\nb", "a\nb"],
    ["a\n\n\n\nb", "a\nb"],
    ["# Title\n\n\n\nsome text", "# Title\nsome text"],
    ["line1\n\nline2\n\n\nline3", "line1\nline2\nline3"],
    ["\n\nhello\n\n", "hello"],
    ["  hello  ", "hello"],
    ["\n\n# Title\n\ntext\n\n\n", "# Title\ntext"],
  ])("collapses consecutive newlines and trims %j", (input, expected) => {
    expect(collapseBlankLines(input)).toBe(expected);
  });

  it.each([
    ["a\nb", "a\nb"],
    ["a\nb\nc", "a\nb\nc"],
    ["single line", "single line"],
    ["", ""],
  ])("leaves %j unchanged", (input, expected) => {
    expect(collapseBlankLines(input)).toBe(expected);
  });
});

describe("getPluginTimeout", () => {
  let envSnapshot: NodeJS.ProcessEnv;

  beforeEach(() => {
    envSnapshot = { ...process.env };
    delete process.env.SIBYL_SEARCH_TIMEOUT;
    delete process.env.SIBYL_FETCH_TIMEOUT;
    delete process.env.SIBYL_ASK_TIMEOUT;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) delete process.env[key];
    }
    Object.assign(process.env, envSnapshot);
  });

  it.each([
    ["search", 10_000],
    ["fetch", 10_000],
    ["ask", 30_000],
  ] as const)("uses the current default when the %s timeout is unset", (type, expected) => {
    expect(getPluginTimeout(type)).toBe(expected);
  });

  it.each([
    ["search", "1", 1],
    ["fetch", "1234", 1234],
    ["ask", "2147483647", 2_147_483_647],
  ] as const)("parses the configured %s timeout", (type, value, expected) => {
    process.env[`SIBYL_${type.toUpperCase()}_TIMEOUT`] = value;

    expect(getPluginTimeout(type)).toBe(expected);
  });

  it("allows surrounding whitespace around a configured timeout", () => {
    process.env.SIBYL_SEARCH_TIMEOUT = " 1234 ";

    expect(getPluginTimeout("search")).toBe(1234);
  });

  it.each([
    ["SIBYL_SEARCH_TIMEOUT", "0", "search"],
    ["SIBYL_FETCH_TIMEOUT", "-1", "fetch"],
    ["SIBYL_ASK_TIMEOUT", "1.5", "ask"],
    ["SIBYL_SEARCH_TIMEOUT", "abc", "search"],
    ["SIBYL_FETCH_TIMEOUT", "1234ms", "fetch"],
    ["SIBYL_ASK_TIMEOUT", "2e3", "ask"],
    ["SIBYL_SEARCH_TIMEOUT", "2147483648", "search"],
  ] as const)("rejects invalid %s value %j", (envName, value, type) => {
    process.env[envName] = value;

    expect(() => getPluginTimeout(type)).toThrow(
      `Invalid \`${envName}\`: expected an integer between 1 and 2147483647 milliseconds.`,
    );
  });
});

describe("getSearchResultsLimit", () => {
  let envSnapshot: NodeJS.ProcessEnv;

  beforeEach(() => {
    envSnapshot = { ...process.env };
    delete process.env.SIBYL_SEARCH_RESULTS_LIMIT;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) delete process.env[key];
    }
    Object.assign(process.env, envSnapshot);
  });

  it("defaults to 10 when `SIBYL_SEARCH_RESULTS_LIMIT` is unset", () => {
    expect(getSearchResultsLimit()).toBe(10);
  });

  it.each([
    ["5", 5],
    ["25", 25],
    ["1", 1],
    ["2.5", 10],
  ])("returns the parsed limit for %j", (value, expected) => {
    process.env.SIBYL_SEARCH_RESULTS_LIMIT = value;
    expect(getSearchResultsLimit()).toBe(expected);
  });

  it.each(["0", "-3", "abc", "", "  "])("falls back to 10 for the invalid value %j", (value) => {
    process.env.SIBYL_SEARCH_RESULTS_LIMIT = value;
    expect(getSearchResultsLimit()).toBe(10);
  });
});

describe("shouldShowSearchDescription", () => {
  let envSnapshot: NodeJS.ProcessEnv;

  beforeEach(() => {
    envSnapshot = { ...process.env };
    delete process.env.SIBYL_SHOW_SEARCH_DESCRIPTION;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) delete process.env[key];
    }
    Object.assign(process.env, envSnapshot);
  });

  it("defaults to true when `SIBYL_SHOW_SEARCH_DESCRIPTION` is unset", () => {
    expect(shouldShowSearchDescription()).toBe(true);
  });

  it("returns true when set to `true`", () => {
    process.env.SIBYL_SHOW_SEARCH_DESCRIPTION = "true";
    expect(shouldShowSearchDescription()).toBe(true);
  });

  it.each(["false", "yes", "1", ""])("returns false for the non-`true` value %j", (value) => {
    process.env.SIBYL_SHOW_SEARCH_DESCRIPTION = value;
    expect(shouldShowSearchDescription()).toBe(false);
  });
});
