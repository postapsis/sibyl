/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { SearchPlugin } from "../../@types/plugin.ts";
import {
  getSearchResultsLimit,
  shouldShowSearchDescription,
  stripSearchResultDatePrefix,
} from "../../utils.ts";

interface BrightDataOrganicResult {
  title: string;
  link: string;
  global_rank: number;
  description?: string;
}

interface BrightDataSerpResult {
  organic?: BrightDataOrganicResult[];
}

const PATTERN_READ_MORE = /\.\.\.\s*read more$/i;

const REQUEST_TIMEOUT_MS = 10_000;

async function searchFn(query: string) {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `BRIGHTDATA_API_KEY` environment variable.");
  }

  const zone = process.env.BRIGHTDATA_SERP_API_ZONE;
  if (!zone) {
    throw new Error("Missing `BRIGHTDATA_SERP_API_ZONE` environment variable.");
  }
  const showDescription = shouldShowSearchDescription();
  const limit = getSearchResultsLimit();

  const language = process.env.BRIGHTDATA_SERP_API_LANGUAGE ?? "en";
  const country = process.env.BRIGHTDATA_SERP_API_COUNTRY ?? "";

  let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=${language}`;

  if (country) {
    searchUrl += `&gl=${country}`;
  }

  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      zone,
      url: searchUrl,
      format: "raw",
      data_format: "parsed_light",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(
      `Bright Data search failed: ${res.status} ${res.statusText} - ${await res.text()}`,
    );
  }

  const organicResults = (await res.json()) as BrightDataSerpResult | null;

  if (!organicResults?.organic?.length) {
    return `No results for: ${query}`;
  }

  return organicResults.organic
    .slice(0, limit)
    .map((r) => {
      const title = r.title ?? "(untitled)";
      let description = r.description;

      if (showDescription && description) {
        // We strip the leading localized date prefix
        description = stripSearchResultDatePrefix(description);

        // We strip the ending "Read more" text here if it's present
        if (PATTERN_READ_MORE.test(description)) {
          description = description.replace(PATTERN_READ_MORE, "").concat("...");
        }

        return `${title}\n${r.link}\n${description}`;
      } else {
        return `${title}\n${r.link}`;
      }
    })
    .join("\n\n");
}

export const SilbylPlugin: SearchPlugin = {
  name: "builtin-brightdata-search",
  type: "search",
  fn: searchFn,
};
