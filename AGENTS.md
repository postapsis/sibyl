# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Commands

- `pnpm dev` — run the CLI from source via `tsx` (no build step). Pass args after `--`, e.g. `pnpm dev run`.
- `pnpm build` — compile `src` → `dist` with `tsc`.
- `pnpm start` — run the compiled CLI (`node dist/cli.js`).
- `pnpm typecheck` — `tsc --noEmit`. Run after type-level changes; the build is strict (see below).
- `pnpm lint` — ESLint + Prettier check over the repo.
- `pnpm format` — Prettier write.
- `pnpm test` — run the Vitest suite once (`vitest run`). `pnpm test:watch` for watch mode, `pnpm test:coverage` for a coverage report.

Tests run on **Vitest** (`vitest.config.ts`) and are colocated as `*.test.ts` next to the code they cover (e.g. `src/plugins/builtin-exa-search/main.test.ts`). `lint-staged` + Husky run Prettier on commit.

To test code that hard-exits, mock the exit seam: `vi.mock("./exit.ts", () => ({ exit: vi.fn(() => { throw new Error("process.exit"); }) }))`. Error paths then assert `rejects.toThrow("process.exit")` (or `toThrow(...)`) plus `expect(exit).toHaveBeenCalledWith(1)`.

# Code writing instruction

Follow these rules when editing code in this project.

1. Use TypeScript for new code
2. Follow the existing code style and conventions
3. Write clear and concise comments
4. Format with Prettier and run ESLint after editing code.

## Architecture

`sibyl` is a CLI web search/crawl tool for AI Agents (`bin: sibyl` → `dist/cli.js`) with a filesystem-based plugin system. Key modules:

- `src/cli.ts` — entry point. Ensures dirs + config exist, loads plugins, builds a `PluginContext` (`buildPluginContext`), and dispatches commands (`search`, `fetch`, `ask`, `setup`, `uninstall`, `help`/`--help`/`-h`, `version`/`--version`). `search`, `fetch`, and `ask` are wired up via the async `handleSearch`/`handleFetch`/`handleAsk` helpers (awaited by `main`), each passing the context as the last arg to the selected plugin's `fn`. The `fetch` command prints the fetch plugin's output directly — the CLI doesn't dispatch a separate `parse` step, but a fetch plugin may itself run the configured parse plugin via `context.configuredPlugins.parse` (`builtin-brightdata-fetch`, `builtin-crawl4ai-fetch`, and `builtin-alterlab-fetch` do; `builtin-firecrawl-fetch` does only in its raw-HTML mode; `builtin-exa-fetch` returns content as-is). The `ask` command (`sibyl ask <url> <question>`) passes the URL as the ask plugin's first arg; analogously, an ask plugin may itself fetch that URL via `context.configuredPlugins.fetch` before answering (`builtin-ai-ask` does). The `setup` and `uninstall` commands are handled synchronously by `runSetup(rest)` and `runUninstall(rest)` (`src/setup-command.ts`) and use neither plugins nor the `PluginContext` (see The `setup` and `uninstall` commands). `main` is exported and only auto-runs when the file is the actual CLI entry (`import.meta.url` vs `process.argv[1]` guard), so tests can import it without side effects.
- `src/setup.ts` — ensures `~/.config/sibyl` and `~/.config/sibyl/plugins` exist, and loads/creates/validates `~/.config/sibyl/config.json` (all on every invocation).
- `src/setup-command.ts` — implements the `setup` and `uninstall` commands (`runSetup` and `runUninstall`): installs or removes the instructions integration in agent tools' global instruction files (see The `setup` and `uninstall` commands). Distinct from `setup.ts`, which is config bootstrap.
- `src/instructions.ts` — the bundled `SIBYL.md` content (`buildSibylInstructions(subagentModel)`, which interpolates a per-target cheap model into the "run subagents with …" line) plus the import line, marker, and notice constants used by `setup-command.ts`. Inlined as a string builder (not read from disk) so it ships in `dist`.
- `src/plugin-loader.ts` — assembles the active plugin set: builtin plugins + external (on-disk) plugins; validates the external ones.
- `src/plugins/config.ts` — `getBuiltinPlugins()`, the in-repo builtin plugin registry.
- `src/utils.ts` — pure helpers: `isValidHttpUrl`, `stripSearchResultDatePrefix` (strips localized SERP date prefixes), `collapseBlankLines`, and the search-setting readers `getSearchResultsLimit` / `shouldShowSearchDescription` (see Conventions).
- `src/exit.ts` — `exit()`, the single wrapper around `process.exit` (see Conventions).
- `src/@types/` — `plugin.ts` (plugin contract) and `sibyl-config.ts` (config shape).

User-facing docs live in `docs/` — `CONFIGURATION.md` (config + per-plugin env-var tables), `CREATING-PLUGINS.md`, and `CONTRIBUTION.md` (linked from `README.md`).

