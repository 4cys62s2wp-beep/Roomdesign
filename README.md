# Roomdesign

**KI-gestützte Wohnungsplanung per Video-Rundgang.** Nimm mit dem Handy ein Video deiner leeren Wohnung auf — die App erkennt Räume, schätzt Maße, baut einen korrigierbaren Grundriss und entwirft komplette Einrichtungsvorschläge mit Farbpaletten, Möbellisten, Budget und 3D-Vorschau.

## Funktionen

- **Verbindliche Aufnahme-Anleitung** — ein fester Standard für jeden Rundgang (Objektiv 1×, 1080p/30 fps, Querformat, Brusthöhe, ein Schritt pro Sekunde, 20 Sekunden je Umdrehung, 2–4 Minuten Gesamtlänge). Damit werden zwei Aufnahmen vergleichbar und die Maßschätzung verlässlich.
- **Video-Aufnahme direkt im Browser** (PWA, Handy-Kamera) oder Video-Upload. Während des Rundgangs kannst du antippen, in welchem Raum du gerade bist (Raum-Tagging); die App führt dich dann pro Raum durch den immer gleichen Dreischritt und warnt, wenn das Video zu lang wird.
- **Datensparsam:** Das Video verlässt das Gerät nicht — im Browser werden ~28 Standbilder extrahiert und nur diese hochgeladen.
- **KI-Analyse (Claude):** erkennt Räume, schätzt Maße über Referenzobjekte (Türhöhe ≈ 200 cm), verortet Türen/Fenster/Durchgänge und baut per Auto-Layout einen Grundriss. Alle Werte sind als Schätzungen markiert.
- **Grundriss-Editor (SVG):** Räume verschieben, Ecken ziehen, **Ecken einfügen und entfernen für L-förmige Räume** (Türen und Fenster wandern automatisch mit), Maße numerisch korrigieren, Türen/Fenster anlegen und verschieben, Undo, Zoom/Pan, Versionierung. **Mehrere Etagen:** Jeder Raum bekommt eine Etage, Reiter blenden je Geschoss ein. KI-Schätzungen sind gestrichelt markiert, bis du sie bestätigst.
- **Design-Studio pro Raum:** Stil-Presets (Japandi, Skandinavisch, Industrial, …), Freitext-Wünsche, Budget. Die KI liefert strukturierte Vorschläge: Konzept, Farbpalette, Materialien, Möbel mit echten Maßen + Platzierung, Lichtplan, Tipps, Preise. Vorschläge vergleichen, favorisieren und mit Feedback überarbeiten („mehr Holz, weniger Deko“). **Möbel lassen sich anschließend selbst verschieben, drehen und entfernen** — mit Rückgängig-Knopf, serverseitiger Prüfung und Neuberechnung des Budgets. Gelöschte Vorschläge lassen sich sofort wiederherstellen.
- **3D-Rundgang (Three.js):** Die Wohnung wird aus dem Grundriss gebaut (Wände mit echten Öffnungen, Fensterglas) und mit prozeduralen Möbelmodellen in Originalgröße eingerichtet — Orbit-Ansicht und Ego-Modus (WASD) **mit Wandkollision** — Türen und Durchgänge lassen sich passieren, Wände halten. Mehrere Etagen werden übereinander gestapelt. Keine Bild-KI-Kosten.
- **Einkaufsliste & Budget:** aggregiert die favorisierten Vorschläge, CSV-Export, Druck-/PDF-Ansicht.
- **Designkonzept als PDF:** ein druckfertiges Dokument mit Deckblatt, Grundriss je Etage, einem Kapitel pro Raum (Vorschau, Palette, Materialien, Konzepttext, Möbel- und Lichtliste, Tipps) und der Budgetübersicht — über den Druckdialog des Browsers als PDF sicherbar.
- **Demo-Modus:** Ohne API-Key läuft die komplette App mit einer realistischen Beispielwohnung — ideal zum Ausprobieren.

## Schnellstart

```bash
npm install
npm run setup      # Prisma-Client generieren + SQLite-Datenbank anlegen
npm run dev        # http://localhost:3000
```

Ohne weitere Konfiguration startet die App im **Demo-Modus**.

### Vom Handy aus nutzen

Es gibt zwei Wege — der einfache braucht kein HTTPS:

**Video hochladen (ohne HTTPS).** `npm run dev` starten, auf dem Handy die angezeigte Netzwerk-Adresse aufrufen (`http://192.168.x.x:3000`, gleiches WLAN) und auf der Aufnahme-Seite **„Video hochladen"** antippen. Die Dateiauswahl bietet dort „Video aufnehmen" an, öffnet die Kamera-App des Handys — danach zieht die App die Standbilder daraus. Gleiches Ergebnis, nur ohne das Raum-Antippen während des Gehens.

**Aufnahme direkt im Browser (mit HTTPS).** Browser geben die Kamera nur auf `localhost` oder über HTTPS frei. Dafür:

