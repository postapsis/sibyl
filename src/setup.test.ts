/*
 * Author: Jamius Siam
 * Since: 07/06/2026
 */
vi.mock("./utils.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./utils.ts")>()),
  exit: vi.fn(() => {
    throw new Error("process.exit");
  }),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { SibylConfig } from "./@types/sibyl-config.ts";
import {
  loadOrCreateConfigDir,
  loadOrCreateConfigFile,
  loadOrCreatePluginsDir,
  writeDefaultSibylConfig,
} from "./setup.ts";
import { exit } from "./utils.ts";

const DEFAULT_CONFIG: SibylConfig = {
  plugins: {
    search: "builtin-exa-search",
    fetch: "builtin-exa-fetch",
    parse: "builtin-parse-htmlToMd",
  },
  variables: [{ name: "SIBYL_SHOW_SEARCH_DESCRIPTION", value: "true" }],
};

let home: string;
let sibylDir: string;
let configFile: string;
let pluginsDir: string;
let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  // Fresh fake home per test; only homedir() is mocked, real fs is used.
  home = fs.mkdtempSync(path.join(os.tmpdir(), "sibyl-test-"));
  sibylDir = path.join(home, ".sibyl");
  configFile = path.join(sibylDir, "config.json");
  pluginsDir = path.join(sibylDir, "plugins");

  vi.spyOn(os, "homedir").mockReturnValue(home);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  envSnapshot = { ...process.env };
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(home, { recursive: true, force: true });

  // Restore process.env (injectConfigVariables mutates it).
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }

  Object.assign(process.env, envSnapshot);
});

describe("loads or creates config dir", () => {
  it("creates ~/.sibyl when missing", () => {
    expect(fs.existsSync(sibylDir)).toBe(false);

    loadOrCreateConfigDir();

    expect(fs.existsSync(sibylDir)).toBe(true);
    expect(console.log).toHaveBeenCalledWith(`Creating config directory at ${sibylDir}`);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does nothing when ~/.sibyl already exists", () => {
    fs.mkdirSync(sibylDir, { recursive: true });
    const mkdir = vi.spyOn(fs, "mkdirSync");

    loadOrCreateConfigDir();

    expect(mkdir).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("loads or creates plugins dir", () => {
  it("creates ~/.sibyl/plugins when missing", () => {
    expect(fs.existsSync(pluginsDir)).toBe(false);

    loadOrCreatePluginsDir();

    expect(fs.existsSync(pluginsDir)).toBe(true);
    expect(console.log).toHaveBeenCalledWith(`Creating plugins directory at ${pluginsDir}`);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does nothing when plugins dir already exists", () => {
    fs.mkdirSync(pluginsDir, { recursive: true });
    const mkdir = vi.spyOn(fs, "mkdirSync");

    loadOrCreatePluginsDir();

    expect(mkdir).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("writes default sibyl config", () => {
  it("writes the default config to ~/.sibyl/config.json", () => {
    fs.mkdirSync(sibylDir, { recursive: true });

    writeDefaultSibylConfig();

    const written = JSON.parse(fs.readFileSync(configFile, "utf8")) as SibylConfig;

    expect(written).toEqual(DEFAULT_CONFIG);
    expect(console.log).toHaveBeenCalledWith(`Creating config file at ${configFile}`);
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("loads or creates config file", () => {
  beforeEach(() => {
    fs.mkdirSync(sibylDir, { recursive: true });
  });

  it("writes and returns the default config when the file is missing", () => {
    const config = loadOrCreateConfigFile();

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(fs.existsSync(configFile)).toBe(true);
    expect(console.log).toHaveBeenCalledWith(`Creating config file at ${configFile}`);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rewrites the default config when the file is empty", () => {
    fs.writeFileSync(configFile, "");

    const config = loadOrCreateConfigFile();

    expect(config).toEqual(DEFAULT_CONFIG);
    expect(console.log).toHaveBeenCalledWith(`Creating config file at ${configFile}`);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("parses and returns an existing config with a built-in plugin", () => {
    const existing: SibylConfig = {
      plugins: { search: "builtin-exa-search" },
      variables: [],
    };
    fs.writeFileSync(configFile, JSON.stringify(existing));

    const config = loadOrCreateConfigFile();

    expect(config).toEqual(existing);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("parses and returns an existing config with custom plugin", () => {
    const existing: SibylConfig = {
      plugins: { search: "custom-search-plugin" },
      variables: [],
    };
    fs.writeFileSync(configFile, JSON.stringify(existing));

    const config = loadOrCreateConfigFile();

    expect(config).toEqual(existing);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("handles a config with no variables field", () => {
    const existing = {
      plugins: {
        search: "custom-search-plugin",
      },
    };
    fs.writeFileSync(configFile, JSON.stringify(existing));

    const config = loadOrCreateConfigFile();

    expect(config).toEqual(existing);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("injects config variables into process.env", () => {
    const existing: SibylConfig = {
      plugins: { search: "builtin-exa-search" },
      variables: [{ name: "TEST_INJECTED_VAR", value: "hello" }],
    };
    fs.writeFileSync(configFile, JSON.stringify(existing));
    delete process.env.TEST_INJECTED_VAR;

    loadOrCreateConfigFile();

    expect(process.env.TEST_INJECTED_VAR).toBe("hello");
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("lets config variables override existing env values", () => {
    process.env.TEST_OVERRIDE_VAR = "from-env";
    const existing: SibylConfig = {
      plugins: { search: "builtin-exa-search" },
      variables: [{ name: "TEST_OVERRIDE_VAR", value: "from-config" }],
    };
    fs.writeFileSync(configFile, JSON.stringify(existing));

    loadOrCreateConfigFile();

    expect(process.env.TEST_OVERRIDE_VAR).toBe("from-config");
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("exits when a plugin name is empty (invalid config)", () => {
    const invalid = { plugins: { search: "  " }, variables: [] };
    fs.writeFileSync(configFile, JSON.stringify(invalid));

    expect(() => loadOrCreateConfigFile()).toThrow("process.exit");
    expect(exit).toHaveBeenCalledWith(1);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "Invalid configuration: plugin name for type `search` must be a non-empty string.",
    );
  });

  it("exits when a plugin name is an object (invalid config)", () => {
    const invalid = {
      plugins: { search: {} },
      variables: [],
    };

    fs.writeFileSync(configFile, JSON.stringify(invalid));

    expect(() => loadOrCreateConfigFile()).toThrow("process.exit");
    expect(exit).toHaveBeenCalledWith(1);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "Invalid configuration: plugin name for type `search` must be a non-empty string.",
    );
  });

  it("logs an error and reads the file when statSync throws", () => {
    const existing: SibylConfig = {
      plugins: { search: "builtin-exa-search" },
      variables: [],
    };
    fs.writeFileSync(configFile, JSON.stringify(existing));
    vi.spyOn(fs, "statSync").mockImplementation(() => {
      throw new Error("stat mock error");
    });

    const config = loadOrCreateConfigFile();

    // isFileEmptySync swallows the error, returns false, so the existing
    // file is read instead of being overwritten with defaults.
    expect(config).toEqual(existing);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      `Error reading the config file at: ${configFile}`,
      expect.any(Error),
    );
  });
});
