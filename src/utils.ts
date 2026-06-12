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