```bash
npm run dev:https
```

Das Skript (`scripts/dev-https.mjs`) stellt mit [mkcert](https://github.com/FiloSottile/mkcert) ein Zertifikat aus, das `localhost` **und jede lokale Netzwerk-Adresse** dieses Rechners abdeckt, und startet `next dev` damit. Es gibt die passende `https://…`-Adresse fürs Handy aus.

Bewusst *ohne* `mkcert -install`: Das würde eine Zertifizierungsstelle in den System-Schlüsselbund schreiben und nach dem Admin-Passwort fragen — dem Handy nützt dieser Eintrag ohnehin nichts, da es dem Rechner nicht vertraut. Beide Geräte zeigen deshalb beim ersten Aufruf eine Zertifikatswarnung („Erweitert" → „Trotzdem fortfahren"); danach ist die Seite ein sicherer Kontext und die Kamera wird freigegeben.

Wer die Warnung auf dem eigenen Rechner loswerden will, führt den vom Skript ausgegebenen Befehl `mkcert -install` einmal von Hand aus — das ist eine bewusste Entscheidung und deshalb nicht automatisch.

> `next dev --experimental-https` allein reicht hier nicht: Es stellt das Zertifikat nur für `localhost`/`127.0.0.1`/`::1` aus und ruft mkcert immer mit `-install` auf.

### Echte KI aktivieren

1. API-Key auf [console.anthropic.com](https://console.anthropic.com) erstellen.
2. In der App unter **Einstellungen** eintragen (serverseitig gespeichert) — oder als Umgebungsvariable `ANTHROPIC_API_KEY` (z. B. in `.env.local`).
3. Modell ist konfigurierbar (Standard: `claude-opus-5`; günstiger z. B. `claude-sonnet-5`).

Kosten entstehen pro Analyse (bis zu 32 Bilder) und pro Designvorschlag (reiner Text). Fotorealistische Bild-Renders sind bewusst deaktiviert; eine Provider-Schnittstelle ist in `src/lib/ai/image-render.ts` vorbereitet.

## Scripts

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run dev:https` | Entwicklungsserver mit HTTPS — Zertifikat für `localhost` und die Netzwerk-Adressen des Rechners, nötig für die Kamera-Aufnahme auf dem Handy |
| `npm run build` / `npm start` | Production-Build / -Server |
| `npm run setup` | Prisma generate + DB anlegen (`data/app.db`) |
| `npm run test` | Unit-Tests (Vitest): Geometrie, Wände, Raumform, Begehbarkeit, Etagen, Fixtures, Layout, Möbel-Fit, CSV |
| `npm run e2e` | End-to-End-Tests (Playwright): Demo-Durchlauf, Aufnahme-Anleitung, Raumform & Möbel anordnen, Umbenennen/Etage/Wiederherstellen/PDF |

## Architektur

```
Browser                         Server (Next.js App Router)
───────                         ───────────────────────────
Aufnahme (MediaRecorder)        API-Routen (src/app/api/…)
  └─ Frame-Extraktion (Canvas)  Jobqueue (SQLite, in-process) ── src/lib/jobs/
Grundriss-Editor (SVG)          Provider-Abstraktion ─────────── src/lib/ai/
3D-Viewer (react-three-fiber)     ├─ ClaudeProvider (Vision-Analyse, Design-Engine)
Design-Studio                     └─ DemoProvider   (deterministische Fixtures)
                                Geometrie-Kern ───────────────── src/lib/geometry/
                                  (Grundriss-Modell, Wände+Öffnungen für 3D,
                                   Auto-Layout, Möbel-Plausibilisierung)
                                Prisma + SQLite (data/app.db)
```

Zentrales Datenmodell ist das `FloorPlanDoc` (`src/lib/types.ts`): Räume als Polygone (cm), Öffnungen an Wandkanten — dieselbe Quelle für den 2D-Editor **und** den 3D-Renderer. Designvorschläge (`ProposalDoc`) enthalten Möbel mit Platzierungskoordinaten, die serverseitig in den Raum „geklemmt“ und auf Türkollisionen geprüft werden (`furniture-fit.ts`).

## Grenzen

- Maße aus einem Handyvideo sind **Schätzungen** (typisch ±10–20 %). Der Editor ist dafür da, sie zu korrigieren — für Möbelkauf und Handwerker gilt das eigene Aufmaß.
- Die clientseitige Frame-Extraktion setzt voraus, dass der Browser das Videoformat abspielen kann (in der App aufgenommene Videos funktionieren immer; exotische Upload-Formate ggf. als MP4 exportieren).
- **Treppen sind nicht modelliert.** Etagen liegen im Editor nebeneinander und im 3D-Modell übereinander; im Rundgang wechselst du die Etage über ein Auswahlfeld statt über eine Treppe.
- Ein Nutzerkonto/Multi-User-Betrieb ist nicht eingebaut — die App ist für den Eigenbetrieb gedacht.
