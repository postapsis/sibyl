/*
 * Author: Jamius Siam
 * Since: 13/06/2026
 */
import type { FetchPlugin, ParsePlugin, PluginContext } from "../../@types/plugin.ts";
import { getPluginTimeout } from "../../utils.ts";

interface Result {
  html: string;
}

interface AlterLabScrapeResponse {
  url: string;
  status_code: number;
  content?: Result;
}

async function fetchFn(url: string, context: PluginContext): Promise<string> {
  const apiKey = process.env.ALTERLAB_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `ALTERLAB_API_KEY` environment variable.");
  }

  const res = await fetch("https://api.alterlab.io/api/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ url, force_refresh: true, sync: true }),
    signal: AbortSignal.timeout(getPluginTimeout("fetch")),
  });

  if (!res.ok) {
    throw new Error(`AlterLab fetch failed: ${res.status} ${res.statusText} - ${await res.text()}`);
  }

  const body = (await res.json()) as AlterLabScrapeResponse;

  const html = body.content?.html;

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
  name: "builtin-alterlab-fetch",
  type: "fetch",
  fn: fetchFn,
};
