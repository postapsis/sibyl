/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { PluginTypeDeclaration } from "../@types/plugin.ts";
import { SilbylPlugin as exaSearch } from "./builtin-exa-search/main.ts";
import { SilbylPlugin as exaFetch } from "./builtin-exa-fetch/main.ts";
import { SilbylPlugin as brightDataSearch } from "./builtin-brightdata-search/main.ts";
import { SilbylPlugin as brightDataFetch } from "./builtin-brightdata-fetch/main.ts";
import { SilbylPlugin as crawl4aiFetch } from "./builtin-crawl4ai-fetch/main.ts";
import { SilbylPlugin as parseHtmlToMd } from "./builtin-parse-htmlToMd/main.ts";

export function getBuiltinPlugins(): PluginTypeDeclaration[] {
  return [exaSearch, exaFetch, brightDataSearch, brightDataFetch, crawl4aiFetch, parseHtmlToMd];
}