### Plugin system (the core concept)

Plugins live in `~/.config/sibyl/plugins/<name>/main.js` (note: `.js`, loaded at runtime via dynamic `import()`). A plugin module must provide a **single export** named `SilbylPlugin` (spelling is part of the contract) — a declaration object with three fields:

1. `name: string` — non-empty, identifies the plugin.
2. `type: "search" | "fetch" | "ask" | "parse"`.
3. `fn` — the function implementing the plugin's logic. Every `fn` receives a `PluginContext` as its **last** argument; its signature otherwise depends on `type` (`src/@types/plugin.ts`):
   - `search`: `(query, context) => Promise<string>`
   - `fetch`: `(url, context) => Promise<string>`
   - `ask`: `(src, query, context) => Promise<string>` (the dispatched `ask` command passes a URL as `src`)
   - `parse`: `(html, context) => Promise<string>`

`PluginContext` (`src/@types/plugin.ts`) lets a plugin reach the rest of the plugin system: `{ configuredPlugins: Partial<Record<PluginType, PluginTypeDeclaration>>, allPlugins: PluginTypeDeclaration[], getPlugin(name): PluginTypeDeclaration | null }`. `configuredPlugins` is keyed by type (the per-type selection from config), `allPlugins` is everything loaded, and `getPlugin` looks up by name. It's built once in `cli.ts` and threaded to every `fn`; plugins consume it only if needed (a 1-arg `fn` still satisfies the contract via structural typing). This is how a fetch plugin runs the configured parser: `context.configuredPlugins.parse?.fn(html, context)`.

Key detail: `fn` is a **field of `SilbylPlugin`**, so the loader validates and parses a single export. The external `SilbylPlugin` is structurally identical to the internal `PluginTypeDeclaration` `{ name, type, fn }`.

- `validatePlugin` checks: `SilbylPlugin` is an object, `name` is a non-empty string, `type` is valid (`type in PLUGIN_TYPES`), and `fn` is a function. Invalid plugins are skipped with a `console.warn`.
- The loader returns each valid plugin as a `PluginTypeDeclaration` `{ name, type, fn }` — `name` comes from `SilbylPlugin.name` (not the folder).
- Folder names starting with `builtin` are reserved/skipped. `src/plugins/` exists for in-repo (builtin) plugins.

When changing the plugin shape, update all three together: `src/@types/plugin.ts` (types), `plugin-loader.ts` (validation in `validatePlugin`), and the consumer in `cli.ts`.

### Builtin plugins

`loadPlugins()` (`plugin-loader.ts`) returns `[...getBuiltinPlugins(), ...externalPlugins]`.

- Builtins are **compiled into the binary, not loaded from disk**. `src/plugins/config.ts` statically imports each builtin's `SilbylPlugin` (e.g. from `src/plugins/builtin-exa-search/main.ts`) and returns them as `PluginTypeDeclaration` objects — they bypass `validatePlugin` and the `main.js` discovery path. Each builtin `main.ts` types its `SilbylPlugin` with the matching interface (`SearchPlugin` / `FetchPlugin` / `AskPlugin` / `ParsePlugin`) so `type` stays a literal.
- Builtin names are prefixed `builtin-` by convention. External plugin folders starting with `builtin-` are rejected during discovery (reserved namespace), so user plugins cannot shadow a builtin.
- To add a builtin: create `src/plugins/builtin-<x>/main.ts` exporting a typed `SilbylPlugin` (with `fn`), then register it in `getBuiltinPlugins()`.
- `builtin-ai-ask` (the `ask` builtin) reads a URL via the configured fetch plugin, then answers a question over that content using the **Vercel AI SDK**, with the provider selectable via `SIBYL_AI_PROVIDER` (`openai` / `anthropic` / `ollama` / `openrouter`), `SIBYL_MODEL_NAME`, and a per-provider key (`OPENAI_API_KEY` etc.; Ollama uses `OLLAMA_BASE_URL`, no key). It loads `ai` and each provider package (`@ai-sdk/*`, `ollama-ai-provider-v2`, `@openrouter/ai-sdk-provider`) via **dynamic `import()`** inside the `fn` — never at module top level — because `getBuiltinPlugins()` imports every builtin module on every CLI run, so top-level SDK imports would slow `search`/`fetch` too.

### Config (`~/.config/sibyl/config.json`)

Shape: `SibylConfig` (`src/@types/sibyl-config.ts`) — `{ plugins: Partial<Record<PluginType, string>>, variables: { name, value }[] }`. `plugins` maps `type` → plugin name (e.g. `{ "search": "builtin-exa-search" }`); keying by type structurally enforces at most one plugin per type. `variables` is a list of `{ name, value }` pairs injected into `process.env`.

