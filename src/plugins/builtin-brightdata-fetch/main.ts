/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { FetchPlugin, ParsePlugin, PluginContext } from "../../@types/plugin.ts";
import { getPluginTimeout } from "../../utils.ts";

async function fetchFn(url: string, context: PluginContext): Promise<string> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `BRIGHTDATA_API_KEY` environment variable.");
  }

  const zone = process.env.BRIGHTDATA_WEB_UNLOCKER_API_ZONE;
  if (!zone) {
    throw new Error("Missing `BRIGHTDATA_WEB_UNLOCKER_API_ZONE` environment variable.");
  }

  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      zone,
      url,
      format: "raw",
    }),
    signal: AbortSignal.timeout(getPluginTimeout("fetch")),
  });

  if (!res.ok) {
    throw new Error(
      `Bright Data fetch failed: ${res.status} ${res.statusText} - ${await res.text()}`,
    );
  }

  const html = await res.text();

  const parsePlugin = context.configuredPlugins.parse as ParsePlugin;

  if (!parsePlugin) {
    return html;
  }

  return parsePlugin.fn(html, context);
}

export const SilbylPlugin: FetchPlugin = {
  name: "builtin-brightdata-fetch",
  type: "fetch",
  fn: fetchFn,
};
