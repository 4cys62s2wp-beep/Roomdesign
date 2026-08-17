import { describe, expect, it } from "vitest";
import { demoFloorPlan, demoProposalsForRoom } from "@/lib/demo/fixtures";
import { polygonBounds, roomAreaM2, validateFloorPlan } from "@/lib/geometry/floorplan";
import { rotatedHalfExtents } from "@/lib/geometry/furniture-fit";

describe("Demo-Wohnung", () => {
  const doc = demoFloorPlan();

  it("entspricht der beschriebenen Topologie", () => {
    const ids = doc.rooms.map((room) => room.id).sort();
    expect(ids).toEqual(["bad", "gang", "kueche", "schlafzimmer", "wohnzimmer"].sort());
    // Gang → Bad, Gang → Wohnzimmer, Wohnzimmer → Küche, Wohnzimmer → Schlafzimmer
    const pair = (a: string, b: string) =>
      doc.openings.some(
        (o) =>
          o.kind !== "window" &&
          ((o.wall.roomId === a && o.roomB === b) || (o.wall.roomId === b && o.roomB === a)),
      );
    expect(pair("gang", "bad")).toBe(true);
    expect(pair("gang", "wohnzimmer")).toBe(true);
    expect(pair("kueche", "wohnzimmer")).toBe(true);
    expect(pair("schlafzimmer", "wohnzimmer")).toBe(true);
  });

  it("ist geometrisch fehlerfrei", () => {
    const errors = validateFloorPlan(doc).filter((issue) => issue.level === "error");
    expect(errors).toEqual([]);
  });

  it("hat plausible Flächen (Gesamt ~50 m²)", () => {
    const total = doc.rooms.reduce((sum, room) => sum + roomAreaM2(room), 0);
    expect(total).toBeGreaterThan(40);
    expect(total).toBeLessThan(65);
  });

  it("jeder Raum hat mindestens ein Fenster oder eine Tür", () => {
    for (const room of doc.rooms) {
      const touching = doc.openings.filter(
        (o) => o.wall.roomId === room.id || o.roomB === room.id,
      );
      expect(touching.length, room.id).toBeGreaterThan(0);
    }
  });
});

describe("Demo-Vorschläge", () => {
  const doc = demoFloorPlan();

  it("liefert die gewünschte Anzahl", () => {
    const room = doc.rooms.find((r) => r.id === "wohnzimmer")!;
    expect(demoProposalsForRoom(room, 1)).toHaveLength(1);
    expect(demoProposalsForRoom(room, 3)).toHaveLength(3);
  });

  it("platziert alle Möbel innerhalb der Raum-Bounding-Box", () => {
    for (const room of doc.rooms) {
      const bounds = polygonBounds([room.polygon]);
      const proposals = demoProposalsForRoom(room, 2);
      for (const proposal of proposals) {
        for (const item of proposal.furniture) {
          const [hx, hy] = rotatedHalfExtents(item);
          expect(item.x - hx, `${room.id}/${item.id} links`).toBeGreaterThanOrEqual(bounds.minX - 1);
          expect(item.x + hx, `${room.id}/${item.id} rechts`).toBeLessThanOrEqual(bounds.maxX + 1);
          expect(item.y - hy, `${room.id}/${item.id} oben`).toBeGreaterThanOrEqual(bounds.minY - 1);
          expect(item.y + hy, `${room.id}/${item.id} unten`).toBeLessThanOrEqual(bounds.maxY + 1);
        }
      }
    }
  });

  it("Budget = Möbel + Leuchten", () => {
    const room = doc.rooms.find((r) => r.id === "schlafzimmer")!;
    const [proposal] = demoProposalsForRoom(room, 1);
    const furniture = proposal.furniture.reduce((sum, item) => sum + item.estPriceEur, 0);
    const lighting = proposal.lighting.reduce((sum, light) => sum + (light.estPriceEur ?? 0), 0);
    expect(proposal.budget.totalEur).toBe(furniture + lighting);
  });

  it("Feedback-Refine markiert den Vorschlag als überarbeitet", () => {
    const room = doc.rooms.find((r) => r.id === "kueche")!;
    const [proposal] = demoProposalsForRoom(room, 1, { feedback: "mehr Holz" });
    expect(proposal.title).toContain("überarbeitet");
    expect(proposal.concept).toContain("mehr Holz");
  });
});
