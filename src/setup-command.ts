/*
 * Author: Jamius Siam
 * Since: 14/07/2026
 */
import path from "path";
import fs from "fs";
import os from "os";
import { exit } from "./exit.ts";
import {
  SIBYL_BLOCK_END,
  SIBYL_BLOCK_NOTICE,
  SIBYL_BLOCK_START,
  SIBYL_DOC_FILENAME,
  SIBYL_IMPORT_LINE,
  buildSibylInstructions,
} from "./instructions.ts";

type InstructionTarget = "claude" | "opencode" | "codex" | "antigravity";
type InstructionAction = "setup" | "uninstall";

// Cheap/fast model each target's agent should spawn subagents with, interpolated into the
// instructions doc so every tool references a model it can actually run. opencode is
// provider-agnostic (no canonical cheap model), so it falls back to the generic phrasing.
const GENERIC_SUBAGENT_MODEL = "a cheap model";
const SUBAGENT_MODEL: Record<InstructionTarget, string> = {
  claude: "Claude Haiku",
  opencode: GENERIC_SUBAGENT_MODEL,
  codex: "GPT-5 Mini",
  antigravity: "Gemini Flash",
};

// Path opencode stores in its `instructions[]` array. Kept in tilde form (opencode expands
// `~`) so it stays portable, while the doc itself is written to the expanded path.
const OPENCODE_INSTRUCTION_REF = `~/.config/opencode/${SIBYL_DOC_FILENAME}`;

const SETUP_USAGE = `Usage: sibyl setup <targets>

Targets (at least one required):
  --claude         Install into ~/.claude (CLAUDE.md ${SIBYL_IMPORT_LINE} import + SIBYL.md)
  --opencode       Install into ~/.config/opencode (opencode.json instructions + SIBYL.md)
  --codex          Embed instructions into ~/.codex/AGENTS.md
  --antigravity    Embed instructions into ~/.gemini/GEMINI.md
  --other <file>   Embed instructions into an arbitrary file (repeatable)`;

const UNINSTALL_USAGE = `Usage: sibyl uninstall <targets>

Targets (at least one required):
  --claude         Remove the ~/.claude SIBYL.md import and doc
  --opencode       Remove the opencode instructions entry and SIBYL.md
  --codex          Remove the embedded block from ~/.codex/AGENTS.md
  --antigravity    Remove the embedded block from ~/.gemini/GEMINI.md
  --other <file>   Remove the embedded block from an arbitrary file (repeatable)`;

export function runSetup(args: string[]): void {
  const { targets, otherPaths } = parseTargetArgs(args, "setup", SETUP_USAGE);

  try {
    const home = os.homedir();

    if (targets.has("claude")) {
      writeDoc(path.join(home, ".claude", SIBYL_DOC_FILENAME), SUBAGENT_MODEL.claude);
      addImportLine(path.join(home, ".claude", "CLAUDE.md"));
    }

    if (targets.has("opencode")) {
      writeDoc(path.join(home, ".config", "opencode", SIBYL_DOC_FILENAME), SUBAGENT_MODEL.opencode);
      addOpencodeInstruction(path.join(home, ".config", "opencode", "opencode.json"));
    }

    if (targets.has("codex")) {
      embedBlock(path.join(home, ".codex", "AGENTS.md"), SUBAGENT_MODEL.codex);
    }

    if (targets.has("antigravity")) {
      embedBlock(path.join(home, ".gemini", "GEMINI.md"), SUBAGENT_MODEL.antigravity);
    }

    for (const other of otherPaths) {
      embedBlock(path.resolve(other), GENERIC_SUBAGENT_MODEL);
    }
  } catch (error) {
    console.error(`Error running setup: ${error}`);
    exit(1);
  }
}

