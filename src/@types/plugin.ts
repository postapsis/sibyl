/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
export interface SearchPlugin {
  name: string;
  type: "search";
  fn: (query: string) => Promise<string>;
}

export interface FetchPlugin {
  name: string;
  type: "fetch";
  fn: (url: string) => Promise<string>;
}

export interface AskPlugin {
  name: string;
  type: "ask";
  fn: (parsedContent: string, query: string) => Promise<string>;
}

export interface ParseHtmlPlugin {
  name: string;
  type: "parseHtml";
  fn: (html: string) => Promise<string>;
}

export type PluginTypeDeclaration = SearchPlugin | FetchPlugin | AskPlugin | ParseHtmlPlugin;
