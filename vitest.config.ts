/*
 * Author: Jamius Siam
 * Since: 07/06/2026
 */
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    exclude: [...configDefaults.exclude, "src/exit.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/@types/**/*.ts", "src/exit.ts"],
      reporter: ["text", "html", "lcov"],
    },
  },
});
