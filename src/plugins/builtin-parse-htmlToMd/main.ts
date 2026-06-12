/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import type { ParsePlugin } from "../../@types/plugin.ts";
import * as cheerio from "cheerio";
import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";
import TurndownService from "turndown";

// Tags removed entirely (including their contents) before extraction.
const REMOVE_TAGS = [
  "script",
  "style",
  "svg",
  "img",
  "video",
  "audio",
  "iframe",
  "noscript",
  "canvas",
  "figure",
  "picture",
  "link",
  "meta",
  "head",
];

// Attributes kept per tag; every other attribute is stripped.
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href"],
  td: ["colspan", "rowspan"],
};

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

function cleanHtml(rawHtml: string): string {
  const $ = cheerio.load(rawHtml);

  $(REMOVE_TAGS.join(",")).remove();

  $("*").each((_, el) => {
    if (el.type !== "tag") {
      return;
    }

    const allowed = ALLOWED_ATTRS[el.name] ?? [];
    for (const name of Object.keys(el.attribs)) {
      if (!allowed.includes(name)) {
        delete el.attribs[name];
      }
    }
  });

  return $.html();
}

async function parseHtmlFn(html: string): Promise<string> {
  const cleaned = cleanHtml(html);
  const { document } = parseHTML(cleaned);

  // `useAsync: false` keeps extraction local — never fetch from third-party APIs.
  const article = await Defuddle(document, undefined, { useAsync: false });
  const contentHtml = article.content;

  if (!contentHtml) {
    return "";
  }

  // Convert to markdown, then collapse 2+ consecutive blank lines into one.
  return turndownService
    .turndown(contentHtml)
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export const SilbylPlugin: ParsePlugin = {
  name: "builtin-parse-htmlToMd",
  type: "parse",
  fn: parseHtmlFn,
};
