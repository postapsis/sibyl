# Configuration

## Configuration file

Sibyl reads its configuration from `~/.config/sibyl/config.json`, created with sensible defaults on first run. It has two sections:

```json
{
  "plugins": {
    "search": "builtin-searxng-search",
    "fetch": "builtin-crawl4ai-fetch",
    "parse": "builtin-parse-htmlToMd",
    "ask": "builtin-ai-ask"
  },
  "variables": [
    {
      "name": "SIBYL_SHOW_SEARCH_DESCRIPTION",
      "value": "true"
    },
    {
      "name": "SIBYL_SEARCH_TIMEOUT",
      "value": "10000"
    },
    {
      "name": "SIBYL_FETCH_TIMEOUT",
      "value": "10000"
    },
    {
      "name": "SIBYL_ASK_TIMEOUT",
      "value": "30000"
    }
  ]
}
```

### The `plugins` section

Maps each plugin type (`search` / `fetch` / `ask` / `parse`) to the **name** of the plugin to use for it. Exactly one
plugin per type. The value must match a plugin's `name` (a built-in like `builtin-exa-search`, or one of your custom-written plugins).

<br>
The built-in plugins are:

1. SearXNG Search - `builtin-searxng-search`
2. Crawl4AI Fetch - `builtin-crawl4ai-fetch`
3. Exa Search - `builtin-exa-search`
4. Exa Fetch - `builtin-exa-fetch`
5. Firecrawl Search - `builtin-firecrawl-search`
6. Firecrawl Fetch - `builtin-firecrawl-fetch`
7. AlterLab Search - `builtin-alterlab-search`
8. AlterLab Fetch - `builtin-alterlab-fetch`
9. Bright Data Search - `builtin-brightdata-search`
10. Bright Data Fetch - `builtin-brightdata-fetch`
11. AI Ask (Supports OpenAI, Anthropic, Ollama, OpenRouter) - `builtin-ai-ask`
12. HTML to Markdown Parse - `builtin-parse-htmlToMd`

### The `variables` section

A list of `{ name, value }` pairs injected into the process environment at startup. Use this to provide secrets and
settings (e.g., API keys) that plugins read via `process.env`.

Precedence: **Variable in the configuration file wins over the environment.** A variable defined here overrides any existing environment variable of
the same name; anything not listed here falls back to the real environment. For example, a plugin reading
`process.env.EXA_API_KEY` gets the configuration value if present, otherwise whatever was exported in your shell.

### Timeout variables

Timeout values are configured in milliseconds. Each variable is optional; when it is absent from both the configuration and
the environment, Sibyl uses its current default.

| Variable               | Default              | Description                                                |
| ---------------------- | -------------------- | ---------------------------------------------------------- |
| `SIBYL_SEARCH_TIMEOUT` | `10000` (10 seconds) | Timeout for HTTP requests made by built-in search plugins. |
| `SIBYL_FETCH_TIMEOUT`  | `10000` (10 seconds) | Timeout for HTTP requests made by built-in fetch plugins.  |
| `SIBYL_ASK_TIMEOUT`    | `30000` (30 seconds) | Timeout for LLM generation by the built-in ask plugin.     |

Values must be integers from `1` through `2147483647` milliseconds. Invalid values cause the selected plugin call to fail.
The ask plugin fetches the URL first, so that request uses `SIBYL_FETCH_TIMEOUT`; `SIBYL_ASK_TIMEOUT` applies only to
LLM generation. Parse plugins are not timed, and custom plugins are not automatically timed.

## Plugin environment variables

Each built-in plugin reads the variables below (set them via `variables` or the real environment, per the precedence rule
above). A **required** variable causes the plugin to error if it is not set.

All `search` plugins also honor the following environment variables:

1. **`SIBYL_SEARCH_RESULTS_LIMIT`** (default `10`): Sibyl passes it to the search provider if it supports a result-count parameter, and always slices the returned results down to this
   limit.
2. **`SIBYL_SHOW_SEARCH_DESCRIPTION`** (default `true`): When `"true"`, includes result snippet/description in the output.

<br/>
Here is a list of all the environment variables for the built-in plugins:

### SearXNG Search

| Variable                        | Required | Default                 | Description                                                                                             |
| ------------------------------- | -------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `SIBYL_SEARXNG_URL`             | No       | `http://localhost:8080` | Base URL of a running SearXNG instance. Sibyl uses `/search` endpoint with `format=json`.               |
| `SIBYL_SEARXNG_ENGINES`         | No       | _(none)_                | Comma-separated SearXNG engines to query (e.g. `google`); omitted when unset.                           |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`                  | When `"true"`, includes result content in the output.                                                   |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`                    | Maximum number of search results to return; passed to the when supported and always applied by slicing. |

