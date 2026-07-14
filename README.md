![sibyl Logo](https://raw.githubusercontent.com/postapsis/sibyl/refs/heads/main/media-kit/banner.png)

[![POST/APSIS Sibly Page](https://img.shields.io/badge/made_by-POST%2FAPSIS-%23000000)](https://postapsis.com/sibyl)
[![sibyl License Page](https://img.shields.io/badge/license-Apache_2.0-brightgreen)](https://raw.githubusercontent.com/postapsis/sibyl/refs/heads/main/LICENSE)
[![sibyl CI Status](https://github.com/postapsis/sibyl/actions/workflows/ci.yaml/badge.svg)](https://github.com/postapsis/sibyl/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/postapsis/sibyl/branch/main/graph/badge.svg?token=NOTP4DPWO4)](https://codecov.io/gh/postapsis/sibyl)

---

Local-first web search and exploration for your AI agents, without the bloat.\
Extensible and lightweight by design 🕷️

---

## Status

⚠️ Currently in development.

## Quickstart

Sibyl uses **SearXNG** for web search and **Crawl4AI** for webpage fetching by default. Both run
locally with no API key. Lots of other options are available (e.g., **Exa**, **Firecrawl**, **Brightdata**, etc.). Check the [Configuration](#configuration) section for more details.

Get a working setup in a few steps:

1. Install **Sibyl** globally via NPM:

   ```bash
   # ⚠️ Not yet available on npm
   npm i -g sibyl
   ```

2. Run a local [SearXNG](https://github.com/searxng/searxng) instance for searching the web:

   ```bash
   # Create and enter a working directory for the SearXNG local instance
   mkdir ~/searxng
   cd ~/searxng

   # Download SearXNG's default settings
   curl -o settings.yml https://raw.githubusercontent.com/searxng/searxng/master/searx/settings.yml

   # Enable the JSON output format and replace the placeholder secret key
   sed -i -e 's/    - html$/    - html\n    - json/' \
          -e "s/secret_key: \"ultrasecretkey\"/secret_key: \"$(openssl rand -hex 32)\"/" \
          searxng/settings.yml

   # Start SearXNG on http://localhost:8080 with the updated settings
   docker run -d \
     --restart unless-stopped \
     -p 8080:8080 \
     -v ./settings.yml:/etc/searxng/settings.yml \
     --name searxng \
     searxng/searxng:latest
   ```

3. Run a local [Crawl4AI](https://github.com/unclecode/crawl4ai) instance for fetching webpages:

   ```bash
   docker run -d \
     --restart unless-stopped \
     -p 11235:11235 \
     --shm-size=3g \
     --name crawl4ai \
     unclecode/crawl4ai:latest
   ```

4. Run your first search:

   ```bash
   sibyl search "how to use react with vite"
   ```

5. Configure your settings!\
   Check the [Configuration](#configuration) section for more details.

## Commands

| Command              | Description                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| search <query>       | Searches the web <br/>`sibyl search "react vite"`                                                                                                                                                                                                         |
| fetch <url>          | Prints the content of a site in token-efficient markdown <br/>`sibyl fetch https://vite.dev/guide`                                                                                                                                                        |
| ask <url> <question> | Asks a query using LLM from a site's content <br/>`sibyl ask https://vite.dev/guide "how to start a react project with vite"`                                                                                                                             |
| setup <targets>      | Installs the `SIBYL.md` instructions doc into an agent's global instruction files <br/>`sibyl setup --claude --opencode --codex --antigravity` <br/>Targets: `--claude`, `--opencode`, `--codex`, `--antigravity`, `--other <file>` (embed into any file) |
| `--help`, `-h`       | Shows help.                                                                                                                                                                                                                                               |
| `--version`          | Shows version.                                                                                                                                                                                                                                            |

## Configuration

See the configuration documentation for more details at [docs/CONFIGURATION.md](https://github.com/postapsis/sibyl/blob/main/docs/CONFIGURATION.md)

## Create a Plugin

See the plugin development documentation for more details at [docs/CREATING-PLUGINS.md](https://github.com/postapsis/sibyl/blob/main/docs/CREATING-PLUGINS.md)

## Contribution

See the contribution documentation for more details at [docs/CONTRIBUTION.md](https://github.com/postapsis/sibyl/blob/main/docs/CONTRIBUTION.md)
