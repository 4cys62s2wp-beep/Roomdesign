import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    // Vorinstalliertes Chromium der Umgebung nutzen (kein Download nötig)
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : { executablePath: "/opt/pw-browsers/chromium" },
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 90_000,
  },
});
