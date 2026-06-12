/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { ParsePlugin } from "../../@types/plugin.ts";

// Passthrough for now: returns the input unchanged. Will later convert HTML to
// token-efficient markdown.
async function parseHtmlFn(html: string) {
  return html + "\n\n html parse TODO";
}

export const SilbylPlugin: ParsePlugin = {
  name: "builtin-parse-htmlToMd",
  type: "parse",
  fn: parseHtmlFn,
};
