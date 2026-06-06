/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { PluginTypeDeclaration } from "../@types/plugin.ts";
import { searchFn as searchFnExa } from "./builtin-exa-search/main.ts";
import { fetchFn as fetchFnExa } from "./builtin-exa-fetch/main.ts";
import { searchFn as searchFnBrightData } from "./builtin-brightdata-search/main.ts";
import { fetchFn as fetchFnBrightData } from "./builtin-brightdata-fetch/main.ts";
import { parseHtmlFn as parseHtmlFnToMd } from "./builtin-parseHtmlToMd/main.ts";

export function getBuiltinPlugins(): PluginTypeDeclaration[] {
  const exaSearch: PluginTypeDeclaration = {
    type: "search",
    name: "builtin-exa-search",
    fn: searchFnExa,
  };

  const exaFetch: PluginTypeDeclaration = {
    type: "fetch",
    name: "builtin-exa-fetch",
    fn: fetchFnExa,
  };

  const brightDataSearch: PluginTypeDeclaration = {
    type: "search",
    name: "builtin-brightdata-search",
    fn: searchFnBrightData,
  };

  const brightDataFetch: PluginTypeDeclaration = {
    type: "fetch",
    name: "builtin-brightdata-fetch",
    fn: fetchFnBrightData,
  };

  const parseHtmlToMd: PluginTypeDeclaration = {
    type: "parseHtml",
    name: "builtin-parseHtmlToMd",
    fn: parseHtmlFnToMd,
  };

  return [exaSearch, exaFetch, brightDataSearch, brightDataFetch, parseHtmlToMd];
}
