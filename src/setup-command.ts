/*
 * Author: Jamius Siam
 * Since: 14/07/2026
 */
import path from "path";
import fs from "fs";
import os from "os";
import {
  applyEdits,
  findNodeAtLocation,
  modify,
  parse,
  parseTree,
  printParseErrorCode,
  stripComments,
  type FormattingOptions,
  type ParseError,
} from "jsonc-parser";
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
type JsonPath = (string | number)[];

type OpencodeConfig = {
  path: string;
  exists: boolean;
  raw: string;
  instructions: unknown[] | undefined;
  formattingOptions: FormattingOptions;
};

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
const OPENCODE_JSON_FILENAME = "opencode.json";
const OPENCODE_JSONC_FILENAME = "opencode.jsonc";

const SETUP_USAGE = `Usage: sibyl setup <targets>

Targets (at least one required):
  --claude         Install into ~/.claude (CLAUDE.md ${SIBYL_IMPORT_LINE} import + SIBYL.md)
  --opencode       Install into ~/.config/opencode (opencode.json/jsonc instructions + SIBYL.md)
  --codex          Embed instructions into ~/.codex/AGENTS.md
  --antigravity    Embed instructions into ~/.gemini/GEMINI.md
  --other <file>   Embed instructions into an arbitrary file (repeatable)`;

