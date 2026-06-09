/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { SearchPlugin } from "../../@types/plugin.ts";

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

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      contents: {
        highlights: false,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Exa search failed: ${res.status} ${res.statusText} - ${await res.text()}`);
  }

  const data = (await res.json()) as ExaResponse;

  if (!data.results?.length) {
    return `No results for: ${query}`;
  }

  return data.results
    .map((r) => {
      const title = r.title ?? "(untitled)";
      return `${title}\n${r.url}`;
    })
    .join("\n\n");
}

export const SilbylPlugin: SearchPlugin = {
  name: "builtin-exa-search",
  type: "search",
  fn: searchFn,
};
