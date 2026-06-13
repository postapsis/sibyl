/*
 * Author: Jamius Siam
 * Since: 10/06/2026
 */
import { describe, expect, it } from "vitest";
import { collapseBlankLines, isValidHttpUrl, stripSearchResultDatePrefix } from "./utils.ts";

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