- `loadOrCreateConfigFile()` (`setup.ts`) writes a default config (`writeDefaultSibylConfig`) when the file is missing or empty, then parses, validates, and injects variables. The default selects `builtin-searxng-search` / `builtin-crawl4ai-fetch` / `builtin-parse-htmlToMd` / `builtin-ai-ask` plus one variable (`SIBYL_SHOW_SEARCH_DESCRIPTION=true`); the search/fetch/parse backends are fully local and need no API key, while the `ask` command additionally needs `SIBYL_AI_PROVIDER` / `SIBYL_MODEL_NAME` (and a provider API key unless using Ollama) to be set.
- `injectConfigVariables()` (`setup.ts`) sets `process.env[name] = value` for each config variable. **Config wins over the environment** — a variable named in config overrides any existing env var; names absent from config fall back to their existing env value. (Plugins like `builtin-exa-search` read `process.env.EXA_API_KEY` at call time, so they pick up either source.)
- `validateConfig()` checks each entry's name is a non-empty string; on failure it `console.error`s and `process.exit(1)` (hard exit, not a skip-with-warning like plugin loading).
- Plugin selection: `loadPlugins()` loads _all_ available plugins (builtins + disk), then `cli.ts` picks the one to run **by name from config** — e.g. the `search` command looks up `config.plugins.search` and finds the loaded plugin whose `type === "search"` and `name` matches. Missing config entry or no matching loaded plugin → `console.error` + non-zero exit.

### The `setup` and `uninstall` commands

`runSetup(args)` (`src/setup-command.ts`) installs the bundled instructions doc into an agent tool's **global** (user-level home-dir) instruction files. `runUninstall(args)` removes only those instruction integrations; it does not remove the Sibyl package, `~/.config/sibyl`, or plugins. Both commands parse per-target flags — at least one is required, else they print usage and `exit(1)` (also on an unknown flag or an `--other` with no path):

- `--claude` → writes `~/.claude/SIBYL.md` and adds a `@SIBYL.md` import line to `~/.claude/CLAUDE.md`.
- `--opencode` → writes `~/.config/opencode/SIBYL.md` and adds `~/.config/opencode/SIBYL.md` to the `instructions[]` array in the selected `~/.config/opencode/opencode.json` or `opencode.jsonc`. Existing `opencode.jsonc` is preferred when both exist; if neither exists, setup creates `opencode.jsonc`. Setup moves stale Sibyl references into the selected file, while uninstall removes references from both files.
- `--codex` → embeds the content into `~/.codex/AGENTS.md`.
- `--antigravity` → embeds the content into `~/.gemini/GEMINI.md`.
- `--other <file>` (repeatable; `--other=<file>` also accepted) → embeds the content into an arbitrary file.

Two mechanisms: Claude and opencode **reference** a `SIBYL.md` file each target owns; Codex, Antigravity, and `--other` **embed** the content between `<!-- SIBYL:START -->` / `<!-- SIBYL:END -->` markers, followed by a do-not-edit notice line. Everything is idempotent and refreshes in place on re-run — doc files are overwritten, the marker block (and its trailing notice) is regex-replaced, and the `@SIBYL.md` line / opencode entry are added at most once. The content is inlined in `src/instructions.ts` (a bundled string builder) because the `tsc`-only build has no asset-copy step, so a raw `.md` would never reach `dist`. Each target renders the doc with a cheap model for its own tool (`SUBAGENT_MODEL` in `setup-command.ts`: `claude` → Claude Haiku, `codex` → GPT-5 Mini, `antigravity` → Gemini Flash; `opencode` and `--other` use the generic "a cheap model").

Uninstall is idempotent: missing artifacts are successful no-ops, all duplicate exact references or valid marker blocks are removed, host instruction files are retained, and surrounding non-Sibyl bytes are not normalized. Claude and opencode standalone `SIBYL.md` files are deleted because those paths are Sibyl-owned, even if their contents were modified. An opencode config is parsed before its doc is deleted, so invalid JSON fails without partial cleanup. Embedded files with unmatched, reversed, nested, or otherwise malformed marker pairs are warned about and left unchanged; real I/O or JSON errors fail fast.

## Conventions

- ESM only (`"type": "module"`), Node `>=22`.
- TypeScript is strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — index access can be `undefined` and optional props can't be assigned `undefined` explicitly.
- `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` are on, so source uses explicit extensions on relative imports and `tsc` rewrites them on build. Existing imports are inconsistent — some `.ts`, one `.js` (`./loader.js`); match the file you're editing.
- File header comment block on each module: `Author: Jamius Siam` / `Since: <date>`.
- Search plugins read two shared settings via `src/utils.ts` helpers — `getSearchResultsLimit()` (`SIBYL_SEARCH_RESULTS_LIMIT`, default `10`; passed to the provider's API when it supports a result-count param, and the results array is always `.slice(0, limit)`d) and `shouldShowSearchDescription()` (`SIBYL_SHOW_SEARCH_DESCRIPTION`, default `true`). New search builtins should use both.
