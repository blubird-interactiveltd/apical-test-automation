import { defineConfig, devices } from "@playwright/test";
import { timeouts } from "./config/timeouts.config";

export default defineConfig({
  testDir: "./tests",
  // tests/unitTest belongs to Vitest. Without this, Playwright's default
  // testMatch (**/*.@(spec|test).ts) picks up the unit tests and fails loading
  // them on their `vitest` imports.
  testIgnore: ["**/unitTest/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Parallel is safe here, unlike a suite that writes to a shared store: the
  // AP-779 specs stub every online-class endpoint they assert on, and the live
  // checks only read. CI stays at one worker to keep the login rate low;
  // locally the npm scripts pass --workers=6.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI
    ? [
        ["html", { open: "never" }],
        ["junit", { outputFile: "results.xml" }],
      ]
    : [["html"], ["list"]],

  timeout: timeouts.testTimeout,
  expect: {
    timeout: timeouts.expectTimeout,
  },
  use: {
    // Read directly rather than via EnvLoader.get: this config is evaluated even
    // when no spec runs, and EnvLoader.get throws on a missing variable. Specs
    // that require a guaranteed URL call EnvLoader.get("BASE_URL") themselves.
    baseURL: process.env.BASE_URL,
    // Run headed locally so failures are watchable; CI has no display server.
    headless: !!process.env.CI,
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: timeouts.actionTimeout,
    navigationTimeout: timeouts.navigationTimeout,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
