## Creating a Plugin

### File structure

Plugins are loaded at runtime from your home config directory. Sibyl creates these directories on first run:

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

| Type     | `fn` signature                                                                      |
| -------- | ----------------------------------------------------------------------------------- |
| `search` | `(query: string, context: PluginContext) => Promise<string>`                        |
| `fetch`  | `(url: string, context: PluginContext) => Promise<string>`                          |
| `ask`    | `(parsedContent: string, query: string, context: PluginContext) => Promise<string>` |
| `parse`  | `(html: string, context: PluginContext) => Promise<string>`                         |

#### The `context` argument

Every `fn` also receives a **`context`** object as its **last** argument, giving your plugin access to the rest of the
plugin system:

| Field               | Description                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `configuredPlugins` | The plugin selected for each type in your config, keyed by type — e.g. `context.configuredPlugins.parse`. Only configured types are present. |
| `allPlugins`        | An array of every loaded plugin (built-ins + your custom ones).                                                                              |
| `getPlugin(name)`   | Returns the loaded plugin whose `name` matches, or `null` if none does.                                                                      |

Each entry is a `{ name, type, fn }` object, so one plugin can invoke another — e.g. a `fetch` plugin can run the
configured parser with `await context.configuredPlugins.parse?.fn(html, context)`. Using `context` is optional; ignore
the argument if you don't need it.

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

`~/.sibyl/plugins/my-llm-ask-plugin/main.js`

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

When Sibyl is run, each plugin is validated. A plugin is **skipped with a warning** if:

- The folder has no `main.js`,
- `SilbylPlugin` is missing or not an object,
- In `SilbylPlugin` export:
  - `name` is missing or an empty string,
  - `type` is not one of `search` / `fetch` / `ask` / `parse`,
  - `fn` is missing or not a function.
