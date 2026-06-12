/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
export interface SearchPlugin {
  name: string;
  type: "search";
  fn: (query: string, context: PluginContext) => Promise<string>;
}

export interface FetchPlugin {
  name: string;
  type: "fetch";
  fn: (url: string, context: PluginContext) => Promise<string>;
}

export interface AskPlugin {
  name: string;
  type: "ask";
  fn: (src: string, query: string, context: PluginContext) => Promise<string>;
}

export interface ParsePlugin {
  name: string;
  type: "parse";
  fn: (html: string, context: PluginContext) => Promise<string>;
}

export type PluginTypeDeclaration = SearchPlugin | FetchPlugin | AskPlugin | ParsePlugin;

export type PluginType = "search" | "fetch" | "ask" | "parse";

export interface PluginContext {
  configuredPlugins: Partial<Record<PluginType, PluginTypeDeclaration>>;
  allPlugins: PluginTypeDeclaration[];
  getPlugin: (name: string) => PluginTypeDeclaration | null;
}
