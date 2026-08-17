// Geometrie-Grundfunktionen für das Grundriss-Modell (FloorPlanDoc).
// Wird vom SVG-Editor, dem 3D-Renderer und der Analyse-Pipeline gemeinsam genutzt.

import type { FloorPlanDoc, Opening, RoomShape, Vec2 } from "@/lib/types";

export interface Edge {
  a: Vec2;
  b: Vec2;
  length: number;
  /** Einheitsvektor entlang der Kante. */
  dir: Vec2;
}

export function roomEdge(room: RoomShape, edgeIndex: number): Edge {
  const n = room.polygon.length;
  const a = room.polygon[((edgeIndex % n) + n) % n];
  const b = room.polygon[(((edgeIndex + 1) % n) + n) % n];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  return { a, b, length, dir: length > 0 ? [dx / length, dy / length] : [1, 0] };
}

export function roomEdges(room: RoomShape): Edge[] {
  return room.polygon.map((_, i) => roomEdge(room, i));
}

/** Fläche in cm² (Shoelace, vorzeichenlos). */
export function polygonArea(polygon: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function roomAreaM2(room: RoomShape): number {
  return polygonArea(room.polygon) / 10_000;
}

export function polygonCentroid(polygon: Vec2[]): Vec2 {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(area) < 1e-6) {
    // Degeneriert: Mittelwert der Punkte
    const sx = polygon.reduce((s, p) => s + p[0], 0);
    const sy = polygon.reduce((s, p) => s + p[1], 0);
    return [sx / polygon.length, sy / polygon.length];
  }
  return [cx / (3 * area), cy / (3 * area)];
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function polygonBounds(polygons: Vec2[][]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons) {
    for (const [x, y] of polygon) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!isFinite(minX)) {
    minX = minY = maxX = maxY = 0;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function docBounds(doc: FloorPlanDoc): Bounds {
  return polygonBounds(doc.rooms.map((r) => r.polygon));
}

export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Weltkoordinaten des Öffnungs-Segments (Anfang/Ende entlang der Wandkante). */
export function openingWorldSegment(
  doc: FloorPlanDoc,
  opening: Opening,
): { a: Vec2; b: Vec2 } | null {
  const room = doc.rooms.find((r) => r.id === opening.wall.roomId);
  if (!room) return null;
  const edge = roomEdge(room, opening.wall.edgeIndex);
  const start = Math.max(0, Math.min(opening.offsetCm, edge.length));
  const end = Math.max(0, Math.min(opening.offsetCm + opening.widthCm, edge.length));
  return {
    a: [edge.a[0] + edge.dir[0] * start, edge.a[1] + edge.dir[1] * start],
    b: [edge.a[0] + edge.dir[0] * end, edge.a[1] + edge.dir[1] * end],
  };
}

/** Projektion eines Punkts auf eine Kante: Parameter t in cm entlang der Kante + Abstand. */
export function projectOnEdge(edge: Edge, point: Vec2): { t: number; dist: number } {
  const [ax, ay] = edge.a;
  const t = (point[0] - ax) * edge.dir[0] + (point[1] - ay) * edge.dir[1];
  const px = ax + edge.dir[0] * t;
  const py = ay + edge.dir[1] * t;
  return { t, dist: Math.hypot(point[0] - px, point[1] - py) };
}

/** Begrenzt offsetCm/widthCm einer Öffnung auf die Länge ihrer Kante. */
export function clampOpeningToEdge(doc: FloorPlanDoc, opening: Opening): Opening {
  const room = doc.rooms.find((r) => r.id === opening.wall.roomId);
  if (!room) return opening;
  const edge = roomEdge(room, opening.wall.edgeIndex);
  const width = Math.max(20, Math.min(opening.widthCm, edge.length));
  const offset = Math.max(0, Math.min(opening.offsetCm, edge.length - width));
  return { ...opening, offsetCm: offset, widthCm: width };
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  roomId?: string;
  openingId?: string;
}

export function validateFloorPlan(doc: FloorPlanDoc): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roomIds = new Set<string>();
  for (const room of doc.rooms) {
    if (roomIds.has(room.id)) {
      issues.push({ level: "error", message: `Doppelte Raum-ID „${room.id}"`, roomId: room.id });
    }
    roomIds.add(room.id);
    if (room.polygon.length < 3) {
      issues.push({ level: "error", message: `Raum „${room.name}" hat weniger als 3 Ecken`, roomId: room.id });
    }
    if (room.polygon.some(([x, y]) => !isFinite(x) || !isFinite(y))) {
      issues.push({ level: "error", message: `Raum „${room.name}" enthält ungültige Koordinaten`, roomId: room.id });
    }
    if (roomAreaM2(room) < 0.5) {
      issues.push({ level: "warning", message: `Raum „${room.name}" ist kleiner als 0,5 m²`, roomId: room.id });
    }
    if (room.ceilingHeightCm < 180 || room.ceilingHeightCm > 500) {
      issues.push({ level: "warning", message: `Deckenhöhe von „${room.name}" wirkt unplausibel`, roomId: room.id });
    }
  }
  for (const opening of doc.openings) {
    const room = doc.rooms.find((r) => r.id === opening.wall.roomId);
    if (!room) {
      issues.push({ level: "error", message: `Öffnung verweist auf unbekannten Raum`, openingId: opening.id });
      continue;
    }
    if (opening.wall.edgeIndex < 0 || opening.wall.edgeIndex >= room.polygon.length) {
      issues.push({ level: "error", message: `Öffnung verweist auf unbekannte Wandkante`, openingId: opening.id });
      continue;
    }
    const edge = roomEdge(room, opening.wall.edgeIndex);
    if (opening.offsetCm + opening.widthCm > edge.length + 1) {
      issues.push({
        level: "warning",
        message: `Öffnung ragt über die Wand von „${room.name}" hinaus`,
        openingId: opening.id,
      });
    }
    if (opening.roomB && !doc.rooms.some((r) => r.id === opening.roomB)) {
      issues.push({ level: "error", message: `Öffnung verweist auf unbekannten Nachbarraum`, openingId: opening.id });
    }
  }
  return issues;
}

/** Verschiebt den gesamten Grundriss, sodass die linke obere Ecke bei (margin, margin) liegt. */
export function normalizeDoc(doc: FloorPlanDoc, margin = 0): FloorPlanDoc {
  const bounds = docBounds(doc);
  const dx = margin - bounds.minX;
  const dy = margin - bounds.minY;
  if (dx === 0 && dy === 0) return doc;
  return {
    ...doc,
    rooms: doc.rooms.map((room) => ({
      ...room,
      polygon: room.polygon.map(([x, y]) => [x + dx, y + dy] as Vec2),
    })),
  };
}

export function totalAreaM2(doc: FloorPlanDoc): number {
  return doc.rooms.reduce((sum, room) => sum + roomAreaM2(room), 0);
}

/** Achsenparalleles Rechteck als Polygon (im Uhrzeigersinn). */
export function rect(x: number, y: number, w: number, h: number): Vec2[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}
