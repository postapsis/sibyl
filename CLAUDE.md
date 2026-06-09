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

# Code writing instruction

Follow these rules when editing code in this project.

1. Use TypeScript for new code
2. Follow the existing code style and conventions
3. Write clear and concise comments
4. Format with Prettier and run ESLint after editing code.

## Architecture

`sibyl` is a CLI web search/crawl tool for AI Agents (`bin: sibyl` → `dist/cli.js`) with a filesystem-based plugin system. Key modules:

- `src/cli.ts` — entry point. Ensures dirs + config exist, loads plugins, dispatches commands (`search`, `--help`, `--version`).
- `src/setup.ts` — ensures `~/.sibyl` and `~/.sibyl/plugins` exist, and loads/creates/validates `~/.sibyl/config.json` (all on every invocation).
- `src/plugin-loader.ts` — assembles the active plugin set: builtin plugins + external (on-disk) plugins; validates the external ones.
- `src/plugins/config.ts` — `getBuiltinPlugins()`, the in-repo builtin plugin registry.
- `src/@types/` — `plugin.ts` (plugin contract) and `sibyl-config.ts` (config shape).

### Plugin system (the core concept)

Plugins live in `~/.sibyl/plugins/<name>/main.js` (note: `.js`, loaded at runtime via dynamic `import()`). A plugin module must provide a **single export** named `SilbylPlugin` (spelling is part of the contract) — a declaration object with three fields:

1. `name: string` — non-empty, identifies the plugin.
2. `type: "search" | "fetch" | "ask" | "parse"`.
3. `fn` — the function implementing the plugin's logic. Its signature depends on `type` (`src/@types/plugin.ts`):
   - `search`: `(query) => Promise<string>`
   - `fetch`: `(url) => Promise<string>`
   - `ask`: `(parsedContent, query) => Promise<string>`
   - `parse`: `(html) => Promise<string>`

Key detail: `fn` is a **field of `SilbylPlugin`**, so the loader validates and parses a single export. The external `SilbylPlugin` is structurally identical to the internal `PluginTypeDeclaration` `{ name, type, fn }`.

- `validatePlugin` checks: `SilbylPlugin` is an object, `name` is a non-empty string, `type` is valid (`type in PLUGIN_TYPES`), and `fn` is a function. Invalid plugins are skipped with a `console.warn`.
- The loader returns each valid plugin as a `PluginTypeDeclaration` `{ name, type, fn }` — `name` comes from `SilbylPlugin.name` (not the folder).
- Folder names starting with `builtin` are reserved/skipped. `src/plugins/` exists for in-repo (builtin) plugins.

When changing the plugin shape, update all three together: `src/@types/plugin.ts` (types), `plugin-loader.ts` (validation in `validatePlugin`), and the consumer in `cli.ts`.

### Builtin plugins

`loadPlugins()` (`plugin-loader.ts`) returns `[...getBuiltinPlugins(), ...externalPlugins]`.

- Builtins are **compiled into the binary, not loaded from disk**. `src/plugins/config.ts` statically imports each builtin's `SilbylPlugin` (e.g. from `src/plugins/builtin-exa-search/main.ts`) and returns them as `PluginTypeDeclaration` objects — they bypass `validatePlugin` and the `main.js` discovery path. Each builtin `main.ts` types its `SilbylPlugin` with the matching interface (`SearchPlugin` / `FetchPlugin` / `ParsePlugin`) so `type` stays a literal.
- Builtin names are prefixed `builtin-` by convention. External plugin folders starting with `builtin-` are rejected during discovery (reserved namespace), so user plugins cannot shadow a builtin.
- To add a builtin: create `src/plugins/builtin-<x>/main.ts` exporting a typed `SilbylPlugin` (with `fn`), then register it in `getBuiltinPlugins()`.

### Config (`~/.sibyl/config.json`)

Shape: `SibylConfig` (`src/@types/sibyl-config.ts`) — `{ plugins: Partial<Record<PluginType, string>>, variables: { name, value }[] }`. `plugins` maps `type` → plugin name (e.g. `{ "search": "builtin-exa-search" }`); keying by type structurally enforces at most one plugin per type. `variables` is a list of `{ name, value }` pairs injected into `process.env`.

- `loadOrCreateConfigFile()` (`setup.ts`) writes a default config (`writeDefaultSibylConfig`) when the file is missing or empty, then parses, validates, and injects variables.
- `injectConfigVariables()` (`setup.ts`) sets `process.env[name] = value` for each config variable. **Config wins over the environment** — a variable named in config overrides any existing env var; names absent from config fall back to their existing env value. (Plugins like `builtin-exa-search` read `process.env.EXA_API_KEY` at call time, so they pick up either source.)
- `validateConfig()` checks each entry's name is a non-empty string; on failure it `console.error`s and `process.exit(1)` (hard exit, not a skip-with-warning like plugin loading).
- Plugin selection: `loadPlugins()` loads _all_ available plugins (builtins + disk), then `cli.ts` picks the one to run **by name from config** — e.g. the `search` command looks up `config.plugins.search` and finds the loaded plugin whose `type === "search"` and `name` matches. Missing config entry or no matching loaded plugin → `console.error` + non-zero exit.

## Conventions

- ESM only (`"type": "module"`), Node `>=22`.
- TypeScript is strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — index access can be `undefined` and optional props can't be assigned `undefined` explicitly.
- `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` are on, so source uses explicit extensions on relative imports and `tsc` rewrites them on build. Existing imports are inconsistent — some `.ts`, one `.js` (`./loader.js`); match the file you're editing.
- File header comment block on each module: `Author: Jamius Siam` / `Since: <date>`.
