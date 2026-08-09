/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { SearchPlugin } from "../../@types/plugin.ts";
import {
  getPluginTimeout,
  getSearchResultsLimit,
  shouldShowSearchDescription,
} from "../../utils.ts";

interface ExaResult {
  title: string | null;
  url: string;
  highlights?: string[];
}

interface ExaResponse {
  results: ExaResult[];
}

async function searchFn(query: string) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `EXA_API_KEY` environment variable.");
  }

  const showDescription = shouldShowSearchDescription();
  const limit = getSearchResultsLimit();

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: limit,
      type: "auto",
      contents: {
        highlights: showDescription,
      },
    }),
    signal: AbortSignal.timeout(getPluginTimeout("search")),
  });

  if (!res.ok) {
    throw new Error(`Exa search failed: ${res.status} ${res.statusText} - ${await res.text()}`);
  }

  const data = (await res.json()) as ExaResponse | null;

  if (!data?.results?.length) {
    return `No results for: ${query}`;
  }

  return data.results
    .slice(0, limit)
    .map((r) => {
      const title = r.title ?? "(untitled)";
      const highlights = r.highlights;

      if (showDescription && highlights) {
        // Measures to reduce tokens in exa highlights
        const processedHighlight = JSON.stringify(
          highlights
            .join(" ")
            .replace(/\[\.\.\.\]/g, "...")
            .replace(/\n/g, " ")
            .replace(/\s{2,}/g, " "),
        );

        // JSON.stringify already adds one quote pair
        return `${title}\n${r.url}\n""${processedHighlight}""`;
      } else {
        return `${title}\n${r.url}`;
      }
    })
    .join("\n\n");
}

export const SilbylPlugin: SearchPlugin = {
  name: "builtin-exa-search",
  type: "search",
  fn: searchFn,
};
