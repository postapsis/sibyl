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
import { SilbylPlugin as alterlabFetch } from "./builtin-alterlab-fetch/main.ts";
import { SilbylPlugin as alterlabSearch } from "./builtin-alterlab-search/main.ts";
import { SilbylPlugin as firecrawlSearch } from "./builtin-firecrawl-search/main.ts";
import { SilbylPlugin as firecrawlFetch } from "./builtin-firecrawl-fetch/main.ts";
import { SilbylPlugin as parseHtmlToMd } from "./builtin-parse-htmlToMd/main.ts";
import { SilbylPlugin as searxngSearch } from "./builtin-searxng-search/main.ts";
import { SilbylPlugin as aiAsk } from "./builtin-ai-ask/main.ts";

export function getBuiltinPlugins(): PluginTypeDeclaration[] {
  return [
    exaSearch,
    exaFetch,
    brightDataSearch,
    brightDataFetch,
    crawl4aiFetch,
    alterlabFetch,
    parseHtmlToMd,
    searxngSearch,
    alterlabSearch,
    firecrawlSearch,
    firecrawlFetch,
    aiAsk,
  ];
}
