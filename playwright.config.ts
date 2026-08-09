import { defineConfig, devices } from "@playwright/test";

const requestedPort = process.env.PLAYWRIGHT_PORT;
const port =
  requestedPort && /^\d{2,5}$/.test(requestedPort) ? requestedPort : "3100";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      grepInvert: /@mobile/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      grep: /@mobile/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm exec next start --port ${port}`,
    env: {
      ADMIN_EMAILS: "",
      APIFY_API_TOKEN: "",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      AUTH_SECRET: "playwright-only-auth-secret-at-least-32-characters",
      AUTH_URL: baseURL,
      DEMO_MODE: "true",
      EMAIL_FROM: "",
      EMAIL_SERVER: "",
      FIELD_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      LIVE_DATA_ONLY: "false",
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_LIVE_DATA_ONLY: "false",
      OPENROUTER_API_KEY: "",
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
