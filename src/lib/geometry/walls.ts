// Erzeugt aus dem FloorPlanDoc Wandstücke für den 3D-Viewer.
// Jede Raumkante wird in Segmente zerlegt; Öffnungen (Türen, Fenster,
// Durchgänge) schneiden Lücken bzw. Teilstücke (Sturz über Türen,
// Brüstung unter Fenstern) heraus. Öffnungen wirken geometrisch: Sie
// schneiden auch die deckungsgleiche Wandkante des Nachbarraums.

import type { FloorPlanDoc, Vec2 } from "@/lib/types";
import { openingWorldSegment, projectOnEdge, roomEdge } from "@/lib/geometry/floorplan";

export interface WallPiece {
  /** Startabstand entlang der Kante (cm). */
  start: number;
  end: number;
  /** Unterkante/Oberkante über dem Boden (cm). */
  z0: number;
  z1: number;
}

export interface EdgeWall {
  roomId: string;
  edgeIndex: number;
  a: Vec2;
  b: Vec2;
  length: number;
  ceilingHeightCm: number;
  pieces: WallPiece[];
}

interface Cut {
  start: number;
  end: number;
  z0: number;
  z1: number;
}

const COLLINEAR_TOLERANCE_CM = 3;
const MIN_PIECE_CM = 1;

export function buildWalls(doc: FloorPlanDoc): EdgeWall[] {
  // Öffnungs-Segmente einmal in Weltkoordinaten berechnen
  const openingSegments = doc.openings
    .map((opening) => {
      const segment = openingWorldSegment(doc, opening);
      return segment ? { opening, segment } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const walls: EdgeWall[] = [];

  for (const room of doc.rooms) {
    for (let edgeIndex = 0; edgeIndex < room.polygon.length; edgeIndex++) {
      const edge = roomEdge(room, edgeIndex);
      if (edge.length < MIN_PIECE_CM) continue;

      const cuts: Cut[] = [];
      for (const { opening, segment } of openingSegments) {
        const pa = projectOnEdge(edge, segment.a);
        const pb = projectOnEdge(edge, segment.b);
        // Öffnung liegt nur dann auf dieser Kante, wenn beide Endpunkte
        // nahe genug an der Kantenlinie liegen und sich die Parameter überlappen.
        if (pa.dist > COLLINEAR_TOLERANCE_CM || pb.dist > COLLINEAR_TOLERANCE_CM) continue;
        const start = Math.max(0, Math.min(pa.t, pb.t));
        const end = Math.min(edge.length, Math.max(pa.t, pb.t));
        if (end - start < MIN_PIECE_CM) continue;

        if (opening.kind === "window") {
          const sill = opening.sillCm ?? 90;
          cuts.push({ start, end, z0: sill, z1: Math.min(sill + opening.heightCm, room.ceilingHeightCm) });
        } else {
          cuts.push({ start, end, z0: 0, z1: Math.min(opening.heightCm, room.ceilingHeightCm) });
        }
      }

      walls.push({
        roomId: room.id,
        edgeIndex,
        a: edge.a,
        b: edge.b,
        length: edge.length,
        ceilingHeightCm: room.ceilingHeightCm,
        pieces: piecesForEdge(edge.length, room.ceilingHeightCm, cuts),
      });
    }
  }

  return walls;
}

function piecesForEdge(length: number, ceiling: number, cuts: Cut[]): WallPiece[] {
  if (cuts.length === 0) {
    return [{ start: 0, end: length, z0: 0, z1: ceiling }];
  }

  // Überlappende Schnittintervalle horizontal zusammenführen ist nicht nötig,
  // solange wir die Kante in Spalten an allen Schnittgrenzen zerlegen und pro
  // Spalte die verbleibenden vertikalen Bereiche bestimmen.
  const stops = new Set<number>([0, length]);
  for (const cut of cuts) {
    stops.add(Math.max(0, cut.start));
    stops.add(Math.min(length, cut.end));
  }
  const sorted = [...stops].sort((a, b) => a - b);

  const pieces: WallPiece[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end - start < MIN_PIECE_CM) continue;
    const mid = (start + end) / 2;
    const columnCuts = cuts
      .filter((cut) => cut.start <= mid && mid <= cut.end)
      .sort((a, b) => a.z0 - b.z0);

    let z = 0;
    for (const cut of columnCuts) {
      if (cut.z0 - z >= MIN_PIECE_CM) {
        pieces.push({ start, end, z0: z, z1: cut.z0 });
      }
      z = Math.max(z, cut.z1);
    }
    if (ceiling - z >= MIN_PIECE_CM) {
      pieces.push({ start, end, z0: z, z1: ceiling });
    }
  }

  // Benachbarte Spalten mit identischem vertikalen Bereich verschmelzen
  const merged: WallPiece[] = [];
  for (const piece of pieces.sort((a, b) => a.z0 - b.z0 || a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && last.z0 === piece.z0 && last.z1 === piece.z1 && Math.abs(last.end - piece.start) < 0.01) {
      last.end = piece.end;
    } else {
      merged.push({ ...piece });
    }
  }
  return merged;
}
