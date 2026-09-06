// Der Leitfaden und der 3D-Rundgang im Handy-Format.
//
// Eigene Datei, weil ein Geräteprofil per test.use nur auf oberster Ebene
// erlaubt ist. Das Profil bringt "webkit" als Browser mit; hier läuft aber
// Chromium, deshalb wird der Eintrag verworfen.

import { devices, expect, test, type Page } from "@playwright/test";

const { defaultBrowserType: _browser, ...iphone } = devices["iPhone 15"];
test.use(iphone);

async function createProject(page: Page, name: string) {
  await page.goto("/");
  await page.getByTestId("new-project-name").fill(name);
  await page.getByTestId("new-project-submit").click();
  await page.waitForURL(/\/projects\/[a-z0-9]+\/assistant$/);
  return page.url().replace(/\/assistant$/, "");
}

test("Leitfaden und 3D-Rundgang sind mit dem Finger bedienbar", async ({ page }) => {
  const projectUrl = await createProject(page, `E2E Handy ${Date.now()}`);

  // Assistent im Hochformat: Stepper scrollt, Karte ist lesbar, kein Querscrollen der Seite
  await expect(page.getByTestId("journey-stepper")).toBeVisible();
  await expect(page.getByTestId("journey-cta")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  // Kopfzeile bietet den Weg zurück zum Leitfaden
  await expect(page.getByTestId("nav-assistant")).toBeVisible();

  // Demo-Wohnung anlegen, dann 3D-Rundgang mit Joystick
  await page.goto(`${projectUrl}/capture`);
  await page.getByTestId("demo-analysis").click();
  await expect(page.getByTestId("analysis-summary")).toBeVisible({ timeout: 45_000 });
  await page.goto(`${projectUrl}/view3d`);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Rundgang" }).click();
  await expect(page.getByTestId("walk-joystick")).toBeVisible();
  await expect(page.getByTestId("look-pad")).toBeVisible();
  await expect(page.getByText(/Joystick: gehen/)).toBeVisible();
});
