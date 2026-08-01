/*
 * Author: Jamius Siam
 * Since: 14/07/2026
 */
vi.mock("./exit.ts", () => ({
  exit: vi.fn(() => {
    throw new Error("process.exit");
  }),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runSetup, runUninstall } from "./setup-command.ts";
import { exit } from "./exit.ts";
import {
  SIBYL_BLOCK_END,
  SIBYL_BLOCK_NOTICE,
  SIBYL_BLOCK_START,
  buildSibylInstructions,
} from "./instructions.ts";

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "sibyl-setup-"));
  vi.spyOn(os, "homedir").mockReturnValue(home);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(home, { recursive: true, force: true });
});

const read = (...segments: string[]): string =>
  fs.readFileSync(path.join(home, ...segments), "utf8");

describe("argument validation", () => {
  it("errors and exits when no target flags are given", () => {
    expect(() => runSetup([])).toThrow("process.exit");

    expect(exit).toHaveBeenCalledWith(1);
    expect(fs.existsSync(path.join(home, ".claude"))).toBe(false);
  });

  it("errors on an unknown flag", () => {
    expect(() => runSetup(["--bogus"])).toThrow("process.exit");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("errors when --other has no path", () => {
    expect(() => runSetup(["--other"])).toThrow("process.exit");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("errors when --other is followed by another flag", () => {
    expect(() => runSetup(["--other", "--claude"])).toThrow("process.exit");
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("claude target", () => {
  it("writes SIBYL.md and the @SIBYL.md import, leaving other tools untouched", () => {
    runSetup(["--claude"]);

    expect(read(".claude", "SIBYL.md").trimEnd()).toBe(buildSibylInstructions("Claude Haiku"));
    expect(read(".claude", "CLAUDE.md")).toContain("@SIBYL.md");

    expect(fs.existsSync(path.join(home, ".config", "opencode"))).toBe(false);
    expect(fs.existsSync(path.join(home, ".codex"))).toBe(false);
    expect(fs.existsSync(path.join(home, ".gemini"))).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  });

  it("does not duplicate the import on re-run", () => {
    runSetup(["--claude"]);
    runSetup(["--claude"]);

    expect(read(".claude", "CLAUDE.md").match(/@SIBYL\.md/g)).toHaveLength(1);
  });

  it("frames the import with blank lines after existing content", () => {
    const claudeMd = path.join(home, ".claude", "CLAUDE.md");
    fs.mkdirSync(path.dirname(claudeMd), { recursive: true });
    fs.writeFileSync(claudeMd, "hello\n");

    runSetup(["--claude"]);

    expect(fs.readFileSync(claudeMd, "utf8")).toBe("hello\n\n@SIBYL.md\n\n");
  });
});

describe("opencode target", () => {
  it("writes its own SIBYL.md and references it via instructions[]", () => {
    runSetup(["--opencode"]);

    expect(fs.existsSync(path.join(home, ".config", "opencode", "SIBYL.md"))).toBe(true);

    const config = JSON.parse(read(".config", "opencode", "opencode.json")) as {
      instructions: string[];
    };
    expect(config.instructions).toContain("~/.config/opencode/SIBYL.md");
    expect(fs.existsSync(path.join(home, ".claude"))).toBe(false);
  });

  it("preserves existing keys/entries and does not duplicate on re-run", () => {
    const jsonPath = path.join(home, ".config", "opencode", "opencode.json");
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify({ theme: "dark", instructions: ["AGENTS.md"] }));

    runSetup(["--opencode"]);
    runSetup(["--opencode"]);

    const config = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
      theme: string;
      instructions: string[];
    };
    expect(config.theme).toBe("dark");
    expect(config.instructions).toEqual(["AGENTS.md", "~/.config/opencode/SIBYL.md"]);
  });
});

describe("embed targets", () => {
  it.each([
    ["--codex", [".codex", "AGENTS.md"]],
    ["--antigravity", [".gemini", "GEMINI.md"]],
  ])("embeds a marker block with a do-not-edit notice for %s", (flag, segments) => {
    runSetup([flag]);

    const content = read(...(segments as string[]));
    expect(content).toContain(SIBYL_BLOCK_START);
    expect(content).toContain(SIBYL_BLOCK_END);
    expect(content).toContain("Collect all the necessary information");
    expect(content).toContain(SIBYL_BLOCK_NOTICE);
  });

  it("embeds into an arbitrary --other file", () => {
    const target = path.join(home, "notes.md");

    runSetup(["--other", target]);

    const content = fs.readFileSync(target, "utf8");
    expect(content).toContain(SIBYL_BLOCK_START);
    expect(content).toContain(SIBYL_BLOCK_NOTICE);
  });

  it("refreshes an existing block in place instead of duplicating it", () => {
    const agents = path.join(home, ".codex", "AGENTS.md");
    fs.mkdirSync(path.dirname(agents), { recursive: true });
    fs.writeFileSync(
      agents,
      `# top\n\n${SIBYL_BLOCK_START}\nOLD STALE\n${SIBYL_BLOCK_END}\n${SIBYL_BLOCK_NOTICE}\n`,
    );

    runSetup(["--codex"]);

    const content = fs.readFileSync(agents, "utf8");
    expect(content).toContain("# top");
    expect(content).not.toContain("OLD STALE");
    expect(content).toContain("Collect all the necessary information");
    expect(content.split(SIBYL_BLOCK_START)).toHaveLength(2); // marker appears exactly once
    expect(content.split(SIBYL_BLOCK_NOTICE)).toHaveLength(2);
  });
});

describe("subagent model per target", () => {
  it("names Claude's cheap model (Claude Haiku) in the claude doc", () => {
    runSetup(["--claude"]);
    expect(read(".claude", "SIBYL.md")).toContain("subagents (with Claude Haiku)");
  });

  it("uses the generic phrasing for opencode (model-agnostic)", () => {
    runSetup(["--opencode"]);
    expect(read(".config", "opencode", "SIBYL.md")).toContain("subagents (with a cheap model)");
  });

  it("names GPT-5 Mini for codex and drops the Claude-specific Haiku", () => {
    runSetup(["--codex"]);

    const content = read(".codex", "AGENTS.md");
    expect(content).toContain("subagents (with GPT-5 Mini)");
    expect(content).not.toContain("Haiku");
  });

  it("names Gemini Flash for antigravity", () => {
    runSetup(["--antigravity"]);
    expect(read(".gemini", "GEMINI.md")).toContain("subagents (with Gemini Flash)");
  });

  it("uses the generic phrasing for --other targets", () => {
    const target = path.join(home, "notes.md");

    runSetup(["--other", target]);
    expect(fs.readFileSync(target, "utf8")).toContain("subagents (with a cheap model)");
  });
});

describe("uninstall argument validation", () => {
  it("errors and exits when no target flags are given", () => {
    expect(() => runUninstall([])).toThrow("process.exit");

    expect(exit).toHaveBeenCalledWith(1);
    expect(fs.existsSync(path.join(home, ".claude"))).toBe(false);
  });

  it("errors on an unknown flag", () => {
    expect(() => runUninstall(["--bogus"])).toThrow("process.exit");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it.each([["--other"], ["--other="]])("errors when %s has no path", (arg) => {
    expect(() => runUninstall([arg])).toThrow("process.exit");

    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("uninstall Claude target", () => {
  it("removes every exact import line and deletes the standalone doc", () => {
    const claudeMd = path.join(home, ".claude", "CLAUDE.md");
    const doc = path.join(home, ".claude", "SIBYL.md");
    fs.mkdirSync(path.dirname(claudeMd), { recursive: true });
    fs.writeFileSync(
      claudeMd,
      `# top\n\n@SIBYL.md\n  @SIBYL.md  \nkeep @SIBYL.md text\n# bottom\n`,
    );
    fs.writeFileSync(doc, "manually modified instructions");

    runUninstall(["--claude"]);

    expect(fs.readFileSync(claudeMd, "utf8")).toBe("# top\n\nkeep @SIBYL.md text\n# bottom\n");
    expect(fs.existsSync(doc)).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  });

  it("retains an existing host file and succeeds when the target is absent", () => {
    const claudeMd = path.join(home, ".claude", "CLAUDE.md");
    fs.mkdirSync(path.dirname(claudeMd), { recursive: true });
    fs.writeFileSync(claudeMd, "user instructions\n");

    runUninstall(["--claude"]);

    expect(fs.readFileSync(claudeMd, "utf8")).toBe("user instructions\n");
    expect(fs.existsSync(path.join(home, ".claude"))).toBe(true);
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("uninstall opencode target", () => {
  it("removes every exact reference, preserves other config, and deletes the doc", () => {
    const jsonPath = path.join(home, ".config", "opencode", "opencode.json");
    const docPath = path.join(home, ".config", "opencode", "SIBYL.md");
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        theme: "dark",
        instructions: ["AGENTS.md", "~/.config/opencode/SIBYL.md", "~/.config/opencode/SIBYL.md"],
      }),
    );
    fs.writeFileSync(docPath, "manually modified instructions");

    runUninstall(["--opencode"]);

    expect(JSON.parse(fs.readFileSync(jsonPath, "utf8"))).toEqual({
      theme: "dark",
      instructions: ["AGENTS.md"],
    });
    expect(fs.existsSync(docPath)).toBe(false);
  });

  it("retains an empty instructions array after removing its final reference", () => {
    const jsonPath = path.join(home, ".config", "opencode", "opencode.json");
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify({ instructions: ["~/.config/opencode/SIBYL.md"] }));

    runUninstall(["--opencode"]);

    expect(JSON.parse(fs.readFileSync(jsonPath, "utf8"))).toEqual({ instructions: [] });
  });

  it("fails before deleting the doc when opencode JSON is invalid", () => {
    const jsonPath = path.join(home, ".config", "opencode", "opencode.json");
    const docPath = path.join(home, ".config", "opencode", "SIBYL.md");
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, "{ invalid");
    fs.writeFileSync(docPath, "manually modified instructions");

    expect(() => runUninstall(["--opencode"])).toThrow("process.exit");

    expect(fs.readFileSync(jsonPath, "utf8")).toBe("{ invalid");
    expect(fs.existsSync(docPath)).toBe(true);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("deletes an existing doc when the config has no Sibyl reference", () => {
    const jsonPath = path.join(home, ".config", "opencode", "opencode.json");
    const docPath = path.join(home, ".config", "opencode", "SIBYL.md");
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify({ theme: "dark" }));
    fs.writeFileSync(docPath, "manually modified instructions");

    runUninstall(["--opencode"]);

    expect(JSON.parse(fs.readFileSync(jsonPath, "utf8"))).toEqual({ theme: "dark" });
    expect(fs.existsSync(docPath)).toBe(false);
  });
});

describe("uninstall embedded targets", () => {
  it.each([
    ["--codex", [".codex", "AGENTS.md"]],
    ["--antigravity", [".gemini", "GEMINI.md"]],
  ])("removes the valid managed block for %s", (flag, segments) => {
    const file = path.join(home, ...(segments as string[]));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const block = `${SIBYL_BLOCK_START}\nmanaged content\n${SIBYL_BLOCK_END}\n${SIBYL_BLOCK_NOTICE}`;
    fs.writeFileSync(file, `# top\n\n${block}\n\n# bottom\n`);

    runUninstall([flag]);

    expect(fs.readFileSync(file, "utf8")).toBe("# top\n\n\n# bottom\n");
    expect(fs.existsSync(file)).toBe(true);
  });

  it("removes blocks from repeatable --other targets in both argument forms", () => {
    const spaced = path.join(home, "spaced.md");
    const equals = path.join(home, "equals.md");
    const block = `${SIBYL_BLOCK_START}\nmanaged content\n${SIBYL_BLOCK_END}\n${SIBYL_BLOCK_NOTICE}`;
    fs.writeFileSync(spaced, `before\n${block}\nafter\n`);
    fs.writeFileSync(equals, `before\n${block}\nafter\n`);

    runUninstall(["--other", spaced, `--other=${equals}`]);

    expect(fs.readFileSync(spaced, "utf8")).toBe("before\nafter\n");
    expect(fs.readFileSync(equals, "utf8")).toBe("before\nafter\n");
  });

  it("removes every valid block and supports blocks without a notice", () => {
    const file = path.join(home, "duplicates.md");
    const first = `${SIBYL_BLOCK_START}\nfirst\n${SIBYL_BLOCK_END}\n${SIBYL_BLOCK_NOTICE}`;
    const second = `${SIBYL_BLOCK_START}\nsecond\n${SIBYL_BLOCK_END}`;
    fs.writeFileSync(file, `${first}\n${second}\nkeep\n`);

    runUninstall(["--other", file]);

    expect(fs.readFileSync(file, "utf8")).toBe("keep\n");
  });

  it.each([
    ["start only", `${SIBYL_BLOCK_START}\nmanaged\n`],
    ["end only", `${SIBYL_BLOCK_END}\nmanaged\n`],
    ["reversed", `${SIBYL_BLOCK_END}\nmanaged\n${SIBYL_BLOCK_START}\n`],
    [
      "nested",
      `${SIBYL_BLOCK_START}\nouter\n${SIBYL_BLOCK_START}\ninner\n${SIBYL_BLOCK_END}\n${SIBYL_BLOCK_END}\n`,
    ],
  ])("warns and preserves %s marker content", (_label, content) => {
    const file = path.join(home, "malformed.md");
    fs.writeFileSync(file, content);

    runUninstall(["--other", file]);

    expect(fs.readFileSync(file, "utf8")).toBe(content);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("malformed SIBYL block"));
  });

  it("preserves an orphan notice and retains an empty host file", () => {
    const orphan = path.join(home, "orphan.md");
    fs.writeFileSync(orphan, `${SIBYL_BLOCK_NOTICE}\n`);
    runUninstall(["--other", orphan]);
    expect(fs.readFileSync(orphan, "utf8")).toBe(`${SIBYL_BLOCK_NOTICE}\n`);

    const managed = path.join(home, "managed.md");
    fs.writeFileSync(managed, `${SIBYL_BLOCK_START}\nmanaged\n${SIBYL_BLOCK_END}\n`);
    runUninstall(["--other", managed]);
    expect(fs.existsSync(managed)).toBe(true);
    expect(fs.readFileSync(managed, "utf8")).toBe("");
  });

  it("does not create missing files and is idempotent", () => {
    const missing = path.join(home, "missing.md");

    runUninstall(["--other", missing]);
    runUninstall(["--other", missing]);

    expect(fs.existsSync(missing)).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("uninstall target sequencing", () => {
  it("fails fast and does not process later targets after an opencode error", () => {
    const jsonPath = path.join(home, ".config", "opencode", "opencode.json");
    const docPath = path.join(home, ".config", "opencode", "SIBYL.md");
    const codex = path.join(home, ".codex", "AGENTS.md");
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.mkdirSync(path.dirname(codex), { recursive: true });
    fs.writeFileSync(jsonPath, "{ invalid");
    fs.writeFileSync(docPath, "doc");
    fs.writeFileSync(codex, `${SIBYL_BLOCK_START}\nmanaged\n${SIBYL_BLOCK_END}\n`);

    expect(() => runUninstall(["--opencode", "--codex"])).toThrow("process.exit");

    expect(fs.existsSync(docPath)).toBe(true);
    expect(fs.readFileSync(codex, "utf8")).toContain(SIBYL_BLOCK_START);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
