/*
 * Author: Jamius Siam
 * Since: 13/06/2026
 */
import type { FetchPlugin, ParsePlugin, PluginContext } from "../../@types/plugin.ts";
import { collapseBlankLines } from "../../utils.ts";

interface FirecrawlFetchResponse {
  success: boolean;
  data: {
    markdown?: string;
    rawHtml?: string;
  };
}

const REQUEST_TIMEOUT_MS = 10_000;

async function fetchFn(url: string, context: PluginContext): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `FIRECRAWL_API_KEY` environment variable.");
  }

  const useHtml = process.env.SIBYL_FIRECRAWL_FETCH_USE_HTML === "true";
  const format = useHtml ? "rawHtml" : "markdown";

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats: [format] }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(
      `Firecrawl fetch failed: ${res.status} ${res.statusText} - ${await res.text()}`,
    );
  }

  const body = (await res.json()) as FirecrawlFetchResponse | null;

  if (!useHtml) {
    const markdown = body?.data?.markdown;

    if (!markdown) {
      return `No content for ${url}`;
    }

    return collapseBlankLines(markdown);
  }

  const html = body?.data?.rawHtml;

  if (!html) {
    return `No content for ${url}`;
  }

  const parsePlugin = context.configuredPlugins.parse as ParsePlugin;

  if (!parsePlugin) {
    return html;
  }

  return parsePlugin.fn(html, context);
}

export const SilbylPlugin: FetchPlugin = {
  name: "builtin-firecrawl-fetch",
  type: "fetch",
  fn: fetchFn,
};
