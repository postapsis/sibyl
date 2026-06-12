/*
 * Author: Jamius Siam
 * Since: 13/06/2026
 */
import type { SearchPlugin } from "../../@types/plugin.ts";
import { stripSearchResultDatePrefix } from "../../utils.ts";

interface Result {
  url: string;
  title: string;
  content: string;
  engine: string;
}

interface SearXngResult {
  query: string;
  results: Result[];
}

async function searchFn(query: string) {
  const searxngUrl = process.env.SIBYL_SEARXNG_URL ?? "http://localhost:8080";
  const showDescription = process.env.SIBYL_SHOW_SEARCH_DESCRIPTION === "true";
  const params = new URLSearchParams({ q: query, format: "json" });

  const engines = process.env.SIBYL_SEARXNG_ENGINES;
  if (engines) {
    params.set("engines", engines);
  }

  let res: Response;

  try {
    res = await fetch(`${searxngUrl}/search?${params.toString()}`);
  } catch (err) {
    console.warn(
      `Is SearXNG reachable on ${searxngUrl}?\nGitHub: https://github.com/searxng/searxng`,
    );

    throw err;
  }

  if (res.status === 403) {
    console.warn(
      `Does the SearXNG instance on ${searxngUrl} have JSON output enabled?
Ensure the JSON output format is enabled (see https://github.com/searxng/searxng/discussions/3542).\n`,
    );

    throw new Error("SearXNG search failed: 403 Forbidden");
  }

  if (!res.ok) {
    throw new Error(`SearXNG search failed: ${res.status} ${res.statusText} - ${await res.text()}`);
  }

  const data = (await res.json()) as SearXngResult | null;

  if (!data?.results?.length) {
    return `No results for: ${query}`;
  }

  return data.results
    .map((r) => {
      const title = r.title ?? "(untitled)";

      if (showDescription && r.content) {
        return `${title}\n${r.url}\n${stripSearchResultDatePrefix(r.content)}`;
      } else {
        return `${title}\n${r.url}`;
      }
    })
    .join("\n\n");
}

export const SilbylPlugin: SearchPlugin = {
  name: "builtin-searxng-search",
  type: "search",
  fn: searchFn,
};