const UNINSTALL_USAGE = `Usage: sibyl uninstall <targets>

Targets (at least one required):
  --claude         Remove the ~/.claude SIBYL.md import and doc
  --opencode       Remove opencode.json/jsonc instructions entries and SIBYL.md
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
      installOpencode(home);
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
      uninstallOpencode(home);
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

function installOpencode(home: string): void {
  const configs = loadOpencodeConfigs(home);
  const selected = selectOpencodeConfig(configs);
  const selectedIndex = configs.indexOf(selected);
  const referenceCount = configs.reduce(
    (count, config) => count + countOpencodeReferences(config.instructions),
    0,
  );
  const selectedReferenceCount = countOpencodeReferences(selected.instructions);
  const shouldCanonicalize = referenceCount !== 1 || selectedReferenceCount !== 1;
  const nextContents = shouldCanonicalize
    ? configs.map((config) => removeOpencodeReferences(config))
    : configs.map((config) => config.raw);

  if (shouldCanonicalize) {
    const cleanedSelected = nextContents[selectedIndex];
    if (cleanedSelected === undefined) {
      throw new Error(`Could not select an OpenCode config to update`);
    }

    let nextSelected = addOpencodeReference(selected, cleanedSelected);
    if (
      selected.raw.trim() === "" &&
      !nextSelected.endsWith(selected.formattingOptions.eol ?? "\n")
    ) {
      nextSelected += selected.formattingOptions.eol ?? "\n";
    }
    nextContents[selectedIndex] = nextSelected;
  }

  writeChangedOpencodeConfigs(configs, nextContents);

  writeOpencodeDoc(
    path.join(home, ".config", "opencode", SIBYL_DOC_FILENAME),
    SUBAGENT_MODEL.opencode,
  );
}

function uninstallOpencode(home: string): void {
  const configs = loadOpencodeConfigs(home);
  const nextContents = configs.map((config) => removeOpencodeReferences(config));

  writeChangedOpencodeConfigs(configs, nextContents);
  removeDoc(path.join(home, ".config", "opencode", SIBYL_DOC_FILENAME));
}

function getOpencodeConfigPaths(home: string): string[] {
  const directory = path.join(home, ".config", "opencode");
  return [
    path.join(directory, OPENCODE_JSONC_FILENAME),
    path.join(directory, OPENCODE_JSON_FILENAME),
  ];
}

function loadOpencodeConfigs(home: string): OpencodeConfig[] {
  return getOpencodeConfigPaths(home).map((configPath) => {
    const exists = fs.existsSync(configPath);
    const raw = exists ? fs.readFileSync(configPath, "utf8") : "";
    const value = parseOpencodeConfig(raw, configPath);

    return {
      path: configPath,
      exists,
      raw,
      instructions: getOpencodeInstructions(value, configPath),
      formattingOptions: getOpencodeFormattingOptions(raw),
    };
  });
}

function parseOpencodeConfig(raw: string, configPath: string): Record<string, unknown> {
  if (stripComments(raw).trim() === "") {
    return {};
  }

  const errors: ParseError[] = [];
  const parsed = parse(raw, errors, { allowTrailingComma: true }) as unknown;
  const firstError = errors[0];

  if (firstError !== undefined) {
    throw new Error(
      `Invalid opencode config ${configPath}: ${printParseErrorCode(firstError.error)} at offset ${firstError.offset}`,
    );
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`opencode config must contain a JSON object: ${configPath}`);
  }

  return parsed as Record<string, unknown>;
}

function getOpencodeInstructions(
  config: Record<string, unknown>,
  configPath: string,
): unknown[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(config, "instructions")) {
    return undefined;
  }

  if (!Array.isArray(config.instructions)) {
    throw new Error(`opencode config instructions must be an array: ${configPath}`);
  }

  return config.instructions;
}

function getOpencodeFormattingOptions(raw: string): FormattingOptions {
  const eol = raw.match(/\r\n|\r|\n/)?.[0] ?? "\n";
  const indentMatches = [...raw.matchAll(/^( +|\t+)\S/gm)]
    .map((match) => match[1])
    .filter((indent): indent is string => indent !== undefined);
  const firstIndent = indentMatches[0];

  if (firstIndent?.includes("\t")) {
    return { eol, insertSpaces: false, tabSize: 2 };
  }

  const spaceWidths = indentMatches.map((indent) => indent.length).filter((width) => width > 0);

  return {
    eol,
    insertSpaces: true,
    tabSize: spaceWidths.length > 0 ? Math.min(...spaceWidths) : 2,
  };
}

function selectOpencodeConfig(configs: OpencodeConfig[]): OpencodeConfig {
  const selected = configs.find((config) => config.exists);
  const fallback = configs[0];
  if (selected !== undefined) {
    return selected;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error("Could not select an OpenCode config");
}

function countOpencodeReferences(instructions: unknown[] | undefined): number {
  return instructions?.filter((entry) => entry === OPENCODE_INSTRUCTION_REF).length ?? 0;
}

function removeOpencodeReferences(config: OpencodeConfig): string {
  if (!config.exists || config.instructions === undefined) {
    return config.raw;
  }

  const matchingIndices = config.instructions.reduce<number[]>((indices, entry, index) => {
    if (entry === OPENCODE_INSTRUCTION_REF) {
      indices.push(index);
    }
    return indices;
  }, []);
  let next = config.raw;

  for (const index of matchingIndices.reverse()) {
    next = removeOpencodeArrayItem(next, index);
  }

  return next;
}

function removeOpencodeArrayItem(raw: string, index: number): string {
  const tree = parseTree(raw, [], { allowTrailingComma: true });
  const array = tree === undefined ? undefined : findNodeAtLocation(tree, ["instructions"]);
  const item = array?.children?.[index];

  if (array?.type !== "array" || item === undefined || array.children === undefined) {
    throw new Error(`Could not remove an OpenCode instruction entry at index ${index}`);
  }

  const previous = array.children[index - 1];
  const next = array.children[index + 1];
  const separator =
    next !== undefined
      ? findTrailingComma(raw, item.offset + item.length, next.offset)
      : previous !== undefined
        ? findTrailingComma(raw, previous.offset + previous.length, item.offset)
        : findTrailingComma(raw, item.offset + item.length, array.offset + array.length - 1);

  if (separator === undefined && (previous !== undefined || next !== undefined)) {
    throw new Error(`Could not find an OpenCode instruction separator at index ${index}`);
  }

  const ranges = [{ offset: item.offset, length: item.length }];
  if (separator !== undefined) {
    ranges.push({ offset: separator, length: 1 });
  }

  return ranges
    .sort((left, right) => right.offset - left.offset)
    .reduce(
      (content, range) =>
        content.slice(0, range.offset) + content.slice(range.offset + range.length),
      raw,
    );
}

function findTrailingComma(raw: string, start: number, end: number): number | undefined {
  let index = start;

  while (index < end) {
    const character = raw[index];
    if (character === undefined || /\s/.test(character)) {
      index++;
      continue;
    }

    if (raw.startsWith("//", index)) {
      const lineEndOffset = raw.slice(index + 2).search(/[\r\n]/);
      const lineEnd = lineEndOffset === -1 ? -1 : index + 2 + lineEndOffset;
      index = lineEnd === -1 || lineEnd >= end ? end : lineEnd + 1;
      continue;
    }

    if (raw.startsWith("/*", index)) {
      const commentEnd = raw.indexOf("*/", index + 2);
      index = commentEnd === -1 || commentEnd + 2 >= end ? end : commentEnd + 2;
      continue;
    }

    return character === "," ? index : undefined;
  }

  return undefined;
}

function addOpencodeReference(config: OpencodeConfig, raw: string): string {
  if (config.instructions !== undefined) {
    return applyOpencodeEdit(
      raw,
      ["instructions", -1],
      OPENCODE_INSTRUCTION_REF,
      config.formattingOptions,
    );
  }

  return applyOpencodeEdit(
    raw,
    ["instructions"],
    [OPENCODE_INSTRUCTION_REF],
    config.formattingOptions,
  );
}

function applyOpencodeEdit(
  raw: string,
  jsonPath: JsonPath,
  value: unknown,
  formattingOptions: FormattingOptions,
): string {
  return applyEdits(raw, modify(raw, jsonPath, value, { formattingOptions }));
}

function writeChangedOpencodeConfigs(configs: OpencodeConfig[], nextContents: string[]): void {
  configs.forEach((config, index) => {
    const next = nextContents[index];
    if (next === undefined || next === config.raw || (!config.exists && next === "")) {
      return;
    }

    writeFileAtomically(config.path, next);
    console.log(`Updated opencode instructions in ${config.path}`);
  });
}

function writeOpencodeDoc(file: string, subagentModel: string): void {
  writeFileAtomically(file, `${buildSibylInstructions(subagentModel)}\n`);
  console.log(`Wrote instructions doc: ${file}`);
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

function writeFileAtomically(file: string, content: string): void {
  ensureDir(file);

  const directory = path.dirname(file);
  const temporaryDirectory = fs.mkdtempSync(path.join(directory, `.${path.basename(file)}-`));
  const temporaryFile = path.join(temporaryDirectory, "content");
  const existingMode = fs.existsSync(file) ? fs.statSync(file).mode & 0o7777 : undefined;

  try {
    fs.writeFileSync(temporaryFile, content, {
      encoding: "utf8",
      mode: existingMode ?? 0o666,
    });
    if (existingMode !== undefined) {
      fs.chmodSync(temporaryFile, existingMode);
    }
    fs.renameSync(temporaryFile, file);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
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
