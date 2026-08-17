import fs from "fs";
import { defineConfig } from "@playwright/test";

// Manche Umgebungen (z. B. Entwicklungs-Container) bringen ein vorinstalliertes
// Chromium mit. Existiert es, wird es genutzt; sonst greift Playwright auf den
// selbst heruntergeladenen Browser zurück — so läuft der Test lokal wie in CI.
const preinstalledChromium =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(preinstalledChromium) ? preinstalledChromium : undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
