/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
interface ExaContentResult {
  url: string;
  title: string | null;
  text?: string;
}

interface ExaContentsResponse {
  results: ExaContentResult[];
}

export async function fetchFn(url: string) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `EXA_API_KEY` environment variable.");
  }

  const res = await fetch("https://api.exa.ai/contents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      urls: [url],
      text: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Exa fetch failed: ${res.status} ${res.statusText} - ${await res.text()}`);
  }

  const data = (await res.json()) as ExaContentsResponse;

  if (!data.results?.length) {
    return `No content for: ${url}`;
  }

  return data.results.map((r) => r.text ?? "").join("\n\n");
}

export const SilbylPlugin = {
  name: "builtin-exa-fetch",
  type: "fetch",
};
