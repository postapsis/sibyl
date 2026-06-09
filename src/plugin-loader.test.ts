/*
 * Author: Jamius Siam
 * Since: 08/06/2026
 */
import { beforeEach, vi, it, describe, afterEach, expect } from "vitest";
import os from "os";
import fs from "fs";
import path from "path";
import { getBuiltinPlugins } from "./plugins/config.ts";
import { loadPlugins } from "./plugin-loader.ts";
import type { SearchPlugin } from "./@types/plugin.ts";

let homeDirPath: string;
let sibylDir: string;
let pluginsDir: string;

beforeEach(() => {
  homeDirPath = fs.mkdtempSync(path.join(os.tmpdir(), "sibyl-test-"));
  sibylDir = path.join(homeDirPath, ".sibyl");
  pluginsDir = path.join(sibylDir, "plugins");

  fs.mkdirSync(sibylDir, { recursive: true });

  vi.spyOn(os, "homedir").mockReturnValue(homeDirPath);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(homeDirPath, { recursive: true, force: true });
});

it("returns only built-in plugins when `plugins` dir is absent", async () => {
  const builtinPlugins = getBuiltinPlugins();
  const plugins = await loadPlugins();

  expect(plugins).toEqual(builtinPlugins);
});

describe("loads plugins correctly", () => {
  beforeEach(() => {
    fs.mkdirSync(pluginsDir);
  });

  it("returns only built-in plugins when no plugins are present in the `plugins` dir", async () => {
    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns only built-in plugins and warns when plugin name starts with `builtin`", async () => {
    fs.mkdirSync(path.join(pluginsDir, "builtin-test-plugin"));

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);
    expect(console.warn).toHaveBeenCalledWith(
      "Plugin name CAN NOT start with `builtin`. Skipping plugin `builtin-test-plugin`.",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns only built-in plugins and warns when no `main.js` file in plugin", async () => {
    fs.mkdirSync(path.join(pluginsDir, "test-plugin"));

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);
    expect(console.warn).toHaveBeenCalledWith(
      "Plugin `test-plugin` does not have a main.js file. Skipping plugin `test-plugin`.",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and a valid custom search plugin", async () => {
    const testPluginDir = path.join(pluginsDir, "test-search-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
async function searchFn(query) {
    return "hello " + query;
}

export const SilbylPlugin = {
    name: "test-search-plugin",
    type: "search",
    fn: searchFn
}
    `,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();
    const customPlugin = plugins.at(-1)! as SearchPlugin;

    expect(plugins.slice(0, -1)).toEqual(builtinPlugins);
    expect(customPlugin?.name).toEqual("test-search-plugin");
    expect(customPlugin?.type).toEqual("search");
    await expect(customPlugin.fn("testing")).resolves.toEqual("hello testing");

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and warns for an invalid custom search plugin (no `SilbylPlugin` export) ", async () => {
    const testPluginDir = path.join(pluginsDir, "test-search-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
export async function searchFn(query) {
    return "hello " + query;
}
    `,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);

    expect(console.warn).toHaveBeenCalledWith(
      "Skipping plugin in `test-search-plugin`: `SilbylPlugin` export missing or not an object.",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and warns for an invalid custom search plugin (`SilbylPlugin` export is not an object) ", async () => {
    const testPluginDir = path.join(pluginsDir, "test-search-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
export async function searchFn(query) {
    return "hello " + query;
}

export const SilbylPlugin = "test-search-plugin";
    `,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);

    expect(console.warn).toHaveBeenCalledWith(
      "Skipping plugin in `test-search-plugin`: `SilbylPlugin` export missing or not an object.",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and warns for an invalid custom search plugin (`SilbylPlugin` has no `name` property) ", async () => {
    const testPluginDir = path.join(pluginsDir, "test-search-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
export async function searchFn(query) {
    return "hello " + query;
}

export const SilbylPlugin = {
    type: "search"
}
`,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);

    expect(console.warn).toHaveBeenCalledWith(
      "Skipping plugin in `test-search-plugin`: missing or empty `name` in `SilbylPlugin`.",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and warns for an invalid custom search plugin (`SilbylPlugin` has empty `name` property) ", async () => {
    const testPluginDir = path.join(pluginsDir, "test-search-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
export async function searchFn(query) {
    return "hello " + query;
}

export const SilbylPlugin = {
    name: "",
    type: "search"
}
`,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);

    expect(console.warn).toHaveBeenCalledWith(
      "Skipping plugin in `test-search-plugin`: missing or empty `name` in `SilbylPlugin`.",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and warns for an invalid custom search plugin (`SilbylPlugin` has no `type` property) ", async () => {
    const testPluginDir = path.join(pluginsDir, "test-search-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
export async function searchFn(query) {
    return "hello " + query;
}

export const SilbylPlugin = {
    name: "test-search-plugin"
}
`,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);

    expect(console.warn).toHaveBeenCalledWith(
      "Skipping plugin in `test-search-plugin`: invalid `type` in `SilbylPlugin` (expected one of search, fetch, ask, parse).",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and warns for an invalid custom search plugin (`SilbylPlugin` has empty `type` property) ", async () => {
    const testPluginDir = path.join(pluginsDir, "test-search-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
export async function searchFn(query) {
    return "hello " + query;
}

export const SilbylPlugin = {
    name: "test-search-plugin",
    type: ""
}
`,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);

    expect(console.warn).toHaveBeenCalledWith(
      "Skipping plugin in `test-search-plugin`: invalid `type` in `SilbylPlugin` (expected one of search, fetch, ask, parse).",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and warns for an invalid custom search plugin (`SilbylPlugin` has no `fn` property) ", async () => {
    const testPluginDir = path.join(pluginsDir, "test-search-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
export const SilbylPlugin = {
    name: "test-search-plugin",
    type: "search"
}
`,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();

    expect(plugins).toEqual(builtinPlugins);

    expect(console.warn).toHaveBeenCalledWith(
      "Skipping plugin `test-search-plugin`: missing `fn` function in `SilbylPlugin`.",
    );
    expect(console.error).not.toHaveBeenCalled();
  });
});
