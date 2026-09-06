// Der Leitfaden: erkennt den Projektstand, hakt ab, führt weiter — am Mac und
// im Handy-Format.

import { devices, expect, test, type Page } from "@playwright/test";

async function createProject(page: Page, name: string) {
  await page.goto("/");
  await page.getByTestId("new-project-name").fill(name);
  await page.getByTestId("new-project-submit").click();
  await page.waitForURL(/\/projects\/[a-z0-9]+\/assistant$/);
  return page.url().replace(/\/assistant$/, "");
}

test("Leitfaden führt durch den ganzen Ablauf", async ({ page }) => {
  const projectName = `E2E Leitfaden ${Date.now()}`;
  const projectUrl = await createProject(page, projectName);

  // 1. Frisches Projekt: Vorbereiten ist dran, Handy-Adresse wird gezeigt
  await expect(page.getByTestId("journey-heading")).toHaveText(/Schritt 1 von 6 · Vorbereiten/);
  await expect(page.getByTestId("journey-phase")).toHaveAttribute("data-phase", "prepare");
  await expect(page.getByTestId("phone-connect")).toBeVisible();
  await expect(page.getByTestId("phone-url")).toContainText("/capture");
  await expect(page.getByTestId("phone-qr")).toBeVisible();

  // 2. Haken setzen — und er überlebt das Neuladen (liegt am Projekt, nicht im Browser)
  const substeps = page.getByTestId("journey-substep");
  await expect(substeps.first()).toHaveAttribute("data-done", "0");
  const saved = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes("/api/projects/"),
  );
  await substeps.first().getByTestId("journey-check").click();
  await expect(substeps.first()).toHaveAttribute("data-done", "1");
  // Der Haken wird sofort angezeigt, aber erst danach gespeichert — vor dem
  // Neuladen also auf die Antwort warten
  await saved;
  await page.reload();
  await expect(page.getByTestId("journey-substep").first()).toHaveAttribute("data-done", "1");

  // 3. Alle Pflichtpunkte abgehakt → Aufnehmen ist dran
  await page.getByTestId("journey-substep").nth(1).getByTestId("journey-check").click();
  await page.getByTestId("journey-substep").nth(2).getByTestId("journey-check").click();
  await expect(page.getByTestId("journey-heading")).toHaveText(/Schritt 2 von 6 · Aufnehmen/);
  await expect(page.getByTestId("journey-step-prepare")).toHaveAttribute("data-status", "done");
  await expect(page.getByTestId("journey-cta")).toHaveText(/Zur Aufnahme/);

  // Andere Phase ansehen und zurück
  await page.getByTestId("journey-step-design").click();
  await expect(page.getByTestId("journey-phase")).toHaveAttribute("data-phase", "design");
  await page.getByRole("button", { name: /Zurück zu „Jetzt dran/ }).click();
  await expect(page.getByTestId("journey-phase")).toHaveAttribute("data-phase", "record");

  // 4. Demo-Analyse → Grundriss prüfen ist dran, mit Zähler
  await page.goto(`${projectUrl}/capture`);
  await page.getByTestId("demo-analysis").click();
  await expect(page.getByTestId("analysis-summary")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("link", { name: "Weiter im Leitfaden" }).click();
  await page.waitForURL(/\/assistant$/);
  await expect(page.getByTestId("journey-heading")).toHaveText(/Schritt 4 von 6 · Grundriss prüfen/);
  await expect(page.getByTestId("journey-phase")).toContainText("0 von 5 Räumen bestätigt");

  // 5. Alle Räume bestätigen → Einrichten ist dran, führt zum ersten Raum
  await page.goto(`${projectUrl}/floorplan`);
  const rooms = page.locator('[data-testid="floorplan-svg"] polygon');
  for (let index = 0; index < 5; index++) {
    await rooms.nth(index).click();
    await page.getByTestId("confirm-room").click();
  }
  await page.getByTestId("save-floorplan").click();
  await expect(page.getByTestId("save-floorplan")).toHaveText(/Gespeichert/, { timeout: 10_000 });

  await page.goto(`${projectUrl}/assistant`);
  await expect(page.getByTestId("journey-heading")).toHaveText(/Schritt 5 von 6 · Einrichten/);
  await expect(page.getByTestId("journey-cta")).toHaveText(/einrichten →$/);
  await expect(page.getByTestId("journey-progress")).toContainText("67 %");

  // 6. Projektübersicht und Startseite zeigen denselben Stand
  await page.goto(projectUrl);
  await expect(page.getByTestId("journey-now")).toHaveAttribute("data-phase", "design");
  await expect(page.getByTestId("journey-now-cta")).toBeVisible();
  await page.goto("/");
  // Die eigene Karte am Namen suchen — parallel laufende Tests legen ebenfalls
  // Projekte an, und die neueste steht oben
  await expect(
    page.getByTestId("project-card").filter({ hasText: projectName }).getByTestId("project-next-step"),
  ).toHaveText("Jetzt dran: Einrichten");
  await expect(page.getByTestId("journey-overview").locator("li")).toHaveCount(6);
});
