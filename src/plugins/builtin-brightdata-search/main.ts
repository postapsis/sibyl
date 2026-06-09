/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { SearchPlugin } from "../../@types/plugin.ts";

interface BrightDataOrganicResult {
  title?: string;
  link?: string;
  description?: string;
}

interface BrightDataSerp {
  organic?: BrightDataOrganicResult[];
}

async function searchFn(query: string) {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `BRIGHTDATA_API_KEY` environment variable.");
  }

  const zone = process.env.BRIGHTDATA_SERP_API_ZONE;
  if (!zone) {
    throw new Error("Missing `BRIGHTDATA_SERP_API_ZONE` environment variable.");
  }

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`;

  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      zone,
      url: searchUrl,
      format: "json",
      data_format: "parsed_light",
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Bright Data search failed: ${res.status} ${res.statusText} - ${await res.text()}`,
    );
  }

  const serp = parseSerp(await res.json());

  if (!serp.organic?.length) {
    return `No results for: ${query}`;
  }

  return serp.organic
    .map((r) => {
      const title = r.title ?? "(untitled)";
      const description = r.description ? `\n${r.description}` : "";
      return `${title}\n${r.link}${description}`;
    })
    .join("\n\n");
}

// The parsed SERP is either returned directly or wrapped under a `body` field
// (which may itself be a JSON string), depending on the response envelope.
function parseSerp(data: unknown): BrightDataSerp {
  const root = data as { body?: unknown };
  const body = root?.body;

  if (typeof body === "string") {
    return JSON.parse(body) as BrightDataSerp;
  }

  if (body && typeof body === "object") {
    return body as BrightDataSerp;
  }

  return (data ?? {}) as BrightDataSerp;
}

export const SilbylPlugin: SearchPlugin = {
  name: "builtin-brightdata-search",
  type: "search",
  fn: searchFn,
};
