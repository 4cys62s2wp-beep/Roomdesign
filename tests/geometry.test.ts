import { describe, expect, it } from "vitest";
import {
  clampOpeningToEdge,
  normalizeDoc,
  openingWorldSegment,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  rect,
  roomAreaM2,
  roomEdge,
  validateFloorPlan,
} from "@/lib/geometry/floorplan";
import { buildWalls } from "@/lib/geometry/walls";
import type { FloorPlanDoc, RoomShape } from "@/lib/types";

const squareRoom: RoomShape = {
  id: "r1",
  name: "Testraum",
  type: "living",
  polygon: rect(0, 0, 400, 300),
  ceilingHeightCm: 250,
  confidence: 1,
};

function docWith(openings: FloorPlanDoc["openings"]): FloorPlanDoc {
  return { unit: "cm", rooms: [squareRoom], openings, meta: { source: "manual", confidence: 1 } };
}

describe("Polygon-Geometrie", () => {
  it("berechnet Fläche und m² korrekt", () => {
    expect(polygonArea(squareRoom.polygon)).toBe(400 * 300);
    expect(roomAreaM2(squareRoom)).toBeCloseTo(12);
  });

  it("berechnet den Schwerpunkt eines Rechtecks", () => {
    const [cx, cy] = polygonCentroid(squareRoom.polygon);
    expect(cx).toBeCloseTo(200);
    expect(cy).toBeCloseTo(150);
  });

  it("erkennt Punkte im Polygon", () => {
    expect(pointInPolygon([200, 150], squareRoom.polygon)).toBe(true);
    expect(pointInPolygon([500, 150], squareRoom.polygon)).toBe(false);
  });

  it("liefert Kanten mit Länge und Richtung", () => {
    const edge = roomEdge(squareRoom, 0);
    expect(edge.length).toBe(400);
    expect(edge.dir).toEqual([1, 0]);
  });

  it("verschiebt Grundrisse auf den Ursprung", () => {
    const doc: FloorPlanDoc = {
      unit: "cm",
      rooms: [{ ...squareRoom, polygon: rect(-100, -50, 400, 300) }],
      openings: [],
      meta: { source: "manual", confidence: 1 },
    };
    const normalized = normalizeDoc(doc, 40);
    expect(normalized.rooms[0].polygon[0]).toEqual([40, 40]);
  });
});

describe("Öffnungen", () => {
  it("berechnet das Weltsegment einer Öffnung", () => {
    const doc = docWith([
      {
        id: "o1",
        kind: "door",
        wall: { roomId: "r1", edgeIndex: 0 },
        offsetCm: 100,
        widthCm: 90,
        heightCm: 200,
      },
    ]);
    const segment = openingWorldSegment(doc, doc.openings[0]);
    expect(segment).not.toBeNull();
    expect(segment!.a).toEqual([100, 0]);
    expect(segment!.b).toEqual([190, 0]);
  });

  it("klemmt Öffnungen auf die Kantenlänge", () => {
    const doc = docWith([
      {
        id: "o1",
        kind: "door",
        wall: { roomId: "r1", edgeIndex: 0 },
        offsetCm: 380,
        widthCm: 90,
        heightCm: 200,
      },
    ]);
    const clamped = clampOpeningToEdge(doc, doc.openings[0]);
    expect(clamped.offsetCm + clamped.widthCm).toBeLessThanOrEqual(400);
  });
});

describe("Wand-Erzeugung (3D)", () => {
  it("volle Wand ohne Öffnung = ein Stück in voller Höhe", () => {
    const walls = buildWalls(docWith([]));
    const top = walls.find((wall) => wall.roomId === "r1" && wall.edgeIndex === 0)!;
    expect(top.pieces).toHaveLength(1);
    expect(top.pieces[0]).toMatchObject({ start: 0, end: 400, z0: 0, z1: 250 });
  });

  it("Tür schneidet Lücke mit Sturz darüber", () => {
    const doc = docWith([
      {
        id: "door",
        kind: "door",
        wall: { roomId: "r1", edgeIndex: 0 },
        offsetCm: 100,
        widthCm: 90,
        heightCm: 200,
      },
    ]);
    const top = buildWalls(doc).find((wall) => wall.roomId === "r1" && wall.edgeIndex === 0)!;
    // Erwartet: Wand links, Sturz über der Tür, Wand rechts
    const lintel = top.pieces.find((piece) => piece.z0 === 200 && piece.start === 100);
    expect(lintel).toBeDefined();
    expect(lintel!.end).toBe(190);
    const gap = top.pieces.find(
      (piece) => piece.start >= 100 && piece.end <= 190 && piece.z0 === 0,
    );
    expect(gap).toBeUndefined();
  });

  it("Fenster erzeugt Brüstung und Sturz", () => {
    const doc = docWith([
      {
        id: "win",
        kind: "window",
        wall: { roomId: "r1", edgeIndex: 0 },
        offsetCm: 150,
        widthCm: 100,
        heightCm: 120,
        sillCm: 90,
      },
    ]);
    const top = buildWalls(doc).find((wall) => wall.roomId === "r1" && wall.edgeIndex === 0)!;
    const sill = top.pieces.find((piece) => piece.start === 150 && piece.z0 === 0);
    expect(sill).toBeDefined();
    expect(sill!.z1).toBe(90);
    const lintel = top.pieces.find((piece) => piece.start === 150 && piece.z0 === 210);
    expect(lintel).toBeDefined();
    expect(lintel!.z1).toBe(250);
  });
});

describe("Validierung", () => {
  it("meldet Fehler bei kaputten Referenzen", () => {
    const doc = docWith([
      {
        id: "o1",
        kind: "door",
        wall: { roomId: "gibtsnicht", edgeIndex: 0 },
        offsetCm: 0,
        widthCm: 90,
        heightCm: 200,
      },
    ]);
    const issues = validateFloorPlan(doc);
    expect(issues.some((issue) => issue.level === "error")).toBe(true);
  });
});
