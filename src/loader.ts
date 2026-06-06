/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import fs from "fs";
import path from "path";
import os from "os";
import { pathToFileURL } from "url";
import type { PluginTypeDeclaration } from "./@types/plugin.ts";

const PLUGIN_FN_FIELD = {
  search: "searchFn",
  fetch: "fetchFn",
  ask: "askFn",
} as const;

function validatePlugin(plugin: any, folderName: string): PluginTypeDeclaration | null {
  if (!plugin?.SilbylPlugin || typeof plugin?.SilbylPlugin !== "object") {
    console.warn(
      `Skipping plugin \`${folderName}\`: \`SilbylPlugin\` export missing or not an object.`,
    );
    return null;
  }

  const declaration = plugin.SilbylPlugin as Record<string, unknown>;

  if (typeof declaration.type !== "string" || !(declaration.type in PLUGIN_FN_FIELD)) {
    console.warn(
      `Skipping plugin \`${folderName}\`: invalid \`type\` in \`SilbylPlugin\` (expected one of search, fetch, ask).`,
    );
    return null;
  }

  const pluginType = declaration.type as keyof typeof PLUGIN_FN_FIELD;

  const fnField = PLUGIN_FN_FIELD[pluginType];
  if (typeof plugin[fnField] !== "function") {
    console.warn(
      `Skipping plugin \`${folderName}\`: missing \`${fnField}\` function for plugin type \`${pluginType}\`.`,
    );
    return null;
  }

  return { name: folderName, type: pluginType, fn: plugin[fnField] };
}

export async function loadPlugins() {
  const pluginDir = path.join(os.homedir(), ".sibyl", "plugins");
  const result: PluginTypeDeclaration[] = [];

  const folders = fs
    .readdirSync(pluginDir, { withFileTypes: true })
    .filter((f) => f.isDirectory() && !f.name.startsWith("."));

  for (const folder of folders) {
    if (folder.name.startsWith("builtin-")) {
      console.warn(
        `Plugin name CAN NOT start with \`builtin-\`. Skipping plugin \`${folder.name}\``,
      );
      continue;
    }
    const fullPath = path.join(pluginDir, folder.name, "main.js");
    if (!fs.existsSync(fullPath)) {
      console.warn(`Plugin \`${folder.name}\` does not have a main.js file. Skipping.`);
      continue;
    }

    try {
      const plugin = await import(pathToFileURL(fullPath).href);
      const validatedPlugin = validatePlugin(plugin, folder.name);

      if (!validatedPlugin) {
        continue;
      }

      result.push(validatedPlugin);
    } catch (err: any) {
      console.error(`Error loading plugin from \`${folder.name}\`:`, err.message);
    }
  }

  return result;
}
