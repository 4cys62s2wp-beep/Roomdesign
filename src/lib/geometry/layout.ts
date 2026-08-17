// Auto-Layout: Baut aus den von der KI geschätzten Raumgrößen und dem
// Nachbarschafts-Graphen einen 2D-Grundriss. Das Ergebnis muss nicht perfekt
// sein — der Nutzer korrigiert es anschließend im Grundriss-Editor.

import type { FloorPlanDoc, Opening, OpeningKind, RoomType, Vec2 } from "@/lib/types";
import { rect } from "@/lib/geometry/floorplan";

export interface EstimatedRoom {
  key: string;
  name: string;
  type: RoomType;
  widthCm: number;
  depthCm: number;
  ceilingHeightCm: number;
  confidence: number;
  /** Nachbarräume, zu denen eine Verbindung besteht. */
  connections: Array<{ roomKey: string; kind: Exclude<OpeningKind, "window"> }>;
  /** Fenster: Anzahl (werden auf Außenwände verteilt). */
  windowCount: number;
}

interface Placed {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Boundary {
  horizontal: boolean;
  /** Überlappungsbereich entlang der gemeinsamen Kante (Weltkoordinaten). */
  start: number;
  end: number;
  /** Koordinate der gemeinsamen Linie: y bei horizontal, x bei vertikal. */
  at: number;
}

const GRID_STEP = 20;

function overlaps(a: Placed, b: Placed): boolean {
  return a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
}

function sharedBoundary(a: Placed, b: Placed): Boundary | null {
  // Gemeinsame horizontale Kante
  for (const at of [a.y, a.y + a.h]) {
    if (Math.abs(at - b.y) < 1 || Math.abs(at - (b.y + b.h)) < 1) {
      const start = Math.max(a.x, b.x);
      const end = Math.min(a.x + a.w, b.x + b.w);
      if (end - start >= 70) return { horizontal: true, start, end, at };
    }
  }
  // Gemeinsame vertikale Kante
  for (const at of [a.x, a.x + a.w]) {
    if (Math.abs(at - b.x) < 1 || Math.abs(at - (b.x + b.w)) < 1) {
      const start = Math.max(a.y, b.y);
      const end = Math.min(a.y + a.h, b.y + b.h);
      if (end - start >= 70) return { horizontal: false, start, end, at };
    }
  }
  return null;
}

/** Versucht, Raum `room` an Raum `anchor` anzudocken (alle 4 Seiten, verschoben in Schritten). */
function tryAttach(room: EstimatedRoom, anchor: Placed, placed: Placed[]): Placed | null {
  const w = room.widthCm;
  const h = room.depthCm;
  const candidates: Vec2[] = [];

  for (let offset = 0; offset <= Math.max(anchor.h, h); offset += GRID_STEP) {
    for (const sign of offset === 0 ? [1] : [1, -1]) {
      const dy = sign * offset;
      candidates.push([anchor.x + anchor.w, anchor.y + dy]);
      candidates.push([anchor.x - w, anchor.y + dy]);
    }
  }
  for (let offset = 0; offset <= Math.max(anchor.w, w); offset += GRID_STEP) {
    for (const sign of offset === 0 ? [1] : [1, -1]) {
      const dx = sign * offset;
      candidates.push([anchor.x + dx, anchor.y + anchor.h]);
      candidates.push([anchor.x + dx, anchor.y - h]);
    }
  }

  for (const [x, y] of candidates) {
    const candidate: Placed = { key: room.key, x, y, w, h };
    if (placed.some((p) => overlaps(p, candidate))) continue;
    if (!sharedBoundary(candidate, anchor)) continue;
    return candidate;
  }
  return null;
}

export function layoutFloorPlan(
  estimatedRooms: EstimatedRoom[],
  meta: { note?: string; confidence: number },
): FloorPlanDoc {
  const roomsByKey = new Map(estimatedRooms.map((r) => [r.key, r]));
  const placed: Placed[] = [];
  const placedByKey = new Map<string, Placed>();

  // Startraum: Flur bevorzugt, sonst der Raum mit den meisten Verbindungen
  const ordered = [...estimatedRooms].sort(
    (a, b) =>
      (b.type === "hallway" ? 100 : 0) + b.connections.length -
      ((a.type === "hallway" ? 100 : 0) + a.connections.length),
  );
  if (ordered.length === 0) {
    return { unit: "cm", rooms: [], openings: [], meta: { source: "ai", ...meta } };
  }

  const queue: string[] = [ordered[0].key];
  const first = ordered[0];
  const firstPlaced: Placed = { key: first.key, x: 0, y: 0, w: first.widthCm, h: first.depthCm };
  placed.push(firstPlaced);
  placedByKey.set(first.key, firstPlaced);

  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    const current = roomsByKey.get(currentKey)!;
    const anchor = placedByKey.get(currentKey)!;
    for (const connection of current.connections) {
      if (placedByKey.has(connection.roomKey)) continue;
      const neighbor = roomsByKey.get(connection.roomKey);
      if (!neighbor) continue;
      const spot = tryAttach(neighbor, anchor, placed);
      if (spot) {
        placed.push(spot);
        placedByKey.set(neighbor.key, spot);
        queue.push(neighbor.key);
      }
    }
  }

  // Nicht platzierte Räume (fehlende/inkonsistente Verbindungen): rechts daneben aufreihen
  let fallbackX = Math.max(0, ...placed.map((p) => p.x + p.w)) + 200;
  for (const room of ordered) {
    if (placedByKey.has(room.key)) continue;
    const spot: Placed = { key: room.key, x: fallbackX, y: 0, w: room.widthCm, h: room.depthCm };
    placed.push(spot);
    placedByKey.set(room.key, spot);
    fallbackX += room.widthCm + 200;
  }

