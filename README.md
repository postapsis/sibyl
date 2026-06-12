![sibyl Logo](https://raw.githubusercontent.com/postapsis/sibyl/refs/heads/main/media-kit/banner.png)

[![POST/APSIS Sibly Page](https://img.shields.io/badge/made_by-POST%2FAPSIS-%23000000)](https://postapsis.com/sibyl)
[![sibyl License Page](https://img.shields.io/badge/license-Apache_2.0-brightgreen)](https://raw.githubusercontent.com/postapsis/sibyl/refs/heads/main/LICENSE)
[![sibyl CI Status](https://github.com/postapsis/sibyl/actions/workflows/ci.yaml/badge.svg)](https://github.com/postapsis/sibyl/actions/workflows/ci.yaml)
<br/>

---

`sibyl` gives your AI Agent the web, without the bloat — extensible and lightweight by design 🕷️

---

## Status

Currently in development.

## Commands

| Command        | Description                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `search`       | Searches the web <br/>`sibyl search "react vite boostrap"`                                                                    |
| `fetch`        | Gets the content of a site in token-efficient markdown <br/>`sibyl fetch https://vite.dev/guide`                              |
| `ask`          | Asks a query using LLM from a site's content <br/>`sibyl ask https://vite.dev/guide "how to start a react project wiht vite"` |
| `--help`, `-h` | Show help.                                                                                                                    |
| `--version`    | Show version.                                                                                                                 |

## Configuration

### Configuration file

`sibyl` reads its config from `~/.sibyl/config.json`, created with sensible defaults on first run. It has two sections:

```json
{
  "plugins": {
    "search": "builtin-exa-search",
    "fetch": "builtin-exa-fetch",
    "parse": "builtin-parse-htmlToMd"
  },
  "variables": [
    {
      "name": "EXA_API_KEY",
      "value": "your-api-key"
    }
  ]
}
```

#### `plugins` section

Maps each plugin type (`search` / `fetch` / `ask` / `parse`) to the **name** of the plugin to use for it. Exactly one
plugin per type. The value must match a plugin's `name` (a builtin like `builtin-exa-search`, or one of your custom
written one!).

#### `variables` section

A list of `{ name, value }` pairs injected into the process environment at startup. Use this to provide secrets and
settings (e.g. API keys) that plugins read via `process.env`.

Precedence: **config wins over the environment.** A variable defined here overrides any existing environment variable of
the same name; anything not listed here falls back to the real environment. For example, a plugin reading
`process.env.EXA_API_KEY` gets the config value if present, otherwise whatever was exported in your shell.

### Plugin environment variables

Each builtin plugin reads the variables below (set them via `variables` or the real environment, per the precedence rule
above). A **required** variable causes the plugin to error if it is unset.

#### `builtin-exa-search` — `search`

| Variable                        | Required | Default | Description                                              |
| ------------------------------- | -------- | ------- | -------------------------------------------------------- |
| `EXA_API_KEY`                   | Yes      | —       | Exa API key.                                             |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`  | When `"true"`, includes result highlights in the output. |

#### `builtin-exa-fetch` — `fetch`

| Variable      | Required | Default | Description  |
| ------------- | -------- | ------- | ------------ |
| `EXA_API_KEY` | Yes      | —       | Exa API key. |

#### `builtin-brightdata-search` — `search`

| Variable                        | Required | Default  | Description                                                |
| ------------------------------- | -------- | -------- | ---------------------------------------------------------- |
| `BRIGHTDATA_API_KEY`            | Yes      | —        | Bright Data API key.                                       |
| `BRIGHTDATA_SERP_API_ZONE`      | Yes      | —        | Bright Data SERP API zone.                                 |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`   | When `"true"`, includes result descriptions in the output. |
| `BRIGHTDATA_SERP_API_LANGUAGE`  | No       | `en`     | Search language (Google `hl`).                             |
| `BRIGHTDATA_SERP_API_COUNTRY`   | No       | _(none)_ | Search country (Google `gl`); omitted when unset.          |

#### `builtin-brightdata-fetch` — `fetch`

| Variable                           | Required | Default | Description                        |
| ---------------------------------- | -------- | ------- | ---------------------------------- |
| `BRIGHTDATA_API_KEY`               | Yes      | —       | Bright Data API key.               |
| `BRIGHTDATA_WEB_UNLOCKER_API_ZONE` | Yes      | —       | Bright Data Web Unlocker API zone. |

#### `builtin-parse-htmlToMd` — `parse`

No environment variables.

## Creating a Plugin

### File structure

Plugins are loaded at runtime from your home config directory. `sibyl` creates these directories on first run:

```
~/.sibyl/
└── plugins/
    └── <your-plugin>/
        └── main.js
```

To add a plugin, create a folder under `~/.sibyl/plugins/` and put a `main.js` inside it. (Folder names starting with
`builtin` are reserved and will be skipped.)

### Plugin Interface

Every `main.js` must provide a **single export**: `SilbylPlugin` — a declaration object with three fields:

1. **`name`** — a non-empty string identifying the plugin.
2. **`type`** — one of `"search"`, `"fetch"`, `"ask"`, or `"parse"`.
3. **`fn`** — the function where your plugin's custom logic lives. Its signature depends on the `type`:

| Type     | `fn` signature                                              |
| -------- | ----------------------------------------------------------- |
| `search` | `(query: string) => Promise<string>`                        |
| `fetch`  | `(url: string) => Promise<string>`                          |
| `ask`    | `(parsedContent: string, query: string) => Promise<string>` |
| `parse`  | `(html: string) => Promise<string>`                         |

#### Example: A search plugin

`~/.sibyl/plugins/my-search-plugin/main.js`

```js
async function searchFn(query) {
  // ...do the search...
  return `Results for: ${query}`;
}

export const SilbylPlugin = {
  name: "my-search-plugin",
  type: "search",
  fn: searchFn,
};
```

#### Example: A fetch plugin

`~/.sibyl/plugins/my-fetch-plugin/main.js`

```js
async function fetchFn(url) {
  // fetch html for the url
  return `HTML Content`;
}

export const SilbylPlugin = {
  name: "my-fetch-plugin",
  type: "fetch",
  fn: fetchFn,
};
```

#### Example: An ask plugin

`~/.sibyl/plugins/my-llm-ask-plugib/main.js`

```js
async function askFn(parsedContent, query) {
  // ...answer query against the parsed content with an LLM...
  return `Answer to "${query}"`;
}

export const SilbylPlugin = {
  name: "my-ask-plugin",
  type: "ask",
  fn: askFn,
};
```

#### Example: A HTML parser plugin

`~/.sibyl/plugins/my-parse-plugin/main.js`

```js
async function parseHtmlFn(html) {
  // ...convert raw html into token-efficient markdown...
  return `# Parsed content`;
}

export const SilbylPlugin = {
  name: "my-parse-plugin",
  type: "parse",
  fn: parseHtmlFn,
};
```

### Plugin Validation

When `sibyl` is run, each plugin is validated. A plugin is **skipped with a warning** if:

- The folder has no `main.js`,
- `SilbylPlugin` is missing or not an object,
- In `SilbylPlugin` export:
  - `name` is missing or an empty string,
  - `type` is not one of `search` / `fetch` / `ask` / `parse`,
  - `fn` is missing or not a function.

## Contribution

During development, you can run the CLI with these commands:

```bash
pnpm dev search     # or fetch/ask
pnpm dev --help     # show help
pnpm dev --version  # show version
```

Or build and run the compiled binary:

```bash
pnpm build
pnpm start run
```

### Scripts

| Script               | Description                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | Run the CLI from source via tsx.     |
| `pnpm build`         | Compile `src` → `dist`.              |
| `pnpm start`         | Run the compiled CLI.                |
| `pnpm typecheck`     | Type-check with `tsc --noEmit`.      |
| `pnpm lint`          | Lint with ESLint.                    |
| `pnpm format`        | Format with Prettier.                |
| `pnpm test`          | Run the test suite once with Vitest. |
| `pnpm test:watch`    | Run Vitest in watch mode.            |
| `pnpm test:coverage` | Run tests with a coverage report.    |

## License

Apache-2.0
