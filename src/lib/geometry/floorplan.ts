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

/** Kürzester Abstand eines Punkts zu einer Strecke. */
export function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-9) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  let t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t));
}

/**
 * Öffnungen eines Raums nach einer Formänderung neu anheften.
 *
 * Türen und Fenster verweisen über einen Kantenindex auf ihre Wand. Sobald
 * Ecken eingefügt oder gelöscht werden, verschieben sich diese Indizes — ein
 * bloßes Umrechnen wäre fehleranfällig. Stattdessen werden die Öffnungen
 * anhand ihrer Weltposition (Mittelpunkt vor der Änderung) auf die jetzt
 * nächstgelegene Kante gesetzt.
 */
export function reattachOpenings(
  doc: FloorPlanDoc,
  roomId: string,
  midpointsBefore: Map<string, Vec2>,
): FloorPlanDoc {
  const room = doc.rooms.find((r) => r.id === roomId);
  if (!room) return doc;

  const openings = doc.openings.map((opening) => {
    if (opening.wall.roomId !== roomId) return opening;
    const midpoint = midpointsBefore.get(opening.id);
    if (!midpoint) return opening;

    let bestEdge = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < room.polygon.length; index++) {
      const edge = roomEdge(room, index);
      const distance = distanceToSegment(midpoint, edge.a, edge.b);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestEdge = index;
      }
    }

    const edge = roomEdge(room, bestEdge);
    const { t } = projectOnEdge(edge, midpoint);
    return clampOpeningToEdge(doc, {
      ...opening,
      wall: { roomId, edgeIndex: bestEdge },
      offsetCm: t - opening.widthCm / 2,
    });
  });

  return { ...doc, openings };
}

/** Mittelpunkte aller Öffnungen eines Raums (für reattachOpenings). */
export function openingMidpoints(doc: FloorPlanDoc, roomId: string): Map<string, Vec2> {
  const map = new Map<string, Vec2>();
  for (const opening of doc.openings) {
    if (opening.wall.roomId !== roomId) continue;
    const segment = openingWorldSegment(doc, opening);
    if (segment) {
      map.set(opening.id, [
        (segment.a[0] + segment.b[0]) / 2,
        (segment.a[1] + segment.b[1]) / 2,
      ]);
    }
  }
  return map;
}

/** Fügt auf der Mitte der Kante `edgeIndex` eine neue Ecke ein. */
export function insertVertex(polygon: Vec2[], edgeIndex: number): Vec2[] {
  const next = [...polygon];
  const a = polygon[edgeIndex % polygon.length];
  const b = polygon[(edgeIndex + 1) % polygon.length];
  next.splice(edgeIndex + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  return next;
}

/** Entfernt eine Ecke. Ein Polygon behält mindestens drei Ecken. */
export function removeVertex(polygon: Vec2[], index: number): Vec2[] {
  if (polygon.length <= 3) return polygon;
  const next = [...polygon];
  next.splice(index, 1);
  return next;
}

/** Schnittpunkt zweier Strecken, sofern sie sich echt kreuzen. */
export function segmentIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d1x = p2[0] - p1[0];
  const d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0];
  const d2y = p4[1] - p3[1];
  const denominator = d1x * d2y - d1y * d2x;
  if (Math.abs(denominator) < 1e-9) return null; // parallel
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denominator;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [p1[0] + d1x * t, p1[1] + d1y * t];
}
