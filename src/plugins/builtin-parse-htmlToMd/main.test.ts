/*
 * Author: Jamius Siam
 * Since: 09/06/2026
 */
import { describe, expect, it } from "vitest";
import { SilbylPlugin } from "./main.ts";

describe("builtin-parse-htmlToMd", () => {
  it("returns the input html with the TODO passthrough suffix", async () => {
    await expect(SilbylPlugin.fn("<p>hi</p>")).resolves.toEqual("<p>hi</p>\n\n html parse TODO");
  });
});
