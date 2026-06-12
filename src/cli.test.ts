/*
 * Author: Jamius Siam
 * Since: 11/06/2026
 */
vi.mock("./setup.ts", () => ({
  loadOrCreateConfigDir: vi.fn(),
  loadOrCreatePluginsDir: vi.fn(),
  loadOrCreateConfigFile: vi.fn(),
}));

vi.mock("./plugin-loader.ts", () => ({
  loadPlugins: vi.fn(),
}));

vi.mock("./exit.ts", () => ({
  exit: vi.fn(() => {
    throw new Error("process.exit");
  }),
}));

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { main } from "./cli.ts";
import { loadOrCreateConfigFile } from "./setup.ts";
import { loadPlugins } from "./plugin-loader.ts";
import { exit } from "./exit.ts";
import type {
  FetchPlugin,
  PluginContext,
  PluginTypeDeclaration,
  SearchPlugin,
} from "./@types/plugin.ts";
import type { SibylConfig } from "./@types/sibyl-config.ts";

const contextMatcher = expect.objectContaining({
  configuredPlugins: expect.any(Array),
  allPlugins: expect.any(Array),
  getPlugin: expect.any(Function),
});

let searchFn: Mock;
let fetchFn: Mock;
let plugins: PluginTypeDeclaration[];
let config: SibylConfig;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  searchFn = vi.fn(async () => "search result");
  fetchFn = vi.fn(async () => "fetch result");

  const searchPlugin: SearchPlugin = { name: "test-search", type: "search", fn: searchFn };
  const fetchPlugin: FetchPlugin = { name: "test-fetch", type: "fetch", fn: fetchFn };
  plugins = [searchPlugin, fetchPlugin];

  config = {
    plugins: { search: "test-search", fetch: "test-fetch" },
    variables: [],
  };

  // Defaults; individual tests override via mockReturnValue / mockResolvedValue.
  vi.mocked(loadOrCreateConfigFile).mockReturnValue(config);
  vi.mocked(loadPlugins).mockResolvedValue(plugins);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dispatch & argument validation", () => {
  it.each([
    { argv: [] as string[], label: "no command" },
    { argv: ["--help"], label: "--help" },
    { argv: ["-h"], label: "-h" },
    { argv: ["help"], label: "help" },
  ])("prints help for $label", async ({ argv }) => {
    await main(argv);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("sibyl - CLI tool"));
    expect(exit).not.toHaveBeenCalled();
  });

  it.each([["--version"], ["version"]])("prints version for %s", async (arg) => {
    await main([arg]);

    expect(console.log).toHaveBeenCalledWith("sibyl 0.1.0");
    expect(exit).not.toHaveBeenCalled();
  });

  it.each([["search"], ["search", "   "]])("errors on empty search query (%j)", async (...argv) => {
    await expect(main(argv)).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith("Usage: sibyl search <query>");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("joins and trims the search query before passing it to the plugin", async () => {
    await main(["search", "react", "vite"]);

    expect(searchFn).toHaveBeenCalledWith("react vite", contextMatcher);
    expect(console.log).toHaveBeenCalledWith("search result");
  });

  it("errors when fetch has no url", async () => {
    await expect(main(["fetch"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith("Usage: sibyl fetch <url>");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("errors when fetch url is invalid", async () => {
    await expect(main(["fetch", "not-a-url"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith("Invalid URL: not-a-url");
    expect(exit).toHaveBeenCalledWith(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("passes a valid url to the fetch plugin", async () => {
    await main(["fetch", "https://vite.dev"]);

    expect(fetchFn).toHaveBeenCalledWith("https://vite.dev", contextMatcher);
    expect(console.log).toHaveBeenCalledWith("fetch result");
  });

  it("errors and prints help on an unknown command", async () => {
    await expect(main(["bogus"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith("Unknown command: bogus");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("sibyl - CLI tool"));
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("handleSearch", () => {
  it("errors when no search plugin is configured", async () => {
    vi.mocked(loadOrCreateConfigFile).mockReturnValue({ plugins: {}, variables: [] });

    await expect(main(["search", "react"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith(
      "No search plugin configured in `~/.sibyl/config.json`",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("errors when the configured search plugin is not loaded", async () => {
    vi.mocked(loadOrCreateConfigFile).mockReturnValue({
      plugins: { search: "missing-plugin" },
      variables: [],
    });

    await expect(main(["search", "react"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith(
      "Configured search plugin `missing-plugin` not found",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("logs the plugin result on success", async () => {
    await main(["search", "react"]);

    expect(searchFn).toHaveBeenCalledWith("react", contextMatcher);
    expect(console.log).toHaveBeenCalledWith("search result");
    expect(exit).not.toHaveBeenCalled();
  });

  it("passes a context with configuredPlugins, allPlugins and getPlugin to the plugin", async () => {
    await main(["search", "react"]);

    const context = searchFn.mock.calls[0]?.[1] as PluginContext;

    expect(context).not.toBeNull();
    expect(context.allPlugins).toBe(plugins);
    expect(context.configuredPlugins).toEqual([plugins[0], plugins[1]]);
    expect(context.getPlugin("test-search")).toBe(plugins[0]);
    expect(context.getPlugin("test-fetch")).toBe(plugins[1]);
    expect(context.getPlugin("nope")).toBeNull();
  });

  it("errors when the plugin rejects", async () => {
    searchFn.mockRejectedValue(new Error("boom"));

    await expect(main(["search", "react"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error searching using test-search:"),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("handleFetch", () => {
  it("errors when no fetch plugin is configured", async () => {
    vi.mocked(loadOrCreateConfigFile).mockReturnValue({ plugins: {}, variables: [] });

    await expect(main(["fetch", "https://vite.dev"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith(
      "No fetch plugin configured in `~/.sibyl/config.json`",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("errors when the configured fetch plugin is not loaded", async () => {
    vi.mocked(loadOrCreateConfigFile).mockReturnValue({
      plugins: { fetch: "missing-plugin" },
      variables: [],
    });

    await expect(main(["fetch", "https://vite.dev"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith(
      "Configured fetch plugin `missing-plugin` not found",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("logs the plugin result on success", async () => {
    await main(["fetch", "https://vite.dev"]);

    expect(fetchFn).toHaveBeenCalledWith("https://vite.dev", contextMatcher);
    expect(console.log).toHaveBeenCalledWith("fetch result");
    expect(exit).not.toHaveBeenCalled();
  });

  it("errors when the plugin rejects", async () => {
    fetchFn.mockRejectedValue(new Error("boom"));

    await expect(main(["fetch", "https://vite.dev"])).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching using test-fetch:"),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
