import { describe, expect, it } from "vitest";
import { BODY_RADIUS_CM, isWalkable, resolveMove, walkStartPoint } from "@/lib/geometry/walk";
import { demoFloorPlan } from "@/lib/demo/fixtures";
import { openingWorldSegment, polygonBounds } from "@/lib/geometry/floorplan";
import type { Vec2 } from "@/lib/types";

const doc = demoFloorPlan();

function centerOf(roomId: string): Vec2 {
  const room = doc.rooms.find((r) => r.id === roomId)!;
  const b = polygonBounds([room.polygon]);
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
}

describe("Begehbarkeit", () => {
  it("erlaubt die Raummitte in jedem Raum", () => {
    for (const room of doc.rooms) {
      expect(isWalkable(doc, centerOf(room.id)), room.id).toBe(true);
    }
  });

  it("blockiert außerhalb der Wohnung", () => {
    expect(isWalkable(doc, [-500, -500])).toBe(false);
    expect(isWalkable(doc, [5000, 5000])).toBe(false);
  });

  it("blockiert direkt in der Wand", () => {
    // Westwand des Bads: dort sitzt keine Öffnung
    const room = doc.rooms.find((r) => r.id === "bad")!;
    const b = polygonBounds([room.polygon]);
    const inWall: Vec2 = [b.minX + BODY_RADIUS_CM / 3, (b.minY + b.maxY) / 2];
    expect(isWalkable(doc, inWall)).toBe(false);
  });

  it("lässt Türen und Durchgänge passieren", () => {
    for (const opening of doc.openings.filter((o) => o.kind !== "window")) {
      const segment = openingWorldSegment(doc, opening)!;
      const middle: Vec2 = [
        (segment.a[0] + segment.b[0]) / 2,
        (segment.a[1] + segment.b[1]) / 2,
      ];
      expect(isWalkable(doc, middle), opening.id).toBe(true);
    }
  });

  it("lässt einen nicht durch die Wohnungstür nach draußen", () => {
    const front = doc.openings.find((o) => o.id === "tuer-eingang")!;
    const segment = openingWorldSegment(doc, front)!;
    const inDoorway: Vec2 = [
      (segment.a[0] + segment.b[0]) / 2,
      (segment.a[1] + segment.b[1]) / 2,
    ];
    // In der Türöffnung stehen ist erlaubt …
    expect(isWalkable(doc, inDoorway)).toBe(true);
    // … einen Schritt weiter nach draußen aber nicht
    const outside: Vec2 = [inDoorway[0], inDoorway[1] + 60];
    expect(isWalkable(doc, outside)).toBe(false);
    expect(resolveMove(doc, inDoorway, outside)).toEqual(inDoorway);
  });

  it("lässt Fenster NICHT passieren", () => {
    const window = doc.openings.find((o) => o.id === "fenster-schlafzimmer")!;
    const segment = openingWorldSegment(doc, window)!;
    // ein Stück außerhalb der Fensterwand
    const outside: Vec2 = [(segment.a[0] + segment.b[0]) / 2, segment.a[1] + 40];
    expect(isWalkable(doc, outside)).toBe(false);
  });
});

describe("Bewegung auflösen", () => {
  it("lässt freie Bewegung unverändert", () => {
    const from = centerOf("wohnzimmer");
    const to: Vec2 = [from[0] + 10, from[1] + 10];
    expect(resolveMove(doc, from, to)).toEqual(to);
  });

  it("gleitet an der Wand entlang statt zu blockieren", () => {
    const room = doc.rooms.find((r) => r.id === "wohnzimmer")!;
    const b = polygonBounds([room.polygon]);
    // dicht an der Westwand, Bewegung schräg nach außen und nach unten
    const from: Vec2 = [b.minX + BODY_RADIUS_CM + 4, (b.minY + b.maxY) / 2];
    const to: Vec2 = [b.minX - 30, from[1] + 25];
    const result = resolveMove(doc, from, to);
    expect(result).not.toEqual(to);          // nicht durch die Wand
    expect(result[1]).toBeCloseTo(to[1], 5); // aber daran entlang
    expect(isWalkable(doc, result)).toBe(true);
  });

  it("hält den Nutzer stehen, wenn gar nichts geht", () => {
    const from = centerOf("bad");
    const to: Vec2 = [-9999, -9999];
    expect(resolveMove(doc, from, to)).toEqual(from);
  });

  it("findet einen begehbaren Startpunkt", () => {
    const start = walkStartPoint(doc)!;
    expect(start).not.toBeNull();
    expect(isWalkable(doc, start)).toBe(true);
  });
});
