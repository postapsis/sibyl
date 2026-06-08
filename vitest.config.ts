/*
 * Author: Jamius Siam
 * Since: 07/06/2026
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/setup.ts"],
      reporter: ["text", "html"],
    },
  },
});