  const doc: FloorPlanDoc = {
    unit: "cm",
    rooms: estimatedRooms.map((room) => {
      const p = placedByKey.get(room.key)!;
      return {
        id: room.key,
        name: room.name,
        type: room.type,
        polygon: rect(p.x, p.y, p.w, p.h),
        ceilingHeightCm: room.ceilingHeightCm,
        confidence: room.confidence,
      };
    }),
    openings: [],
    meta: { source: "ai", ...meta },
  };

  // Verbindungen → Türen/Durchgänge mittig auf der gemeinsamen Grenze
  const connected = new Set<string>();
  for (const room of estimatedRooms) {
    const a = placedByKey.get(room.key)!;
    for (const connection of room.connections) {
      const pairKey = [room.key, connection.roomKey].sort().join("|");
      if (connected.has(pairKey)) continue;
      const b = placedByKey.get(connection.roomKey);
      if (!b) continue;
      const boundary = sharedBoundary(a, b);
      if (!boundary) continue;
      connected.add(pairKey);

      const width =
        connection.kind === "passage"
          ? Math.max(90, Math.min(160, boundary.end - boundary.start - 20))
          : 90;
      const opening = openingOnRect(room.key, a, boundary, width, connection.kind, connection.roomKey);
      if (opening) doc.openings.push(opening);
    }
  }

  // Fenster auf Außenwände verteilen (Kanten ohne Nachbarn)
  for (const room of estimatedRooms) {
    if (room.windowCount <= 0) continue;
    const p = placedByKey.get(room.key)!;
    const exteriorEdges = exteriorEdgeIndices(p, placed);
    if (exteriorEdges.length === 0) continue;
    for (let i = 0; i < room.windowCount; i++) {
      const edgeIndex = exteriorEdges[i % exteriorEdges.length];
      const edgeLength = edgeIndex % 2 === 0 ? p.w : p.h;
      const width = Math.min(120, edgeLength - 40);
      if (width < 40) continue;
      const slots = Math.ceil(room.windowCount / exteriorEdges.length);
      const slot = Math.floor(i / exteriorEdges.length);
      const offset = ((slot + 1) * edgeLength) / (slots + 1) - width / 2;
      doc.openings.push({
        id: `win-${room.key}-${i}`,
        kind: "window",
        wall: { roomId: room.key, edgeIndex },
        roomB: null,
        offsetCm: Math.max(10, Math.min(offset, edgeLength - width - 10)),
        widthCm: width,
        heightCm: 130,
        sillCm: 90,
      });
    }
  }

  return doc;
}

/** Kanten eines Rechteck-Raums, an denen kein anderer Raum anliegt (0=oben,1=rechts,2=unten,3=links). */
function exteriorEdgeIndices(p: Placed, placed: Placed[]): number[] {
  const result: number[] = [];
  const others = placed.filter((o) => o.key !== p.key);
  const touchesTop = others.some((o) => Math.abs(o.y + o.h - p.y) < 1 && o.x < p.x + p.w && p.x < o.x + o.w);
  const touchesBottom = others.some((o) => Math.abs(p.y + p.h - o.y) < 1 && o.x < p.x + p.w && p.x < o.x + o.w);
  const touchesLeft = others.some((o) => Math.abs(o.x + o.w - p.x) < 1 && o.y < p.y + p.h && p.y < o.y + o.h);
  const touchesRight = others.some((o) => Math.abs(p.x + p.w - o.x) < 1 && o.y < p.y + p.h && p.y < o.y + o.h);
  if (!touchesTop) result.push(0);
  if (!touchesRight) result.push(1);
  if (!touchesBottom) result.push(2);
  if (!touchesLeft) result.push(3);
  return result;
}

/**
 * Erzeugt eine Öffnung auf der passenden Kante eines Rechteck-Raums.
 * rect()-Polygon: Kante 0 = oben (Richtung +x), 1 = rechts (+y),
 * 2 = unten (−x), 3 = links (−y).
 */
function openingOnRect(
  roomKey: string,
  p: Placed,
  boundary: Boundary,
  width: number,
  kind: Exclude<OpeningKind, "window">,
  roomB: string,
): Opening | null {
  const centerT = (boundary.start + boundary.end) / 2;
  let edgeIndex: number;
  let offset: number;

  if (boundary.horizontal) {
    if (Math.abs(boundary.at - p.y) < 1) {
      edgeIndex = 0;
      offset = centerT - width / 2 - p.x;
    } else {
      edgeIndex = 2;
      offset = p.x + p.w - (centerT + width / 2);
    }
    offset = Math.max(5, Math.min(offset, p.w - width - 5));
  } else {
    if (Math.abs(boundary.at - (p.x + p.w)) < 1) {
      edgeIndex = 1;
      offset = centerT - width / 2 - p.y;
    } else {
      edgeIndex = 3;
      offset = p.y + p.h - (centerT + width / 2);
    }
    offset = Math.max(5, Math.min(offset, p.h - width - 5));
  }

  if (!isFinite(offset)) return null;
  return {
    id: `open-${roomKey}-${roomB}`,
    kind,
    wall: { roomId: roomKey, edgeIndex },
    roomB,
    offsetCm: offset,
    widthCm: width,
    heightCm: kind === "passage" ? 210 : 200,
  };
}