Requires a SearXNG instance with the **JSON output format enabled**. See more at [https://github.com/searxng/searxng/discussions/3542](https://github.com/searxng/searxng/discussions/3542)

### Crawl4AI Fetch

| Variable                        | Required | Default                  | Description                                                                               |
| ------------------------------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `SIBYL_CRAWL4AI_URL`            | No       | `http://localhost:11235` | Base URL of a running Crawl4AI server. Sibyl uses the `/crawl` endpoint to fetch the data |
| `SIBYL_CRAWL4AI_PROXY_SERVER`   | No       | _(none)_                 | Proxy server URL for the crawler. When unset, no proxy is used.                           |
| `SIBYL_CRAWL4AI_PROXY_USERNAME` | No       | _(none)_                 | Proxy auth username. Sent only when set and a proxy server is configured.                 |
| `SIBYL_CRAWL4AI_PROXY_PASSWORD` | No       | _(none)_                 | Proxy auth password. Sent only when set and a proxy server is configured.                 |

Requires a Crawl4AI server, e.g., via Docker. See more at [https://hub.docker.com/r/unclecode/crawl4ai](https://hub.docker.com/r/unclecode/crawl4ai)

### Exa Search

| Variable                        | Required | Default | Description                                                                                             |
| ------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `EXA_API_KEY`                   | Yes      | —       | Exa API key.                                                                                            |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`  | When `"true"`, includes result highlights in the output.                                                |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`    | Maximum number of search results to return; passed to the when supported and always applied by slicing. |

### Exa Fetch

| Variable      | Required | Default | Description  |
| ------------- | -------- | ------- | ------------ |
| `EXA_API_KEY` | Yes      | —       | Exa API key. |

### Firecrawl Search

| Variable                        | Required | Default | Description                                                                                             |
| ------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `FIRECRAWL_API_KEY`             | Yes      | —       | Firecrawl API key (includes the `fc-` prefix).                                                          |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`  | When `"true"`, includes result descriptions in the output.                                              |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`    | Maximum number of search results to return; passed to the when supported and always applied by slicing. |

### Firecrawl Fetch

| Variable                         | Required | Default | Description                                                                                                                                                            |
| -------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIRECRAWL_API_KEY`              | Yes      | —       | Firecrawl API key (includes the `fc-` prefix).                                                                                                                         |
| `SIBYL_FIRECRAWL_FETCH_USE_HTML` | No       | `false` | When `"true"`, fetches the raw HTML and runs it through the configured `parse` plugin; otherwise returns the markdown from Firecrawl with extra blank lines collapsed. |

### AlterLab Search

| Variable                        | Required | Default | Description                                                                                             |
| ------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `ALTERLAB_API_KEY`              | Yes      | —       | AlterLab API key.                                                                                       |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`  | When `"true"`, includes result snippets in the output.                                                  |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`    | Maximum number of search results to return; passed to the when supported and always applied by slicing. |

### AlterLab Fetch

| Variable           | Required | Default | Description       |
| ------------------ | -------- | ------- | ----------------- |
| `ALTERLAB_API_KEY` | Yes      | —       | AlterLab API key. |

### Bright Data Search

| Variable                        | Required | Default  | Description                                                                                             |
| ------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `BRIGHTDATA_API_KEY`            | Yes      | —        | Bright Data API key.                                                                                    |
| `BRIGHTDATA_SERP_API_ZONE`      | Yes      | —        | Bright Data SERP API zone.                                                                              |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`   | When `"true"`, includes result descriptions in the output.                                              |
| `BRIGHTDATA_SERP_API_LANGUAGE`  | No       | `en`     | Search language (Google `hl`).                                                                          |
| `BRIGHTDATA_SERP_API_COUNTRY`   | No       | _(none)_ | Search country (Google `gl`); omitted when unset.                                                       |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`     | Maximum number of search results to return; passed to the when supported and always applied by slicing. |

### Bright Data Fetch

| Variable                           | Required | Default | Description                        |
| ---------------------------------- | -------- | ------- | ---------------------------------- |
| `BRIGHTDATA_API_KEY`               | Yes      | —       | Bright Data API key.               |
| `BRIGHTDATA_WEB_UNLOCKER_API_ZONE` | Yes      | —       | Bright Data Web Unlocker API zone. |

### AI Ask

Reads a URL through the configured `fetch` plugin, then asks an LLM the question against that content. A working `fetch` plugin must also be configured (`plugins.fetch`).

| Variable             | Required    | Default                      | Description                                                                                  |
| -------------------- | ----------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `SIBYL_AI_PROVIDER`  | Yes         | —                            | LLM: one of `openai`, `anthropic`, `ollama`, `openrouter`.                                   |
| `SIBYL_MODEL_NAME`   | Yes         | —                            | Model id passed to the (e.g. `gpt-5.4-mini`, `claude-sonnet-4-6`, `llama3.1`).               |
| `OPENAI_API_KEY`     | Conditional | —                            | Required when `SIBYL_AI_PROVIDER=openai`.                                                    |
| `ANTHROPIC_API_KEY`  | Conditional | —                            | Required when `SIBYL_AI_PROVIDER=anthropic`.                                                 |
| `OPENROUTER_API_KEY` | Conditional | —                            | Required when `SIBYL_AI_PROVIDER=openrouter`.                                                |
| `OLLAMA_BASE_URL`    | No          | `http://localhost:11434/api` | Base URL of a running Ollama server; used only when `SIBYL_AI_PROVIDER=ollama` (no API key). |

### HTML to Markdown Parse

No environment variables.
