import { describe, expect, it } from "vitest";
import {
  insertVertex,
  openingMidpoints,
  openingWorldSegment,
  reattachOpenings,
  removeVertex,
  rect,
  validateFloorPlan,
} from "@/lib/geometry/floorplan";
import type { FloorPlanDoc } from "@/lib/types";

function docWithDoorAndWindow(): FloorPlanDoc {
  return {
    unit: "cm",
    rooms: [
      {
        id: "r1",
        name: "Raum",
        type: "living",
        polygon: rect(0, 0, 400, 300),
        ceilingHeightCm: 250,
        confidence: 1,
      },
    ],
    openings: [
      // Tür auf der Oberkante (Kante 0)
      { id: "tuer", kind: "door", wall: { roomId: "r1", edgeIndex: 0 }, offsetCm: 100, widthCm: 90, heightCm: 200 },
      // Fenster auf der rechten Kante (Kante 1)
      { id: "fenster", kind: "window", wall: { roomId: "r1", edgeIndex: 1 }, offsetCm: 100, widthCm: 80, heightCm: 130, sillCm: 90 },
    ],
    meta: { source: "manual", confidence: 1 },
  };
}

describe("Ecken einfügen und entfernen", () => {
  it("fügt eine Ecke auf der Kantenmitte ein", () => {
    const polygon = rect(0, 0, 400, 300);
    const next = insertVertex(polygon, 0);
    expect(next).toHaveLength(5);
    expect(next[1]).toEqual([200, 0]);
    // die übrigen Ecken bleiben erhalten
    expect(next[0]).toEqual(polygon[0]);
    expect(next[2]).toEqual(polygon[1]);
  });

  it("entfernt eine Ecke, aber nie unter drei", () => {
    const polygon = insertVertex(rect(0, 0, 400, 300), 0);
    expect(removeVertex(polygon, 1)).toHaveLength(4);
    const triangle: [number, number][] = [[0, 0], [100, 0], [50, 80]];
    expect(removeVertex(triangle, 0)).toHaveLength(3);
  });

  it("erlaubt einen L-förmigen Raum", () => {
    const doc = docWithDoorAndWindow();
    const room = doc.rooms[0];
    // Ecke einfügen und nach innen ziehen → L-Form
    room.polygon = insertVertex(room.polygon, 1);
    room.polygon[2] = [250, 150];
    room.polygon[3] = [400, 150] as never;
    expect(validateFloorPlan(doc).filter((i) => i.level === "error")).toEqual([]);
  });
});

describe("Öffnungen nach Formänderung neu anheften", () => {
  it("hält Tür und Fenster an ihrer Wand, obwohl sich die Indizes verschieben", () => {
    const doc = docWithDoorAndWindow();
    const before = openingMidpoints(doc, "r1");
    const doorBefore = openingWorldSegment(doc, doc.openings[0])!;
    const windowBefore = openingWorldSegment(doc, doc.openings[1])!;

    // Ecke auf Kante 0 einfügen: alle folgenden Kantenindizes verschieben sich um 1
    doc.rooms[0].polygon = insertVertex(doc.rooms[0].polygon, 0);
    const after = reattachOpenings(doc, "r1", before);

    const door = after.openings.find((o) => o.id === "tuer")!;
    const window = after.openings.find((o) => o.id === "fenster")!;

    // Das Fenster muss der verschobenen Kante folgen (1 -> 2)
    expect(window.wall.edgeIndex).toBe(2);

    // Entscheidend: die Öffnungen liegen weltweit noch an derselben Stelle
    const doorAfter = openingWorldSegment(after, door)!;
    const windowAfter = openingWorldSegment(after, window)!;
    expect(doorAfter.a[0]).toBeCloseTo(doorBefore.a[0], 1);
    expect(doorAfter.a[1]).toBeCloseTo(doorBefore.a[1], 1);
    expect(windowAfter.a[0]).toBeCloseTo(windowBefore.a[0], 1);
    expect(windowAfter.a[1]).toBeCloseTo(windowBefore.a[1], 1);
  });

  it("überlebt auch das Entfernen einer Ecke", () => {
    const doc = docWithDoorAndWindow();
    doc.rooms[0].polygon = insertVertex(doc.rooms[0].polygon, 2);
    const before = openingMidpoints(doc, "r1");
    const doorBefore = openingWorldSegment(doc, doc.openings[0])!;

    doc.rooms[0].polygon = removeVertex(doc.rooms[0].polygon, 3);
    const after = reattachOpenings(doc, "r1", before);

    const doorAfter = openingWorldSegment(after, after.openings[0])!;
    expect(doorAfter.a[0]).toBeCloseTo(doorBefore.a[0], 1);
    expect(validateFloorPlan(after).filter((i) => i.level === "error")).toEqual([]);
  });
});
