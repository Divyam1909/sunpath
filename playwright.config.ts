import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3100";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "desktop", testMatch: /flows\.spec\.ts/, use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", testMatch: /mobile\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: "security", testMatch: /security\.spec\.ts/ },
    { name: "features", testMatch: /features\.spec\.ts/, use: { viewport: { width: 1280, height: 900 } } },
    { name: "screens", testMatch: /screens\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    env: { BILL_READER: "mock", AUTH_TRUST_HOST: "true" },
  },
});