export function runUninstall(args: string[]): void {
  const { targets, otherPaths } = parseTargetArgs(args, "uninstall", UNINSTALL_USAGE);

  try {
    const home = os.homedir();

    if (targets.has("claude")) {
      removeImportLine(path.join(home, ".claude", "CLAUDE.md"));
      removeDoc(path.join(home, ".claude", SIBYL_DOC_FILENAME));
    }

    if (targets.has("opencode")) {
      removeOpencodeInstallation(
        path.join(home, ".config", "opencode", "opencode.json"),
        path.join(home, ".config", "opencode", SIBYL_DOC_FILENAME),
      );
    }

    if (targets.has("codex")) {
      removeEmbeddedBlock(path.join(home, ".codex", "AGENTS.md"));
    }

    if (targets.has("antigravity")) {
      removeEmbeddedBlock(path.join(home, ".gemini", "GEMINI.md"));
    }

    for (const other of otherPaths) {
      removeEmbeddedBlock(path.resolve(other));
    }
  } catch (error) {
    console.error(`Error running uninstall: ${error}`);
    exit(1);
  }
}

function parseTargetArgs(
  args: string[],
  action: InstructionAction,
  usage: string,
): { targets: Set<InstructionTarget>; otherPaths: string[] } {
  const targets = new Set<InstructionTarget>();
  const otherPaths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string; // safe: `i < args.length`

    switch (arg) {
      case "--claude":
      case "--opencode":
      case "--codex":
      case "--antigravity":
        targets.add(arg.slice(2) as InstructionTarget);
        break;
      case "--other": {
        const next = args[i + 1];
        if (next === undefined || next.startsWith("--")) {
          usageError("`--other` requires a file path", usage);
        }
        otherPaths.push(next);
        i++;
        break;
      }
      default:
        if (arg.startsWith("--other=")) {
          const value = arg.slice("--other=".length);
          if (value === "") {
            usageError("`--other` requires a file path", usage);
          }
          otherPaths.push(value);
        } else {
          usageError(`Unknown ${action} option: ${arg}`, usage);
        }
    }
  }

  if (targets.size === 0 && otherPaths.length === 0) {
    usageError("At least one target is required", usage);
  }

  return { targets, otherPaths };
}

function usageError(message: string, usage: string): never {
  console.error(message);
  console.error(usage);
  return exit(1);
}

// Writes the standalone SIBYL.md doc, overwriting any existing copy (refresh in place).
function writeDoc(file: string, subagentModel: string): void {
  ensureDir(file);
  fs.writeFileSync(file, `${buildSibylInstructions(subagentModel)}\n`);
  console.log(`Wrote instructions doc: ${file}`);
}

// Adds the `@SIBYL.md` import line once, framed by blank lines (blank line before, the line,
// a blank line after). Idempotent — a line already equal to the import is left untouched.
function addImportLine(file: string): void {
  ensureDir(file);
  const current = readIfExists(file);

  const present = new RegExp(`^\\s*${escapeRegExp(SIBYL_IMPORT_LINE)}\\s*$`, "m").test(current);
  if (present) {
    console.log(`${SIBYL_IMPORT_LINE} already present in ${file}`);
    return;
  }

  const base = current.replace(/\s+$/, "");
  const next = base.length ? `${base}\n\n${SIBYL_IMPORT_LINE}\n\n` : `${SIBYL_IMPORT_LINE}\n\n`;
  fs.writeFileSync(file, next);
  console.log(`Added ${SIBYL_IMPORT_LINE} to ${file}`);
}

function removeImportLine(file: string): void {
  if (!fs.existsSync(file)) {
    return;
  }

  const current = fs.readFileSync(file, "utf8");
  const importLineRe = new RegExp(
    `^[\\t ]*${escapeRegExp(SIBYL_IMPORT_LINE)}[\\t ]*(?:\\r?\\n|$)`,
    "gm",
  );
  const next = current.replace(importLineRe, "");

  if (next === current) {
    return;
  }

  fs.writeFileSync(file, next);
  console.log(`Removed ${SIBYL_IMPORT_LINE} from ${file}`);
}

