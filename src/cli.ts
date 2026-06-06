#!/usr/bin/env node

/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import { loadOrCreateConfigDir, loadOrCreateConfigFile, loadOrCreatePluginsDir } from "./setup.ts";
import type { FetchPlugin, PluginTypeDeclaration, SearchPlugin } from "./@types/plugin.ts";
import type { SibylConfig } from "./@types/sibyl-config.ts";
import { loadPlugins } from "./plugin-loader.ts";
import { isValidHttpUrl } from "./utils.ts";
import * as process from "node:process";

async function main(argv: string[]): Promise<void> {
  loadOrCreateConfigDir();
  loadOrCreatePluginsDir();
  const config = loadOrCreateConfigFile();

  const plugins = await loadPlugins();

  const [command, ...rest] = argv;

  switch (command) {
    case undefined:
    case "--help":
    case "-h":
      printHelp();
      break;
    case "search":
      const query = rest.join(" ").trim();

      if (!query) {
        console.error("Usage: sibyl search <query>");
        process.exit(1);
      }

      handleSearch(plugins, config, query);
      break;
    case "fetch":
      const url = rest[0]?.trim();

      if (!url) {
        console.error("Usage: sibyl fetch <url>");
        process.exit(1);
      }

      if (!isValidHttpUrl(url)) {
        console.error(`Invalid URL: ${url}`);
        process.exit(1);
      }

      handleFetch(plugins, config, url);
      break;
    case "--version":
    case "-v":
      console.log("sibyl 0.1.0");
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function handleSearch(plugins: PluginTypeDeclaration[], config: SibylConfig, query: string) {
  const searchPluginName = config.plugins.search;

  if (!searchPluginName) {
    console.error("No search plugin configured in `~/.sibyl/config.json`");
    process.exit(1);
  }

  const searchPlugin = plugins.find(
    (plugin) => plugin.type === "search" && plugin.name === searchPluginName,
  ) as SearchPlugin;

  if (!searchPlugin) {
    console.error(`Configured search plugin \`${searchPluginName}\` not found`);
    process.exit(1);
  }

  searchPlugin
    .fn(query)
    .then((result) => console.log(result))
    .catch((error) => {
      console.error(`Error searching using ${searchPlugin.name}: ${error}`);
      process.exit(1);
    });
}

function handleFetch(plugins: PluginTypeDeclaration[], config: SibylConfig, url: string) {
  const fetchPluginName = config.plugins.fetch;

  if (!fetchPluginName) {
    console.error("No fetch plugin configured in `~/.sibyl/config.json`");
    process.exit(1);
  }

  const fetchPlugin = plugins.find(
    (plugin) => plugin.type === "fetch" && plugin.name === fetchPluginName,
  ) as FetchPlugin;

  if (!fetchPlugin) {
    console.error(`Configured fetch plugin \`${fetchPluginName}\` not found`);
    process.exit(1);
  }

  fetchPlugin
    .fn(url)
    .then((result) => console.log(result))
    .catch((error) => console.error(`Error fetching using ${fetchPlugin.name}: ${error}`));
}

function printHelp(): void {
  console.log(`sibyl - CLI tool

Usage:
  sibyl <command> [options]

Commands:
  help       Show this help
  version    Show version
`);
}

void main(process.argv.slice(2));
