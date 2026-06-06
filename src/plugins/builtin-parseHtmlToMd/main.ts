/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */

// Passthrough for now: returns the input unchanged. Will later convert HTML to
// token-efficient markdown.
export async function parseHtmlFn(html: string) {
  return html + "\n\n html parse TODO";
}

export const SilbylPlugin = {
  name: "builtin-parseHtmlToMd",
  type: "parseHtml",
};
