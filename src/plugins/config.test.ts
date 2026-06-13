/*
 * Author: Jamius Siam
 * Since: 09/06/2026
 */
import { describe, expect, it } from "vitest";
import { getBuiltinPlugins } from "./config.ts";

describe("getBuiltinPlugins", () => {
  it("returns all the builtin plugins with the expected name/type and a fn", () => {
    const plugins = getBuiltinPlugins();

    expect(plugins.map((p) => [p.name, p.type])).toEqual([
      ["builtin-exa-search", "search"],
      ["builtin-exa-fetch", "fetch"],
      ["builtin-brightdata-search", "search"],
      ["builtin-brightdata-fetch", "fetch"],
      ["builtin-crawl4ai-fetch", "fetch"],
      ["builtin-alterlab-fetch", "fetch"],
      ["builtin-parse-htmlToMd", "parse"],
      ["builtin-searxng-search", "search"],
      ["builtin-alterlab-search", "search"],
      ["builtin-firecrawl-search", "search"],
      ["builtin-firecrawl-fetch", "fetch"],
    ]);

    for (const plugin of plugins) {
      expect(typeof plugin.fn).toBe("function");
    }
  });
});
