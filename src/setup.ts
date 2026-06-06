/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import path from "path";
import fs from "fs";
import os from "os";
import type { SibylConfig } from "./@types/sibyl-config.ts";

export function loadOrCreateConfigDir(): void {
  const configDir = path.join(os.homedir(), ".sibyl");

  if (!fs.existsSync(configDir)) {
    console.log(`Creating config directory at ${configDir}`);
    fs.mkdirSync(configDir, { recursive: true });
  }
}

export function loadOrCreateConfigFile(): SibylConfig {
  const configFile = path.join(os.homedir(), ".sibyl", "config.json");

  if (!fs.existsSync(configFile) || isFileEmptySync(configFile)) {
    writeDefaultSibylConfig();
  }

  return JSON.parse(fs.readFileSync(configFile, "utf8")) as SibylConfig;
}

export function loadOrCreatePluginsDir(): void {
  const pluginsDir = path.join(os.homedir(), ".sibyl", "plugins");

  if (!fs.existsSync(pluginsDir)) {
    console.log(`Creating plugins directory at ${pluginsDir}`);
    fs.mkdirSync(pluginsDir, { recursive: true });
  }
}

export function writeDefaultSibylConfig(): void {
  const configFile = path.join(os.homedir(), ".sibyl", "config.json");
  console.log(`Creating config file at ${configFile}`);

  const sibylConfig: SibylConfig = {
    plugins: [
      {
        type: "search",
        name: "builtin-exa-search",
      },
      {
        type: "fetch",
        name: "builtin-exa-fetch",
      },
      {
        type: "parseHtml",
        name: "builtin-parseHtmlToMd",
      },
    ],
  };

  fs.writeFileSync(configFile, JSON.stringify(sibylConfig, null, 2));
}

function isFileEmptySync(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    return stats.size === 0;
  } catch (error) {
    console.error(`Error reading the config file at: ${filePath}`, error);
    return false;
  }
}
