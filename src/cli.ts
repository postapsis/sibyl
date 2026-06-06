#!/usr/bin/env node

/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import { loadPlugins } from "./loader.js";
import { loadOrCreateConfigDir, loadOrCreateConfigFile, loadOrCreatePluginsDir } from "./setup.ts";
import type { PluginTypeDeclaration } from "./@types/plugin.ts";

async function main(argv: string[]): Promise<void> {
  loadOrCreateConfigDir();
  loadOrCreatePluginsDir();
  const config = loadOrCreateConfigFile();
  const plugins = await loadPlugins();

  const [command] = argv;

  switch (command) {
    case undefined:
    case "--help":
    case "-h":
      printHelp();
      break;
    case "search":
      handleSearch(plugins);
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

function handleSearch(plugins: PluginTypeDeclaration[]) {
  for (const searchPlugin of plugins) {
    if (searchPlugin.type !== "search") continue;

    searchPlugin
      .fn("world")
      .then((result) => console.log(result))
      .catch((error) => console.error(`Error executing plugin: ${error}`));
  }
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
