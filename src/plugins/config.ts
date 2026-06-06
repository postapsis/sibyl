/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { PluginTypeDeclaration } from "../@types/plugin.ts";
import { searchFn as searchFnExa } from "./builtin-exa-search/main.ts";
import { fetchFn as fetchFnExa } from "./builtin-exa-fetch/main.ts";
import { searchFn as searchFnBrightData } from "./builtin-brightdata-search/main.ts";

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

  return [exaSearch, exaFetch, brightDataSearch];
}
