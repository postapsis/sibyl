# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — run the CLI from source via `tsx` (no build step). Pass args after `--`, e.g. `pnpm dev run`.
- `pnpm build` — compile `src` → `dist` with `tsc`.
- `pnpm start` — run the compiled CLI (`node dist/cli.js`).
- `pnpm typecheck` — `tsc --noEmit`. Run after type-level changes; the build is strict (see below).
- `pnpm lint` — ESLint over the repo.
- `pnpm format` — Prettier write.

No test runner is configured. `lint-staged` + Husky run Prettier on commit.

## Architecture

`sibyl` is a CLI web search/crawl tool for AI Agents (`bin: sibyl` → `dist/cli.js`) with a filesystem-based plugin system. Three source modules:

- `src/cli.ts` — entry point. Parses `argv`, ensures config dirs exist, dispatches commands (`searc`, `--help`, `--version`).
- `src/setup.ts` — ensures `~/.sibyl` and `~/.sibyl/plugins` exist (created on every invocation).
- `src/loader.ts` — discovers, imports, and **validates** plugins.

### Plugin system (the core concept)

Plugins live in `~/.sibyl/plugins/<name>/main.js` (note: `.js`, loaded at runtime via dynamic `import()`). A plugin module must provide **two exports**:

1. `SilbylPlugin` — a declaration object with `type: "search" | "fetch" | "ask"` (export name is literally `SilbylPlugin` — spelling is part of the contract).
2. A **top-level function export** named per the type — `searchFn` / `fetchFn` / `askFn`. `PLUGIN_FN_FIELD` in `loader.ts` maps `type` → this export name. Signatures (`src/@types/plugin.ts`):
   - `searchFn(query) => Promise<string>`
   - `fetchFn(url) => Promise<string>`
   - `askFn(url, query) => Promise<string>`

Key detail: the function is a **sibling module export**, not a field of `SilbylPlugin`. `loader.ts` reads `type` from `SilbylPlugin` but the fn from `plugin[fnField]`.

- `validatePlugin` checks: `SilbylPlugin` is an object, `type` is valid, and `plugin[fnField]` is a function. Invalid plugins are skipped with a `console.warn`.
- The loader normalizes each plugin to the internal `PluginTypeDeclaration` shape `{ name, type, fn }` — `name` comes from the folder (not the declaration), and the type-specific export is stored under `fn`.
- Folder names starting with `builtin-` are reserved/skipped. `src/plugins/` exists for in-repo (builtin) plugins.

When changing the plugin shape, update all three together: `src/@types/plugin.ts` (types), `loader.ts` (validation + `PLUGIN_FN_FIELD` + normalization), and the consumer in `cli.ts`.

## Conventions

- ESM only (`"type": "module"`), Node `>=22`.
- TypeScript is strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — index access can be `undefined` and optional props can't be assigned `undefined` explicitly.
- `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` are on, so source uses explicit extensions on relative imports and `tsc` rewrites them on build. Existing imports are inconsistent — some `.ts`, one `.js` (`./loader.js`); match the file you're editing.
- File header comment block on each module: `Author: Jamius Siam` / `Since: <date>`.
