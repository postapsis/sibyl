/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
import fs from "fs";
import path from "path";
import os from "os";
import { pathToFileURL } from "url";
import type { PluginType, PluginTypeDeclaration } from "./@types/plugin.ts";
import { getBuiltinPlugins } from "./plugins/config.ts";

const PLUGIN_TYPES: Record<PluginType, true> = {
  search: true,
  fetch: true,
  ask: true,
  parse: true,
};

export async function loadPlugins(): Promise<PluginTypeDeclaration[]> {
  const builtinPlugins = getBuiltinPlugins();
  const externalPlugins = await loadExternalPlugins();

  return [...builtinPlugins, ...externalPlugins];
}

async function loadExternalPlugins(): Promise<PluginTypeDeclaration[]> {
  const pluginDir = path.join(os.homedir(), ".config", "sibyl", "plugins");
  const result: PluginTypeDeclaration[] = [];

  if (!fs.existsSync(pluginDir)) {
    return result;
  }

  try {
    const folders = fs
      .readdirSync(pluginDir, { withFileTypes: true })
      .filter((f) => f.isDirectory() && !f.name.startsWith("."));

    for (const folder of folders) {
      if (folder.name.startsWith("builtin")) {
        console.warn(
          `Plugin name CAN NOT start with \`builtin\`. Skipping plugin \`${folder.name}\`.`,
        );
        continue;
      }
      const fullPath = path.join(pluginDir, folder.name, "main.js");
      if (!fs.existsSync(fullPath)) {
        console.warn(
          `Plugin \`${folder.name}\` does not have a main.js file. Skipping plugin \`${folder.name}\`.`,
        );
        continue;
      }

      try {
        const plugin = await import(pathToFileURL(fullPath).href);
        const validatedPlugin = validatePlugin(plugin, folder.name);

        if (!validatedPlugin) {
          continue;
        }

        result.push(validatedPlugin);
      } catch (err: unknown) {
        console.error(`Error loading plugin from \`${folder.name}\`:`, err);
      }
    }
  } catch (error: unknown) {
    console.error(`Error scanning plugins from ${pluginDir}: `, error);
  }

  return result;
}

function validatePlugin(plugin: any, folderName: string): PluginTypeDeclaration | null {
  if (!plugin?.SilbylPlugin || typeof plugin?.SilbylPlugin !== "object") {
    console.warn(
      `Skipping plugin in \`${folderName}\`: \`SilbylPlugin\` export missing or not an object.`,
    );
    return null;
  }

  const declaration = plugin.SilbylPlugin as Record<string, unknown>;

  if (typeof declaration.name !== "string" || declaration.name.trim() === "") {
    console.warn(
      `Skipping plugin in \`${folderName}\`: missing or empty \`name\` in \`SilbylPlugin\`.`,
    );
    return null;
  }

  if (typeof declaration.type !== "string" || !(declaration.type in PLUGIN_TYPES)) {
    console.warn(
      `Skipping plugin in \`${folderName}\`: invalid \`type\` in \`SilbylPlugin\` (expected one of search, fetch, ask, parse).`,
    );
    return null;
  }

  const pluginType = declaration.type as PluginType;
  const pluginName = declaration.name;

  if (typeof declaration.fn !== "function") {
    console.warn(`Skipping plugin \`${pluginName}\`: missing \`fn\` function in \`SilbylPlugin\`.`);
    return null;
  }

  return { name: pluginName, type: pluginType, fn: declaration.fn } as PluginTypeDeclaration;
}
