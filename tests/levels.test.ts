import { describe, expect, it } from "vitest";
import {
  docForLevel,
  docLevels,
  levelBaseCm,
  levelLabel,
  rect,
  roomLevel,
} from "@/lib/geometry/floorplan";
import { demoFloorPlan } from "@/lib/demo/fixtures";
import { SLAB_THICKNESS_CM, type FloorPlanDoc } from "@/lib/types";

function twoLevelDoc(): FloorPlanDoc {
  return {
    unit: "cm",
    rooms: [
      { id: "eg1", name: "Wohnen", type: "living", polygon: rect(0, 0, 400, 300), ceilingHeightCm: 260, confidence: 1 },
      { id: "og1", name: "Schlafen", type: "bedroom", level: 1, polygon: rect(0, 0, 400, 300), ceilingHeightCm: 240, confidence: 1 },
      { id: "og2", name: "Bad", type: "bathroom", level: 1, polygon: rect(400, 0, 200, 200), ceilingHeightCm: 240, confidence: 1 },
    ],
    openings: [
      { id: "t1", kind: "door", wall: { roomId: "eg1", edgeIndex: 2 }, roomB: null, offsetCm: 100, widthCm: 90, heightCm: 200 },
      { id: "t2", kind: "door", wall: { roomId: "og1", edgeIndex: 1 }, roomB: "og2", offsetCm: 50, widthCm: 90, heightCm: 200 },
    ],
    meta: { source: "manual", confidence: 1 },
  };
}

describe("Etagen", () => {
  it("behandelt Grundrisse ohne Etagenangabe als Erdgeschoss", () => {
    const demo = demoFloorPlan();
    expect(demo.rooms.every((room) => roomLevel(room) === 0)).toBe(true);
    expect(docLevels(demo)).toEqual([0]);
  });

  it("findet alle belegten Etagen aufsteigend", () => {
    expect(docLevels(twoLevelDoc())).toEqual([0, 1]);
  });

  it("filtert Räume UND die zugehörigen Öffnungen", () => {
    const doc = twoLevelDoc();
    const eg = docForLevel(doc, 0);
    expect(eg.rooms.map((r) => r.id)).toEqual(["eg1"]);
    expect(eg.openings.map((o) => o.id)).toEqual(["t1"]);

    const og = docForLevel(doc, 1);
    expect(og.rooms.map((r) => r.id)).toEqual(["og1", "og2"]);
    expect(og.openings.map((o) => o.id)).toEqual(["t2"]);
  });

  it("stapelt Etagen anhand der höchsten Deckenhöhe darunter", () => {
    const doc = twoLevelDoc();
    expect(levelBaseCm(doc, 0)).toBe(0);
    // Erdgeschoss: 260 cm Decke + Geschossdecke
    expect(levelBaseCm(doc, 1)).toBe(260 + SLAB_THICKNESS_CM);
  });

  it("benennt Etagen verständlich", () => {
    expect(levelLabel(0)).toBe("Erdgeschoss");
    expect(levelLabel(1)).toBe("1. Obergeschoss");
    expect(levelLabel(2)).toBe("2. Obergeschoss");
    expect(levelLabel(-1)).toBe("Untergeschoss");
  });

  it("liefert für eine leere Etage einen leeren Grundriss statt eines Fehlers", () => {
    const empty = docForLevel(twoLevelDoc(), 5);
    expect(empty.rooms).toEqual([]);
    expect(empty.openings).toEqual([]);
  });
});
