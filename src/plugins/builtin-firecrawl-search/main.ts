/*
 * Author: Jamius Siam
 * Since: 13/06/2026
 */
import type { SearchPlugin } from "../../@types/plugin.ts";
import { getSearchResultsLimit, shouldShowSearchDescription } from "../../utils.ts";

interface FirecrawlWebResult {
  url: string;
  title: string;
  description: string;
  position: number;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data: { web: FirecrawlWebResult[] };
  creditsUsed: number;
  id: string;
}

async function searchFn(query: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `FIRECRAWL_API_KEY` environment variable.");
  }

  const showDescription = shouldShowSearchDescription();
  const limit = getSearchResultsLimit();

  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!res.ok) {
    throw new Error(
      `Firecrawl search failed: ${res.status} ${res.statusText} - ${await res.text()}`,
    );
  }

  const data = (await res.json()) as FirecrawlSearchResponse | null;

  if (!data?.data?.web?.length) {
    return `No results for: ${query}`;
  }

  return data.data.web
    .slice(0, limit)
    .map((r) => {
      const title = r.title ?? "(untitled)";

      if (showDescription && r.description) {
        return `${title}\n${r.url}\n${r.description}`;
      } else {
        return `${title}\n${r.url}`;
      }
    })
    .join("\n\n");
}

export const SilbylPlugin: SearchPlugin = {
  name: "builtin-firecrawl-search",
  type: "search",
  fn: searchFn,
};
