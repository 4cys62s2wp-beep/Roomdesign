import { describe, expect, it } from "vitest";
import { PHASES, deriveJourney, emptyJourneyState, nextStepLabel } from "@/lib/journey";
import { journeyStateFromProject, parseChecks } from "@/lib/journey-server";

const rooms = (count: number, overrides: Partial<{ confirmed: boolean; hasProposals: boolean; hasFavorite: boolean }> = {}) =>
  Array.from({ length: count }, (_, index) => ({
    id: `room-${index}`,
    name: `Raum ${index + 1}`,
    confirmed: false,
    hasProposals: false,
    hasFavorite: false,
    ...overrides,
  }));

describe("Leitfaden", () => {
  it("beginnt bei einem leeren Projekt mit dem Vorbereiten", () => {
    const journey = deriveJourney(emptyJourneyState("p1"));
    expect(journey.current.phase.id).toBe("prepare");
    expect(journey.completion).toBe(0);
    expect(nextStepLabel(journey)).toBe("Jetzt dran: Vorbereiten");
    expect(journey.phases.map((p) => p.status)).toEqual([
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("gilt Vorbereiten als erledigt, sobald alle Pflichtpunkte abgehakt sind", () => {
    const state = emptyJourneyState("p1");
    state.checks = { "prepare.apartment": true, "prepare.camera": true, "prepare.connect": true };
    const journey = deriveJourney(state);
    expect(journey.phases[0].status).toBe("done");
    expect(journey.current.phase.id).toBe("record");
    // Der optionale KI-Punkt zählt nicht mit
    expect(journey.phases[0].requiredCount).toBe(3);
  });

  it("überspringt Vorbereiten und Aufnehmen, sobald ein Grundriss existiert (Demo)", () => {
    const state = { ...emptyJourneyState("p1"), hasPlan: true, rooms: rooms(3) };
    const journey = deriveJourney(state);
    expect(journey.phases.slice(0, 3).map((p) => p.status)).toEqual(["done", "done", "done"]);
    expect(journey.current.phase.id).toBe("floorplan");
  });

  it("zeigt Analysieren als dran, solange die Analyse läuft", () => {
    const state = {
      ...emptyJourneyState("p1"),
      videoCount: 1,
      analysisRunning: true,
      analysisJobId: "job-1",
    };
    const journey = deriveJourney(state);
    expect(journey.current.phase.id).toBe("analyze");
    expect(journey.current.cta).toEqual({
      label: "Fortschritt ansehen",
      href: "/projects/p1/analysis?job=job-1",
    });
  });

  it("bietet nach einer gescheiterten Analyse die Neuaufnahme an", () => {
    const state = { ...emptyJourneyState("p1"), videoCount: 1, analysisFailed: true };
    const journey = deriveJourney(state);
    expect(journey.current.phase.id).toBe("analyze");
    expect(journey.current.cta?.label).toBe("Neu aufnehmen");
  });

  it("zählt bestätigte Räume und schaltet erst danach zum Einrichten", () => {
    const state = {
      ...emptyJourneyState("p1"),
      hasPlan: true,
      rooms: [...rooms(2, { confirmed: true }), ...rooms(1)],
    };
    const journey = deriveJourney(state);
    expect(journey.current.phase.id).toBe("floorplan");
    const confirm = journey.current.substeps.find((s) => s.sub.key === "confirm")!;
    expect(confirm.done).toBe(false);
    expect(confirm.progress).toBe("2 von 3 Räumen bestätigt");

    state.rooms = rooms(3, { confirmed: true });
    expect(deriveJourney(state).current.phase.id).toBe("design");
  });

  it("führt beim Einrichten zum ersten Raum ohne Favorit", () => {
    const state = {
      ...emptyJourneyState("p1"),
      hasPlan: true,
      rooms: [
        { id: "a", name: "Gang", confirmed: true, hasProposals: true, hasFavorite: true },
        { id: "b", name: "Küche", confirmed: true, hasProposals: true, hasFavorite: false },
        { id: "c", name: "Bad", confirmed: true, hasProposals: false, hasFavorite: false },
      ],
    };
    const journey = deriveJourney(state);
    expect(journey.current.phase.id).toBe("design");
    expect(journey.current.cta).toEqual({
      label: "Küche einrichten",
      href: "/projects/p1/rooms/b/design",
    });
    const favorite = journey.current.substeps.find((s) => s.sub.key === "favorite")!;
    expect(favorite.progress).toBe("1 von 3 Räumen mit Favorit");
  });

  it("endet mit Erleben, das nur der Nutzer abhaken kann", () => {
    const state = {
      ...emptyJourneyState("p1"),
      hasPlan: true,
      hasGlobalStyle: true,
      rooms: rooms(2, { confirmed: true, hasProposals: true, hasFavorite: true }),
    };
    let journey = deriveJourney(state);
    expect(journey.current.phase.id).toBe("experience");
    expect(journey.current.status).toBe("current");
    expect(journey.completion).toBe(5 / 6);

    state.checks = Object.fromEntries(
      PHASES[5].substeps.map((sub) => [`experience.${sub.key}`, true]),
    );
    journey = deriveJourney(state);
    expect(journey.current.status).toBe("done");
    expect(journey.completion).toBe(1);
    expect(nextStepLabel(journey)).toBe("Alles erledigt");
  });

  it("merkt sich manuelle Haken getrennt von erkannten Schritten", () => {
    const state = { ...emptyJourneyState("p1"), checks: { "record.guide": true } };
    const journey = deriveJourney(state);
    const record = journey.phases[1];
    const guide = record.substeps.find((s) => s.sub.key === "guide")!;
    expect(guide.done).toBe(true);
    expect(guide.manual).toBe(true);
    const stop = record.substeps.find((s) => s.sub.key === "stop")!;
    expect(stop.done).toBe(false);
  });
});

describe("Leitfaden aus dem Projekt", () => {
  const baseProject = {
    id: "p1",
    globalStyle: "  ",
    journeyChecks: null,
    videos: [],
    jobs: [],
    floorPlan: null,
  };

  it("liest Bestätigung und Favoriten aus Grundriss und Vorschlägen", () => {
    const state = journeyStateFromProject(
      {
        ...baseProject,
        globalStyle: "Japandi",
        videos: [{ id: "v1" }],
        floorPlan: {
          data: JSON.stringify({
            unit: "cm",
            rooms: [
              { id: "gang", name: "Gang", type: "hallway", polygon: [], ceilingHeightCm: 250, confidence: 1 },
              { id: "bad", name: "Bad", type: "bathroom", polygon: [], ceilingHeightCm: 250, confidence: 0.6 },
            ],
            openings: [],
            meta: { source: "ai", confidence: 0.7 },
          }),
          rooms: [
            { id: "db-gang", key: "gang", name: "Gang", proposals: [{ isFavorite: true }] },
            { id: "db-bad", key: "bad", name: "Bad", proposals: [{ isFavorite: false }] },
          ],
        },
      },
      "claude",
    );
    expect(state.hasGlobalStyle).toBe(true);
    expect(state.videoCount).toBe(1);
    expect(state.rooms).toEqual([
      { id: "db-gang", name: "Gang", confirmed: true, hasProposals: true, hasFavorite: true },
      { id: "db-bad", name: "Bad", confirmed: false, hasProposals: true, hasFavorite: false },
    ]);
    expect(state.provider).toBe("claude");
  });

  it("erkennt laufende und gescheiterte Analysen am jüngsten Job", () => {
    const failed = journeyStateFromProject(
      {
        ...baseProject,
        videos: [{ id: "v1" }],
        jobs: [
          { id: "old", type: "analysis", status: "succeeded", createdAt: "2026-01-01T00:00:00Z" },
          { id: "new", type: "analysis", status: "failed", createdAt: "2026-01-02T00:00:00Z" },
        ],
      },
      "demo",
    );
    expect(failed.analysisFailed).toBe(true);
    expect(failed.analysisRunning).toBe(false);
    expect(failed.analysisJobId).toBe("new");

    const running = journeyStateFromProject(
      {
        ...baseProject,
        jobs: [{ id: "j", type: "analysis", status: "running", createdAt: new Date() }],
      },
      "demo",
    );
    expect(running.analysisRunning).toBe(true);
  });

  it("übersteht kaputte oder fremde Haken-Daten", () => {
    expect(parseChecks(null)).toEqual({});
    expect(parseChecks("nicht json")).toEqual({});
    expect(parseChecks('{"a":true,"b":false,"c":"ja"}')).toEqual({ a: true });
  });
});
