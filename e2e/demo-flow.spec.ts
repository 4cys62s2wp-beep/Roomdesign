// E2E-Happy-Path im Demo-Modus: Projekt anlegen → Demo-Analyse → Grundriss →
// Design-Vorschläge → Favorit → Einkaufsliste → 3D-Ansicht.

import { expect, test } from "@playwright/test";

test("kompletter Demo-Durchlauf", async ({ page }) => {
  // 1. Projekt anlegen
  await page.goto("/");
  const projectName = `E2E Wohnung ${Date.now()}`;
  await page.getByTestId("new-project-name").fill(projectName);
  await page.getByTestId("new-project-submit").click();
  await page.waitForURL(/\/projects\/[a-z0-9]+$/);
  const projectUrl = page.url();

  // 2. Demo-Analyse starten
  await page.goto(`${projectUrl}/capture`);
  await page.getByTestId("demo-analysis").click();
  await page.waitForURL(/\/analysis\?job=/);
  await expect(page.getByTestId("analysis-summary")).toBeVisible({ timeout: 45_000 });

  // 3. Grundriss-Editor: 5 Räume der Demo-Wohnung sichtbar
  await page.getByTestId("to-floorplan").click();
  await expect(page.getByTestId("floorplan-svg")).toBeVisible();
  await expect(page.locator('[data-testid="floorplan-svg"] polygon')).toHaveCount(5);

  // 4. Raum umbenennen und speichern
  await page.locator('[data-testid="floorplan-svg"] polygon').first().click();
  await expect(page.getByTestId("room-panel")).toBeVisible();
  const widthInput = page.getByTestId("room-width");
  await widthInput.fill("500");
  await widthInput.blur();
  await page.getByTestId("save-floorplan").click();
  await expect(page.getByTestId("save-floorplan")).toHaveText(/Gespeichert/, { timeout: 10_000 });

  // 5. Design-Studio: Vorschläge generieren + Favorit setzen
  await page.goto(projectUrl);
  const roomCards = page.getByTestId("room-card");
  await expect(roomCards).toHaveCount(5);
  await roomCards.first().click();
  await page.waitForURL(/\/design$/);
  await page.getByTestId("style-prompt").fill("Hell, gemütlich, viel Holz");
  await page.getByTestId("generate-designs").click();
  await expect(page.getByTestId("proposal-card").first()).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("favorite-toggle").first().click();

  // 6. Einkaufsliste zeigt Budget > 0
  await page.goto(`${projectUrl}/shopping`);
  await expect(page.getByTestId("total-budget")).toBeVisible();
  await expect(page.getByTestId("total-budget")).not.toHaveText(/^0\s/);

  // 7. 3D-Ansicht rendert eine Canvas
  await page.goto(`${projectUrl}/view3d`);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
});

test("Aufnahme-Anleitung ist vor der Aufnahme erreichbar", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("new-project-name").fill(`E2E Anleitung ${Date.now()}`);
  await page.getByTestId("new-project-submit").click();
  await page.waitForURL(/\/projects\/[a-z0-9]+$/);
  const projectUrl = page.url();

  // Beim ersten Besuch wird die Anleitung aktiv angeboten
  await page.goto(`${projectUrl}/capture`);
  await expect(page.getByTestId("guide-callout")).toBeVisible();
  await page.getByTestId("open-guide").click();
  await page.waitForURL(/\/capture\/guide$/);

  // Die harten Vorgaben stehen drin
  await expect(page.getByRole("heading", { name: /So filmst du deine Wohnung/ })).toBeVisible();
  await expect(page.getByText("Objektiv: 1× (Hauptkamera)")).toBeVisible();
  await expect(page.getByText(/1080p bei 30 fps/)).toBeVisible();
  await expect(page.getByText(/Eine volle Drehung dauert 20 Sekunden/)).toBeVisible();

  // Zurück zur Aufnahme: Hinweis ist quittiert, Kurzfassung bleibt erreichbar
  await page.getByRole("link", { name: /Alles klar/ }).click();
  await page.waitForURL(/\/capture$/);
  await expect(page.getByTestId("guide-callout")).toHaveCount(0);
  await page.getByRole("button", { name: "Checkliste" }).click();
  await expect(page.getByText(/Objektiv auf 1×/)).toBeVisible();
});
