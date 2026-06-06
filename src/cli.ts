#!/usr/bin/env node

/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import { loadOrCreateConfigDir, loadOrCreateConfigFile, loadOrCreatePluginsDir } from "./setup.ts";
import type { PluginTypeDeclaration, SearchPlugin } from "./@types/plugin.ts";
import type { SibylConfig } from "./@types/sibyl-config.ts";
import { loadPlugins } from "./plugin-loader.ts";

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
        process.exitCode = 1;
        return;
      }

      handleSearch(plugins, config, query);
      break;
    case "--version":
    case "-v":
      console.log("sibyl 0.1.0");
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

function handleSearch(plugins: PluginTypeDeclaration[], config: SibylConfig, query: string) {
  const searchPluginName = config.plugins.search;

  if (!searchPluginName) {
    console.error("No search plugin configured in `~/.sibyl/config.json`");
    process.exitCode = 1;
    return;
  }

  const searchPlugin = plugins.find(
    (plugin) => plugin.type === "search" && plugin.name === searchPluginName,
  ) as SearchPlugin;

  if (!searchPlugin) {
    console.error(`Configured search plugin \`${searchPluginName}\` not found`);
    process.exitCode = 1;
    return;
  }

  searchPlugin
    .fn(query)
    .then((result) => console.log(result))
    .catch((error) => console.error(`Error executing ${searchPlugin.name}: ${error}`));
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