// Adds the doc path to opencode.json's `instructions[]` once, preserving all other config.
function addOpencodeInstruction(jsonPath: string): void {
  ensureDir(jsonPath);
  const raw = readIfExists(jsonPath).trim();
  const config: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

  const existing = config.instructions;
  const list: unknown[] = Array.isArray(existing) ? existing : [];

  if (list.includes(OPENCODE_INSTRUCTION_REF)) {
    console.log(`opencode instructions already reference ${OPENCODE_INSTRUCTION_REF}`);
    return;
  }

  list.push(OPENCODE_INSTRUCTION_REF);
  config.instructions = list;
  fs.writeFileSync(jsonPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Added ${OPENCODE_INSTRUCTION_REF} to opencode instructions in ${jsonPath}`);
}

function removeOpencodeInstallation(jsonPath: string, docPath: string): void {
  const raw = readIfExists(jsonPath).trim();

  if (raw) {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`opencode config must contain a JSON object: ${jsonPath}`);
    }

    const config = parsed as Record<string, unknown>;
    const existing = config.instructions;

    if (Array.isArray(existing)) {
      const filtered = existing.filter((entry) => entry !== OPENCODE_INSTRUCTION_REF);

      if (filtered.length !== existing.length) {
        config.instructions = filtered;
        fs.writeFileSync(jsonPath, `${JSON.stringify(config, null, 2)}\n`);
        console.log(
          `Removed ${OPENCODE_INSTRUCTION_REF} from opencode instructions in ${jsonPath}`,
        );
      }
    }
  }

  removeDoc(docPath);
}

// Embeds the instructions inside sentinel markers followed by a do-not-edit notice. On
// re-run the existing block (and its trailing notice) is replaced in place, not duplicated.
function embedBlock(file: string, subagentModel: string): void {
  ensureDir(file);
  const current = readIfExists(file);

  const block = `${SIBYL_BLOCK_START}\n${buildSibylInstructions(subagentModel)}\n${SIBYL_BLOCK_END}\n${SIBYL_BLOCK_NOTICE}`;
  const blockRe = new RegExp(
    `${escapeRegExp(SIBYL_BLOCK_START)}[\\s\\S]*?${escapeRegExp(SIBYL_BLOCK_END)}` +
      `(?:\\n${escapeRegExp(SIBYL_BLOCK_NOTICE)})?`,
  );

  if (blockRe.test(current)) {
    fs.writeFileSync(file, current.replace(blockRe, block));
    console.log(`Refreshed SIBYL block in ${file}`);
    return;
  }

  const base = current.replace(/\s+$/, "");
  const next = base.length ? `${base}\n\n${block}\n` : `${block}\n`;
  fs.writeFileSync(file, next);
  console.log(`Embedded SIBYL block in ${file}`);
}

function removeEmbeddedBlock(file: string): void {
  if (!fs.existsSync(file)) {
    return;
  }

  const current = fs.readFileSync(file, "utf8");
  const startCount = countMarkerLines(current, SIBYL_BLOCK_START);
  const endCount = countMarkerLines(current, SIBYL_BLOCK_END);
  const blockRe = new RegExp(
    `^[\\t ]*${escapeRegExp(SIBYL_BLOCK_START)}[\\t ]*\\r?\\n[\\s\\S]*?` +
      `^[\\t ]*${escapeRegExp(SIBYL_BLOCK_END)}[\\t ]*` +
      `(?:\\r?\\n^[\\t ]*${escapeRegExp(SIBYL_BLOCK_NOTICE)}[\\t ]*(?:\\r?\\n|$)|\\r?\\n|$)`,
    "gm",
  );
  const matches = [...current.matchAll(blockRe)];

  if (startCount !== endCount || matches.length !== startCount) {
    if (startCount > 0 || endCount > 0) {
      console.warn(
        `Could not safely remove malformed SIBYL block in ${file}; leaving it unchanged`,
      );
    }
    return;
  }

  if (matches.length === 0) {
    return;
  }

  const next = current.replace(blockRe, "");
  fs.writeFileSync(file, next);
  console.log(`Removed SIBYL block from ${file}`);
}

function countMarkerLines(content: string, marker: string): number {
  const markerRe = new RegExp(`^[\\t ]*${escapeRegExp(marker)}[\\t ]*(?:\\r?\\n|$)`, "gm");
  return [...content.matchAll(markerRe)].length;
}

function removeDoc(file: string): void {
  if (!fs.existsSync(file)) {
    return;
  }

  fs.unlinkSync(file);
  console.log(`Removed instructions doc: ${file}`);
}

function ensureDir(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readIfExists(file: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
