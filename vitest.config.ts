import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unitTest/**/*.test.ts"],
    exclude: ["node_modules", "playwright-report", "test-results"],
    environment: "node",
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      include: ["utils/**/*.ts", "config/**/*.ts"],
      exclude: ["utils/__tests__/**", "node_modules/**"],
      reportsDirectory: "./coverage",
    },
  },
});
