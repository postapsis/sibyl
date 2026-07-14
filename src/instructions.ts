/*
 * Author: Jamius Siam
 * Since: 14/07/2026
 */

// The bundled `SIBYL.md` instructions doc installed by `sibyl setup`. Inlined here (rather
// than read from disk) because the build is `tsc`-only with no asset-copy step, so a raw
// `.md` file would never reach `dist`. Assembled as a line array joined with newlines so the
// fenced code block below doesn't need its backticks escaped inside a template literal.
export const SIBYL_INSTRUCTIONS = [
  "# Search the web using `sibyl`",
  "Use `sibyl` CLI for searching google/fetching webpages.",
  "",
  "## Usage",
  "```",
  "Commands:",
  "  search <query>   Search the web",
  "  fetch <url>      Fetch the content of a URL",
  "  help             Show this help",
  "  version          Show version",
  "",
  "Examples:",
  '  sibyl search "react vite bootstrap"',
  "  sibyl fetch https://vite.dev/guide",
  "```",
  "",
  "Always search the web first when installing a new library/framework to get the latest docs. Also search when you want to find out information/API DOC etc.",
  "Search more often than not. Conduct multiple search and fetches using subagents (with Haiku) and then proceed.",
  "Use your judgment when interpreting web search results. Do not rely only on the first result you find.",
  "If the information is incomplete, unclear, or insufficient to make a confident decision, perform a few more searches or fetch additional sources before making changes.",
  "",
  "Collect all the necessary information thoroughly before proceeding with creating/editing code.",
].join("\n");

// Filename for the standalone doc that reference-based targets (Claude, opencode) point at.
export const SIBYL_DOC_FILENAME = "SIBYL.md";

// Import line added to Claude Code's CLAUDE.md (resolves relative to that file).
export const SIBYL_IMPORT_LINE = "@SIBYL.md";

// Sentinel markers wrapping the embedded content in tools that can't reference a file.
export const SIBYL_BLOCK_START = "<!-- SIBYL:START -->";
export const SIBYL_BLOCK_END = "<!-- SIBYL:END -->";
export const SIBYL_BLOCK_NOTICE =
  "<!-- Managed by 'sibyl setup'. Do not edit or remove the block above; it is refreshed on each run. -->";
