# sibyl

Give your AI Agent the web, without the bloat — extensible and lightweight by design 🕷️

## Requirements

- Node.js `>=22`

## Install

```bash
npm install -g @postapsis/sibyl
```

### Commands

| Command           | Description                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `search`          | Searches the web (`sibyl search "react vite boostrap"`                                                                    |
| `fetch`           | Gets the content of a site in token-efficient markdown (`sibyl fetch https://vite.dev/guide`                              |
| `ask`             | Asks a query using LLM from a site's content (`sibyl ask https://vite.dev/guide "how to start a react project wiht vite"` |
| `--help`, `-h`    | Show help.                                                                                                                |
| `--version`, `-v` | Show version.                                                                                                             |

## Creating a Plugin

Plugins are loaded at runtime from your home config directory. `sibyl` creates these directories on first run:

```
~/.sibyl/
└── plugins/
    └── <your-plugin>/
        └── main.js
```

To add a plugin, create a folder under `~/.sibyl/plugins/` and put a `main.js` inside it. The folder name becomes the plugin's name. (Names starting with `builtin-` are reserved and will be skipped.)

### The contract

Every `main.js` must provide **two exports**:

1. **`SilbylPlugin`** — a declaration object stating the plugin's `type`. One of `"search"`, `"fetch"`, `"ask"`, or `"parseHtml"`.
2. **A function export named after the type** — `searchFn`, `fetchFn`, `askFn`, or `parseHtmlFn`. This is where your plugin's custom logic lives.

| Type        | Function export | Signature                                                   |
| ----------- | --------------- | ----------------------------------------------------------- |
| `search`    | `searchFn`      | `(query: string) => Promise<string>`                        |
| `fetch`     | `fetchFn`       | `(url: string) => Promise<string>`                          |
| `ask`       | `askFn`         | `(parsedContent: string, query: string) => Promise<string>` |
| `parseHtml` | `parseHtmlFn`   | `(html: string) => Promise<string>`                         |

### Example: a search plugin

`~/.sibyl/plugins/my-search-plugin/main.js`

```js
export const SilbylPlugin = {
  type: "search",
};

export async function searchFn(query) {
  // ...do the search...
  return `Results for: ${query}`;
}
```

### Example: a fetch plugin

`~/.sibyl/plugins/my-fetch-plugin/main.js`

```js
export const SilbylPlugin = {
  type: "fetch",
};

export async function fetchFn(url) {
  // fetch html for the url
  return `HTML Content`;
}
```

### Example: an ask plugin

`~/.sibyl/plugins/my-llm-ask-plugib/main.js`

```js
export const SilbylPlugin = {
  type: "ask",
};

export async function askFn(parsedContent, query) {
  // ...answer query against the parsed content with an LLM...
  return `Answer to "${query}"`;
}
```

### Example: a Html parse plugin

`~/.sibyl/plugins/my-parse-plugin/main.js`

```js
export const SilbylPlugin = {
  type: "parseHtml",
};

export async function parseHtmlFn(html) {
  // ...convert raw html into token-efficient markdown...
  return `# Parsed content`;
}
```

### Validation

When `sibyl` is run, each plugin is validated. A plugin is **skipped with a warning** (it does not crash the CLI) if:

- the folder has no `main.js`,
- `SilbylPlugin` is missing or not an object,
- `type` is not one of `search` / `fetch` / `ask` / `parseHtml`,
- the matching function export (`searchFn` / `fetchFn` / `askFn` / `parseHtmlFn`) is missing or not a function.

## Contribution

During development you can run the CLI straight from source (no build step) with [`tsx`](https://github.com/privatenumber/tsx):

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

## Scripts

| Script           | Description                      |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Run the CLI from source via tsx. |
| `pnpm build`     | Compile `src` → `dist`.          |
| `pnpm start`     | Run the compiled CLI.            |
| `pnpm typecheck` | Type-check with `tsc --noEmit`.  |
| `pnpm lint`      | Lint with ESLint.                |
| `pnpm format`    | Format with Prettier.            |

## License

Apache-2.0
