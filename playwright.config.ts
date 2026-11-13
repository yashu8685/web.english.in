import { defineConfig } from "@playwright/test";
import { TEST_DATABASE_URL } from "../api/scripts/test-db.ts";

const API_PORT = 8787;
const WEB_PORT = 5173;

/**
 * End-to-end tests run against the real web app, the real API and a dedicated
 * Postgres database (`fluent_test`). Both dev servers are started here, so no
 * separate terminal is needed — but the ports must be free.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "../api",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(API_PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        BETTER_AUTH_SECRET: "test-only-secret-please-do-not-use-in-production",
        BETTER_AUTH_URL: `http://localhost:${API_PORT}`,
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`
      }
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        VITE_API_URL: `http://localhost:${API_PORT}`
      }
    }
  ]
});
