import { describe, expect, it } from "vitest";
import { layoutFloorPlan, type EstimatedRoom } from "@/lib/geometry/layout";
import { validateFloorPlan } from "@/lib/geometry/floorplan";

const rooms: EstimatedRoom[] = [
  {
    key: "flur",
    name: "Flur",
    type: "hallway",
    widthCm: 150,
    depthCm: 500,
    ceilingHeightCm: 250,
    confidence: 0.7,
    windowCount: 0,
    connections: [
      { roomKey: "wohnen", kind: "door" },
      { roomKey: "bad", kind: "door" },
    ],
  },
  {
    key: "wohnen",
    name: "Wohnzimmer",
    type: "living",
    widthCm: 400,
    depthCm: 380,
    ceilingHeightCm: 250,
    confidence: 0.7,
    windowCount: 2,
    connections: [],
  },
  {
    key: "bad",
    name: "Bad",
    type: "bathroom",
    widthCm: 220,
    depthCm: 200,
    ceilingHeightCm: 250,
    confidence: 0.6,
    windowCount: 1,
    connections: [],
  },
];

describe("Auto-Layout", () => {
  it("platziert alle Räume überlappungsfrei", () => {
    const doc = layoutFloorPlan(rooms, { confidence: 0.7 });
    expect(doc.rooms).toHaveLength(3);
    const errors = validateFloorPlan(doc).filter((issue) => issue.level === "error");
    expect(errors).toEqual([]);
  });

  it("erzeugt Türen für Verbindungen", () => {
    const doc = layoutFloorPlan(rooms, { confidence: 0.7 });
    const doors = doc.openings.filter((opening) => opening.kind === "door");
    expect(doors.length).toBe(2);
    // Türen liegen innerhalb ihrer Kante
    for (const door of doors) {
      expect(door.offsetCm).toBeGreaterThanOrEqual(0);
      expect(door.widthCm).toBeGreaterThan(0);
    }
  });

  it("verteilt Fenster auf Außenwände", () => {
    const doc = layoutFloorPlan(rooms, { confidence: 0.7 });
    const windows = doc.openings.filter((opening) => opening.kind === "window");
    expect(windows.length).toBeGreaterThanOrEqual(2);
  });

  it("übersteht leere Eingaben", () => {
    const doc = layoutFloorPlan([], { confidence: 0.5 });
    expect(doc.rooms).toEqual([]);
  });
});
