// Plausibilisierung von Möbelplatzierungen: Möbel werden in den Raum
// "geklemmt" (Bounding-Box des gedrehten Grundrisses bleibt im Raum) und
// Kollisionen mit Türöffnungen werden als Hinweise gemeldet.

import type { FloorPlanDoc, FurnitureItem, RoomShape, Vec2 } from "@/lib/types";
import {
  openingWorldSegment,
  pointInPolygon,
  polygonBounds,
} from "@/lib/geometry/floorplan";

/** Halbe Ausdehnung der gedrehten Möbel-Grundfläche entlang X/Y (Welt). */
export function rotatedHalfExtents(item: Pick<FurnitureItem, "wCm" | "dCm" | "rotationDeg">): Vec2 {
  const rad = (item.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return [(item.wCm * cos + item.dCm * sin) / 2, (item.wCm * sin + item.dCm * cos) / 2];
}

const WALL_MARGIN_CM = 2;

/**
 * Klemmt ein Möbelstück in die Bounding-Box des Raums und prüft anschließend,
 * ob der Mittelpunkt im Raumpolygon liegt. Liegt er außerhalb (z. B. bei
 * L-förmigen Räumen), wird das Möbelstück Richtung Polygon-Schwerpunkt gezogen.
 */
export function clampFurnitureIntoRoom(item: FurnitureItem, room: RoomShape): FurnitureItem {
  const bounds = polygonBounds([room.polygon]);
  const [hx, hy] = rotatedHalfExtents(item);

  const clampX = (x: number) =>
    Math.min(Math.max(x, bounds.minX + hx + WALL_MARGIN_CM), bounds.maxX - hx - WALL_MARGIN_CM);
  const clampY = (y: number) =>
    Math.min(Math.max(y, bounds.minY + hy + WALL_MARGIN_CM), bounds.maxY - hy - WALL_MARGIN_CM);

  // Wenn das Möbelstück breiter/tiefer als der Raum ist: verkleinern statt aufgeben.
  const maxW = Math.max(20, bounds.width - 2 * WALL_MARGIN_CM);
  const maxD = Math.max(20, bounds.height - 2 * WALL_MARGIN_CM);
  let wCm = item.wCm;
  let dCm = item.dCm;
  if (2 * hx > bounds.width) wCm = Math.min(wCm, maxW);
  if (2 * hy > bounds.height) dCm = Math.min(dCm, maxD);

  let next: FurnitureItem = { ...item, wCm, dCm, x: clampX(item.x), y: clampY(item.y) };

  if (!pointInPolygon([next.x, next.y], room.polygon)) {
    // Schrittweise zum Schwerpunkt ziehen, bis der Mittelpunkt im Polygon liegt.
    const bx = (bounds.minX + bounds.maxX) / 2;
    const by = (bounds.minY + bounds.maxY) / 2;
    for (let t = 0.1; t <= 1; t += 0.1) {
      const x = next.x + (bx - next.x) * t;
      const y = next.y + (by - next.y) * t;
      if (pointInPolygon([x, y], room.polygon)) {
        next = { ...next, x: clampX(x), y: clampY(y) };
        break;
      }
    }
  }
  return next;
}

export interface FitIssue {
  itemId: string;
  message: string;
}

/** Türnähe prüfen: Möbel, die eine Türöffnung blockieren, werden gemeldet. */
export function checkDoorClearance(
  items: FurnitureItem[],
  room: RoomShape,
  doc: FloorPlanDoc,
  clearanceCm = 70,
): FitIssue[] {
  const issues: FitIssue[] = [];
  const doorSegments = doc.openings
    .filter((o) => o.kind !== "window")
    .map((o) => openingWorldSegment(doc, o))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  for (const item of items) {
    if (item.kind === "rug") continue; // Teppiche dürfen vor Türen liegen
    const [hx, hy] = rotatedHalfExtents(item);
    for (const segment of doorSegments) {
      const mx = (segment.a[0] + segment.b[0]) / 2;
      const my = (segment.a[1] + segment.b[1]) / 2;
      const dx = Math.max(Math.abs(item.x - mx) - hx, 0);
      const dy = Math.max(Math.abs(item.y - my) - hy, 0);
      if (Math.hypot(dx, dy) < clearanceCm) {
        issues.push({
          itemId: item.id,
          message: `„${item.label}" steht möglicherweise im Schwenkbereich einer Tür.`,
        });
        break;
      }
    }
  }
  return issues;
}

/** Kompletter Fit-Durchlauf für einen Vorschlag. */
export function fitFurniture(
  items: FurnitureItem[],
  room: RoomShape,
  doc: FloorPlanDoc,
): { items: FurnitureItem[]; issues: FitIssue[] } {
  const fitted = items.map((item) => clampFurnitureIntoRoom(item, room));
  return { items: fitted, issues: checkDoorClearance(fitted, room, doc) };
}
