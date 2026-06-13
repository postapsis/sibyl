/*
 * Author: Jamius Siam
 * Since: 12/06/2026
 */
import type { FetchPlugin, ParsePlugin, PluginContext } from "../../@types/plugin.ts";

interface Result {
  url: string;
  html: string;
  error_message: string;
  status_code: number;
}

interface Crawl4AiResult {
  success: boolean;
  results?: Result[];
}

const REQUEST_TIMEOUT_MS = 10_000;

async function fetchFn(url: string, context: PluginContext): Promise<string> {
  const crawl4AiUrl = process.env.SIBYL_CRAWL4AI_URL ?? "http://localhost:11235";
  const crawl4AiCrawlApiUrl = crawl4AiUrl + "/crawl";

  let res: Response;

  try {
    res = await fetch(crawl4AiCrawlApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls: [url],
        browser_config: {
          headless: true,
          user_agent:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        },
        crawler_config: {
          output_formats: ["html"],
          magic: true,
          clean_html: false,
          simulate_user: true,
          override_navigator: true,
          wait_until: "networkidle",
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(
      `Is Crawl4AI reachable on ${crawl4AiUrl}?
DockerHub Page: https://hub.docker.com/r/unclecode/crawl4ai
You can run it with:

  docker run -d --restart unless-stopped -p 11235:11235 --shm-size=3g --name crawl4ai unclecode/crawl4ai:latest\n
`,
    );

    throw err;
  }

  if (!res.ok) {
    throw new Error(`Crawl4AI fetch failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as Crawl4AiResult;

  if (!body.success) {
    throw new Error("Crawl4AI fetch failed: Crawl4AI success response false");
  }

  if (!body.results || body.results?.length === 0) {
    return `No content for ${url}`;
  }

  const html = body.results[0]?.html;

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
  name: "builtin-crawl4ai-fetch",
  type: "fetch",
  fn: fetchFn,
};
