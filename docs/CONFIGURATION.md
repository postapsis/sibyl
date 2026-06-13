## Configuration

### Configuration file

Sibyl reads its config from `~/.sibyl/config.json`, created with sensible defaults on first run. It has two sections:

```json
{
  "plugins": {
    "search": "builtin-searxng-search",
    "fetch": "builtin-crawl4ai-fetch",
    "parse": "builtin-parse-htmlToMd"
  },
  "variables": []
}
```

#### `plugins` section

Maps each plugin type (`search` / `fetch` / `ask` / `parse`) to the **name** of the plugin to use for it. Exactly one
plugin per type. The value must match a plugin's `name` (a builtin like `builtin-exa-search`, or one of your custom-written plugins).

#### `variables` section

A list of `{ name, value }` pairs injected into the process environment at startup. Use this to provide secrets and
settings (e.g., API keys) that plugins read via `process.env`.

Precedence: **config wins over the environment.** A variable defined here overrides any existing environment variable of
the same name; anything not listed here falls back to the real environment. For example, a plugin reading
`process.env.EXA_API_KEY` gets the config value if present, otherwise whatever was exported in your shell.

### Plugin environment variables

Each builtin plugin reads the variables below (set them via `variables` or the real environment, per the precedence rule
above). A **required** variable causes the plugin to error if it is unset.

All `search` plugins also honor the following environment variables

1. **`SIBYL_SEARCH_RESULTS_LIMIT`** (default `10`): Sibyl passes it to the search
   provider's API when the provider supports a result-count parameter, and always slices the returned results down to this
   limit.
2. **`SIBYL_SHOW_SEARCH_DESCRIPTION`** (default `true`): When `"true"`, includes result snippet/description in the output.

#### `builtin-searxng-search` — `search`

| Variable                        | Required | Default                 | Description                                                                                                      |
| ------------------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `SIBYL_SEARXNG_URL`             | No       | `http://localhost:8080` | Base URL of a running SearXNG instance. Sibyl uses `/search` endpoint with `format=json`.                        |
| `SIBYL_SEARXNG_ENGINES`         | No       | _(none)_                | Comma-separated SearXNG engines to query (e.g. `google`); omitted when unset.                                    |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`                  | When `"true"`, includes result content in the output.                                                            |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`                    | Maximum number of search results to return; passed to the provider when supported and always applied by slicing. |

Requires a SearXNG instance with the **JSON output format enabled**. See more at [https://github.com/searxng/searxng/discussions/3542](https://github.com/searxng/searxng/discussions/3542)

#### `builtin-crawl4ai-fetch` — `fetch`

| Variable             | Required | Default                  | Description                                                                               |
| -------------------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `SIBYL_CRAWL4AI_URL` | No       | `http://localhost:11235` | Base URL of a running Crawl4AI server. Sibyl uses the `/crawl` endpoint to fetch the data |

Requires a Crawl4AI server, e.g., via Docker. See more at [https://hub.docker.com/r/unclecode/crawl4ai](https://hub.docker.com/r/unclecode/crawl4ai)

#### `builtin-exa-search` — `search`

| Variable                        | Required | Default | Description                                                                                                      |
| ------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `EXA_API_KEY`                   | Yes      | —       | Exa API key.                                                                                                     |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`  | When `"true"`, includes result highlights in the output.                                                         |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`    | Maximum number of search results to return; passed to the provider when supported and always applied by slicing. |

#### `builtin-exa-fetch` — `fetch`

| Variable      | Required | Default | Description  |
| ------------- | -------- | ------- | ------------ |
| `EXA_API_KEY` | Yes      | —       | Exa API key. |

#### `builtin-firecrawl-search` — `search`

| Variable                        | Required | Default | Description                                                                                                      |
| ------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `FIRECRAWL_API_KEY`             | Yes      | —       | Firecrawl API key (includes the `fc-` prefix).                                                                   |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`  | When `"true"`, includes result descriptions in the output.                                                       |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`    | Maximum number of search results to return; passed to the provider when supported and always applied by slicing. |

#### `builtin-firecrawl-fetch` — `fetch`

| Variable                         | Required | Default | Description                                                                                                                                                            |
| -------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIRECRAWL_API_KEY`              | Yes      | —       | Firecrawl API key (includes the `fc-` prefix).                                                                                                                         |
| `SIBYL_FIRECRAWL_FETCH_USE_HTML` | No       | `false` | When `"true"`, fetches the raw HTML and runs it through the configured `parse` plugin; otherwise returns the markdown from Firecrawl with extra blank lines collapsed. |

#### `builtin-alterlab-search` — `search`

| Variable                        | Required | Default | Description                                                                                                      |
| ------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `ALTERLAB_API_KEY`              | Yes      | —       | AlterLab API key.                                                                                                |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`  | When `"true"`, includes result snippets in the output.                                                           |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`    | Maximum number of search results to return; passed to the provider when supported and always applied by slicing. |

#### `builtin-alterlab-fetch` — `fetch`

| Variable           | Required | Default | Description       |
| ------------------ | -------- | ------- | ----------------- |
| `ALTERLAB_API_KEY` | Yes      | —       | AlterLab API key. |

#### `builtin-brightdata-search` — `search`

| Variable                        | Required | Default  | Description                                                                                                      |
| ------------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `BRIGHTDATA_API_KEY`            | Yes      | —        | Bright Data API key.                                                                                             |
| `BRIGHTDATA_SERP_API_ZONE`      | Yes      | —        | Bright Data SERP API zone.                                                                                       |
| `SIBYL_SHOW_SEARCH_DESCRIPTION` | No       | `true`   | When `"true"`, includes result descriptions in the output.                                                       |
| `BRIGHTDATA_SERP_API_LANGUAGE`  | No       | `en`     | Search language (Google `hl`).                                                                                   |
| `BRIGHTDATA_SERP_API_COUNTRY`   | No       | _(none)_ | Search country (Google `gl`); omitted when unset.                                                                |
| `SIBYL_SEARCH_RESULTS_LIMIT`    | No       | `10`     | Maximum number of search results to return; passed to the provider when supported and always applied by slicing. |

#### `builtin-brightdata-fetch` — `fetch`

| Variable                           | Required | Default | Description                        |
| ---------------------------------- | -------- | ------- | ---------------------------------- |
| `BRIGHTDATA_API_KEY`               | Yes      | —       | Bright Data API key.               |
| `BRIGHTDATA_WEB_UNLOCKER_API_ZONE` | Yes      | —       | Bright Data Web Unlocker API zone. |

#### `builtin-parse-htmlToMd` — `parse`

No environment variables.
