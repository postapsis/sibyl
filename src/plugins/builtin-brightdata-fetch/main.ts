/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
export async function fetchFn(url: string) {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing `BRIGHTDATA_API_KEY` environment variable.");
  }

  const zone = process.env.BRIGHTDATA_WEB_UNLOCKER_API_NAME;
  if (!zone) {
    throw new Error("Missing `BRIGHTDATA_WEB_UNLOCKER_API_NAME` environment variable.");
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
  });

  if (!res.ok) {
    throw new Error(
      `Bright Data fetch failed: ${res.status} ${res.statusText} - ${await res.text()}`,
    );
  }

  // `format: "raw"` returns the page body verbatim (HTML), not a JSON envelope.
  return await res.text();
}

export const SilbylPlugin = {
  name: "builtin-brightdata-fetch",
  type: "fetch",
};
