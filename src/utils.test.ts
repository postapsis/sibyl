/*
 * Author: Jamius Siam
 * Since: 10/06/2026
 */
import { describe, expect, it } from "vitest";
import { isValidHttpUrl } from "./utils.ts";

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
