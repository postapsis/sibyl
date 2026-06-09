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
import type { AskPlugin, FetchPlugin, ParsePlugin, SearchPlugin } from "./@types/plugin.ts";

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

  it("returns built-in plugins and a valid custom fetch plugin", async () => {
    const testPluginDir = path.join(pluginsDir, "test-fetch-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
async function fetchFn(url) {
    return "fetched " + url;
}

export const SilbylPlugin = {
    name: "test-fetch-plugin",
    type: "fetch",
    fn: fetchFn
}
    `,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();
    const customPlugin = plugins.at(-1)! as FetchPlugin;

    expect(plugins.slice(0, -1)).toEqual(builtinPlugins);
    expect(customPlugin?.name).toEqual("test-fetch-plugin");
    expect(customPlugin?.type).toEqual("fetch");
    await expect(customPlugin.fn("https://example.com")).resolves.toEqual(
      "fetched https://example.com",
    );

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and a valid custom ask plugin", async () => {
    const testPluginDir = path.join(pluginsDir, "test-ask-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
async function askFn(content, query) {
    return query + " => " + content;
}

export const SilbylPlugin = {
    name: "test-ask-plugin",
    type: "ask",
    fn: askFn
}
    `,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();
    const customPlugin = plugins.at(-1)! as AskPlugin;

    expect(plugins.slice(0, -1)).toEqual(builtinPlugins);
    expect(customPlugin?.name).toEqual("test-ask-plugin");
    expect(customPlugin?.type).toEqual("ask");
    await expect(customPlugin.fn("the content", "the question")).resolves.toEqual(
      "the question => the content",
    );

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns built-in plugins and a valid custom parse plugin", async () => {
    const testPluginDir = path.join(pluginsDir, "test-parse-plugin");
    fs.mkdirSync(testPluginDir);
    fs.writeFileSync(
      path.join(testPluginDir, "main.js"),
      `
async function parseFn(html) {
    return "parsed " + html;
}

export const SilbylPlugin = {
    name: "test-parse-plugin",
    type: "parse",
    fn: parseFn
}
    `,
    );

    const builtinPlugins = getBuiltinPlugins();
    const plugins = await loadPlugins();
    const customPlugin = plugins.at(-1)! as ParsePlugin;

    expect(plugins.slice(0, -1)).toEqual(builtinPlugins);
    expect(customPlugin?.name).toEqual("test-parse-plugin");
    expect(customPlugin?.type).toEqual("parse");
    await expect(customPlugin.fn("<p>hi</p>")).resolves.toEqual("parsed <p>hi</p>");

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
