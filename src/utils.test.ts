/*
 * Author: Jamius Siam
 * Since: 10/06/2026
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collapseBlankLines,
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
