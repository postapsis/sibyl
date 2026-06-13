/*
 * Author: Jamius Siam
 * Since: 13/06/2026
 */
import type { SearchPlugin } from "../../@types/plugin.ts";
import { stripSearchResultDatePrefix } from "../../utils.ts";

interface AlterLabResult {
  url: string;
  title: string;
  snippet: string;
  position: number;
}

interface AlterLabSearchResponse {
  query: string;
  results: AlterLabResult[];
}

async function searchFn(query: string) {
  const apiKey = process.env.ALTERLAB_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `ALTERLAB_API_KEY` environment variable.");
  }

  const showDescription = process.env.SIBYL_SHOW_SEARCH_DESCRIPTION === "true";

  const res = await fetch("https://api.alterlab.io/api/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ query, num_results: 10 }),
  });

  if (!res.ok) {
    throw new Error(
      `AlterLab search failed: ${res.status} ${res.statusText} - ${await res.text()}`,
    );
  }

  const data = (await res.json()) as AlterLabSearchResponse | null;

  if (!data?.results?.length) {
    return `No results for: ${query}`;
  }

  return data.results
    .map((r) => {
      const title = r.title ?? "(untitled)";

      if (showDescription && r.snippet) {
        return `${title}\n${r.url}\n${stripSearchResultDatePrefix(r.snippet)}`;
      } else {
        return `${title}\n${r.url}`;
      }
    })
    .join("\n\n");
}

export const SilbylPlugin: SearchPlugin = {
  name: "builtin-alterlab-search",
  type: "search",
  fn: searchFn,
};
