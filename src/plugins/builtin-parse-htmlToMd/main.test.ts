/*
 * Author: Jamius Siam
 * Since: 09/06/2026
 */
import { describe, expect, it } from "vitest";
import { SilbylPlugin } from "./main.ts";
import type { PluginContext } from "../../@types/plugin.ts";

const context: PluginContext = { configuredPlugins: {}, allPlugins: [], getPlugin: () => null };

const ARTICLE_HTML = `<!doctype html>
<html>
  <head>
    <title>Vite Guide</title>
    <style>.tracking{display:none}</style>
  </head>
  <body>
    <nav><a href="/">Home</a> <a href="/about">About</a></nav>
    <script>console.log("tracking-pixel-payload")</script>
    <article>
      <h2>Getting Started</h2>
      <p>Vite is a fast build tool for modern web projects.</p>
      <p>It supports React, Vue, and Svelte out of the box.</p>
      <img src="hero-banner.png" alt="hero" />
    </article>
    <footer>Copyright 2026</footer>
  </body>
</html>`;

describe("builtin-parse-htmlToMd", () => {
  it("extracts the main article content as markdown", async () => {
    const md = await SilbylPlugin.fn(ARTICLE_HTML, context);

    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(0);
    expect(md).toContain("Vite is a fast build tool for modern web projects.");
    expect(md).toContain("React, Vue, and Svelte");
  });

  it("drops scripts, styles, and images", async () => {
    const md = await SilbylPlugin.fn(ARTICLE_HTML, context);

    expect(md).not.toContain("tracking-pixel-payload");
    expect(md).not.toContain("tracking{display");
    expect(md).not.toContain("hero-banner.png");
  });

  it("collapses 2+ consecutive blank lines and trims", async () => {
    const md = await SilbylPlugin.fn(ARTICLE_HTML, context);

    expect(md).not.toMatch(/\n{2,}/);
    expect(md).toBe(md.trim());
  });

  it("returns an empty string when there is no content", async () => {
    await expect(SilbylPlugin.fn("   ", context)).resolves.toBe("");
  });

  it("strips attributes outside the allowlist while keeping a link's href", async () => {
    const html = `<article>
      <h1>Getting Started with Vite</h1>
      <p>Vite is a fast build tool for modern web projects. It supports React, Vue,
      and Svelte out of the box and ships with a dev server.</p>
      <p>Read the <a href="/guide" class="cta" title="tooltip text">official guide</a>
      for full setup instructions and configuration details.</p>
    </article>`;

    const md = await SilbylPlugin.fn(html, context);

    // The allowed `href` survives; the disallowed `title`/`class` are stripped,
    // so Turndown emits a bare link with no title syntax.
    expect(md).toContain("official guide");
    expect(md).toContain("/guide");
    expect(md).not.toContain("tooltip text");
    expect(md).not.toContain("cta");
  });
});
