/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
export function isValidHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }

  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}

// Strips a leading localized date prefix from a search-result description.
// Google SERP descriptions are formatted "<date> · <text>" where the date may be in any
// script (e.g. "2025年9月15日 · …"). We only strip when the prefix contains a digit (any
// script via \p{Nd}) and is short, so a description that merely contains a "·" is left intact.
const DATE_PREFIX_PATTERN = /^(?=[^·•\n]*\p{Nd})[^·•\n]{1,40}?\s+[·•]\s+/u;

export function stripSearchResultDatePrefix(text: string): string {
  return text.replace(DATE_PREFIX_PATTERN, "");
}

export function collapseBlankLines(markdown: string): string {
  return markdown.replace(/\n{2,}/g, "\n").trim();
}

const DEFAULT_PLUGIN_TIMEOUTS = {
  search: 10_000,
  fetch: 10_000,
  ask: 30_000,
} as const;

const PLUGIN_TIMEOUT_ENV_NAMES = {
  search: "SIBYL_SEARCH_TIMEOUT",
  fetch: "SIBYL_FETCH_TIMEOUT",
  ask: "SIBYL_ASK_TIMEOUT",
} as const;

const MAX_PLUGIN_TIMEOUT_MS = 2_147_483_647;

type TimeoutPluginType = keyof typeof DEFAULT_PLUGIN_TIMEOUTS;

export function getPluginTimeout(type: TimeoutPluginType): number {
  const envName = PLUGIN_TIMEOUT_ENV_NAMES[type];
  const raw = process.env[envName];

  if (raw === undefined) {
    return DEFAULT_PLUGIN_TIMEOUTS[type];
  }

  const value = raw.trim();
  const timeout = Number(value);

  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(timeout) ||
    timeout < 1 ||
    timeout > MAX_PLUGIN_TIMEOUT_MS
  ) {
    throw new Error(
      `Invalid \`${envName}\`: expected an integer between 1 and ${MAX_PLUGIN_TIMEOUT_MS} milliseconds.`,
    );
  }

  return timeout;
}

// Maximum number of results a search plugin should return. Read from
// `SIBYL_SEARCH_RESULTS_LIMIT`, falling back to 10 when unset or
// invalid (non-numeric, floating point or <= 0).
export function getSearchResultsLimit(): number {
  const raw = process.env.SIBYL_SEARCH_RESULTS_LIMIT;
  const normalized = raw?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) {
    return 10;
  }

  const parsed = Number.parseInt(normalized, 10);
  return parsed > 0 ? parsed : 10;
}

// Whether search plugins should include result descriptions. Defaults to true when
// `SIBYL_SHOW_SEARCH_DESCRIPTION` is absent; otherwise it must equal "true".
export function shouldShowSearchDescription(): boolean {
  const raw = process.env.SIBYL_SHOW_SEARCH_DESCRIPTION;
  return raw === undefined ? true : raw === "true";
}
