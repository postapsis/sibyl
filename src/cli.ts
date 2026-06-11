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
import { exit } from "./exit.ts";
import { pathToFileURL } from "node:url";
import * as process from "node:process";

export async function main(argv: string[]): Promise<void> {
  loadOrCreateConfigDir();
  loadOrCreatePluginsDir();
  const config = loadOrCreateConfigFile();

  const plugins = await loadPlugins();

  const [command, ...rest] = argv;

  switch (command) {
    case undefined:
    case "--help":
    case "-h":
    case "help":
      printHelp();
      break;
    case "search": {
      const query = rest.join(" ").trim();

      if (!query) {
        console.error("Usage: sibyl search <query>");
        exit(1);
      }

      await handleSearch(plugins, config, query);
      break;
    }
    case "fetch": {
      const url = rest[0]?.trim();

      if (!url) {
        console.error("Usage: sibyl fetch <url>");
        exit(1);
      }

      if (!isValidHttpUrl(url)) {
        console.error(`Invalid URL: ${url}`);
        exit(1);
      }

      await handleFetch(plugins, config, url);
      break;
    }
    case "--version":
    case "version":
      console.log("sibyl 0.1.0");
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      exit(1);
  }
}

async function handleSearch(
  plugins: PluginTypeDeclaration[],
  config: SibylConfig,
  query: string,
): Promise<void> {
  const searchPluginName = config.plugins.search;

  if (!searchPluginName) {
    console.error("No search plugin configured in `~/.sibyl/config.json`");
    exit(1);
  }

  const searchPlugin = plugins.find(
    (plugin) => plugin.type === "search" && plugin.name === searchPluginName,
  ) as SearchPlugin;

  if (!searchPlugin) {
    console.error(`Configured search plugin \`${searchPluginName}\` not found`);
    exit(1);
  }

  try {
    const result = await searchPlugin.fn(query);
    console.log(result);
  } catch (error) {
    console.error(`Error searching using ${searchPlugin.name}: ${error}`);
    exit(1);
  }
}

async function handleFetch(
  plugins: PluginTypeDeclaration[],
  config: SibylConfig,
  url: string,
): Promise<void> {
  const fetchPluginName = config.plugins.fetch;

  if (!fetchPluginName) {
    console.error("No fetch plugin configured in `~/.sibyl/config.json`");
    exit(1);
  }

  const fetchPlugin = plugins.find(
    (plugin) => plugin.type === "fetch" && plugin.name === fetchPluginName,
  ) as FetchPlugin;

  if (!fetchPlugin) {
    console.error(`Configured fetch plugin \`${fetchPluginName}\` not found`);
    exit(1);
  }

  try {
    const result = await fetchPlugin.fn(url);
    console.log(result);
  } catch (error) {
    console.error(`Error searching using ${fetchPlugin.name}: ${error}`);
    exit(1);
  }
}

function printHelp(): void {
  console.log(`sibyl - CLI tool

Usage:
  sibyl <command> [options]

Commands:
  search <query>   Search the web
  fetch <url>      Fetch the content of a URL
  help             Show this help
  version          Show version

Examples:
  sibyl search "react vite bootstrap"
  sibyl fetch https://vite.dev/guide
`);
}

const entry = process.argv[1];
const isCli = entry !== undefined && import.meta.url === pathToFileURL(entry).href;

if (isCli) {
  void main(process.argv.slice(2));
}
