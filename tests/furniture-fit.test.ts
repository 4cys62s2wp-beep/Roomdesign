import { describe, expect, it } from "vitest";
import {
  checkDoorClearance,
  clampFurnitureIntoRoom,
  rotatedHalfExtents,
} from "@/lib/geometry/furniture-fit";
import { rect } from "@/lib/geometry/floorplan";
import type { FloorPlanDoc, FurnitureItem, RoomShape } from "@/lib/types";

const room: RoomShape = {
  id: "r1",
  name: "Raum",
  type: "living",
  polygon: rect(0, 0, 400, 300),
  ceilingHeightCm: 250,
  confidence: 1,
};

function item(overrides: Partial<FurnitureItem>): FurnitureItem {
  return {
    id: "f1",
    kind: "sofa",
    label: "Sofa",
    wCm: 200,
    dCm: 90,
    hCm: 80,
    x: 200,
    y: 150,
    rotationDeg: 0,
    colorHex: "#AAAAAA",
    estPriceEur: 100,
    ...overrides,
  };
}

describe("rotatedHalfExtents", () => {
  it("berücksichtigt die Drehung", () => {
    expect(rotatedHalfExtents(item({ rotationDeg: 0 }))).toEqual([100, 45]);
    const [hx, hy] = rotatedHalfExtents(item({ rotationDeg: 90 }));
    expect(hx).toBeCloseTo(45);
    expect(hy).toBeCloseTo(100);
  });
});

describe("clampFurnitureIntoRoom", () => {
  it("lässt passende Möbel unverändert", () => {
    const fitted = clampFurnitureIntoRoom(item({}), room);
    expect(fitted.x).toBe(200);
    expect(fitted.y).toBe(150);
  });

  it("schiebt Möbel in den Raum zurück", () => {
    const fitted = clampFurnitureIntoRoom(item({ x: 390, y: 290 }), room);
    expect(fitted.x + rotatedHalfExtents(fitted)[0]).toBeLessThanOrEqual(400);
    expect(fitted.y + rotatedHalfExtents(fitted)[1]).toBeLessThanOrEqual(300);
  });

  it("verkleinert Möbel, die größer als der Raum sind", () => {
    const fitted = clampFurnitureIntoRoom(item({ wCm: 800 }), room);
    expect(fitted.wCm).toBeLessThanOrEqual(400);
  });
});

describe("checkDoorClearance", () => {
  const doc: FloorPlanDoc = {
    unit: "cm",
    rooms: [room],
    openings: [
      {
        id: "door",
        kind: "door",
        wall: { roomId: "r1", edgeIndex: 0 },
        offsetCm: 150,
        widthCm: 90,
        heightCm: 200,
      },
    ],
    meta: { source: "manual", confidence: 1 },
  };

  it("meldet Möbel im Türschwenkbereich", () => {
    const blocking = item({ x: 195, y: 40 });
    const issues = checkDoorClearance([blocking], room, doc);
    expect(issues).toHaveLength(1);
  });

  it("ignoriert Teppiche und entfernte Möbel", () => {
    const rug = item({ kind: "rug", x: 195, y: 40 });
    const far = item({ id: "f2", x: 200, y: 250 });
    expect(checkDoorClearance([rug, far], room, doc)).toEqual([]);
  });
});
