/*
* Author: Jamius Siam
* Since: 06/06/2026
*/
import path from "path";
import fs from "fs";
import os from "os";

export function loadOrCreateConfigDir(): void {
  const configDir = path.join(os.homedir(), ".sibyl");

  if (!fs.existsSync(configDir)) {
    console.log(`Creating config directory at ${configDir}`);
    fs.mkdirSync(configDir, { recursive: true });
  }
}

export function loadOrCreatePluginsDir(): void {
  const pluginsDir = path.join(os.homedir(), ".sibyl", "plugins");

  if (!fs.existsSync(pluginsDir)) {
    console.log(`Creating plugins directory at ${pluginsDir}`);
    fs.mkdirSync(pluginsDir, { recursive: true });
  }
}