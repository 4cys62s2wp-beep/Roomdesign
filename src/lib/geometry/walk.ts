// Begehbarkeit im 3D-Rundgang: Der Nutzer soll in der Wohnung bleiben und
// nicht durch Wände laufen — Türen und Durchgänge aber passieren können.

import type { FloorPlanDoc, Vec2 } from "@/lib/types";
import {
  distanceToSegment,
  openingWorldSegment,
  pointInPolygon,
  roomEdge,
  segmentIntersection,
} from "@/lib/geometry/floorplan";

/** Körperradius in cm — verhindert, dass man mit der Nase in der Wand steht. */
export const BODY_RADIUS_CM = 26;

/** Wie weit eine Türschwelle als begehbar gilt (cm beidseits der Wandlinie). */
const THRESHOLD_TOLERANCE_CM = 3;

/**
 * Darf an dieser Stelle gestanden werden?
 *
 * Erlaubt ist jede Position innerhalb eines Raums, die weit genug von den
 * Wänden entfernt ist. Direkt an einer Wand ist sie nur erlaubt, wenn dort
 * eine Tür oder ein Durchgang sitzt — so bleibt der Weg zwischen den Räumen
 * frei, während geschlossene Wände blockieren.
 */
export function isWalkable(doc: FloorPlanDoc, point: Vec2, radius = BODY_RADIUS_CM): boolean {
  // Türschwellen ausdrücklich erlauben: Der Mittelpunkt einer Tür liegt exakt
  // auf der Grenzlinie zweier Räume, wo die Punkt-im-Polygon-Prüfung je nach
  // Rundung mal so und mal so ausfällt. Ohne diese Ausnahme bliebe man in
  // der Türöffnung hängen.
  if (isInWalkableOpening(doc, point, THRESHOLD_TOLERANCE_CM)) return true;

  for (const room of doc.rooms) {
    if (!pointInPolygon(point, room.polygon)) continue;

    let blocked = false;
    for (let edgeIndex = 0; edgeIndex < room.polygon.length; edgeIndex++) {
      const edge = roomEdge(room, edgeIndex);
      if (distanceToSegment(point, edge.a, edge.b) >= radius) continue;
      if (!nearWalkableOpening(doc, point, radius)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return true;
  }
  return false;
}

/** Liegt der Punkt im Bereich einer Tür oder eines Durchgangs? */
function nearWalkableOpening(doc: FloorPlanDoc, point: Vec2, radius: number): boolean {
  for (const opening of doc.openings) {
    if (opening.kind === "window") continue;
    const segment = openingWorldSegment(doc, opening);
    if (!segment) continue;
    if (distanceToSegment(point, segment.a, segment.b) <= radius) return true;
  }
  return false;
}

/**
 * Kreuzt die Bewegung eine geschlossene Wand?
 *
 * Der Zielpunkt allein genügt nicht: Bei einem Ruckler kann ein einzelner
 * Schritt so groß werden, dass Start und Ziel beide frei liegen, die Strecke
 * dazwischen aber durch eine Wand führt. Türen und Durchgänge sind erlaubt.
 */
export function crossesWall(doc: FloorPlanDoc, from: Vec2, to: Vec2): boolean {
  for (const room of doc.rooms) {
    for (let edgeIndex = 0; edgeIndex < room.polygon.length; edgeIndex++) {
      const edge = roomEdge(room, edgeIndex);
      const hit = segmentIntersection(from, to, edge.a, edge.b);
      if (!hit) continue;
      if (!isInWalkableOpening(doc, hit)) return true;
    }
  }
  return false;
}

/** Liegt der Punkt auf einer Tür oder einem Durchgang? */
function isInWalkableOpening(doc: FloorPlanDoc, point: Vec2, tolerance = 1): boolean {
  for (const opening of doc.openings) {
    if (opening.kind === "window") continue;
    const segment = openingWorldSegment(doc, opening);
    if (!segment) continue;
    if (distanceToSegment(point, segment.a, segment.b) <= tolerance) return true;
  }
  return false;
}

/** Ziel erreichbar: frei stehen können UND keine Wand durchqueren. */
function canMove(doc: FloorPlanDoc, from: Vec2, to: Vec2, radius: number): boolean {
  return isWalkable(doc, to, radius) && !crossesWall(doc, from, to);
}

/**
 * Bewegung auflösen: Ist das Ziel blockiert, wird an der Wand entlang
 * geglitten, statt abrupt stehen zu bleiben.
 */
export function resolveMove(
  doc: FloorPlanDoc,
  from: Vec2,
  to: Vec2,
  radius = BODY_RADIUS_CM,
): Vec2 {
  if (canMove(doc, from, to, radius)) return to;

  const slideX: Vec2 = [to[0], from[1]];
  if (canMove(doc, from, slideX, radius)) return slideX;

  const slideY: Vec2 = [from[0], to[1]];
  if (canMove(doc, from, slideY, radius)) return slideY;

  return from;
}

/** Sinnvoller Startpunkt: Mittelpunkt des größten begehbaren Raums. */
export function walkStartPoint(doc: FloorPlanDoc): Vec2 | null {
  for (const room of doc.rooms) {
    const xs = room.polygon.map((p) => p[0]);
    const ys = room.polygon.map((p) => p[1]);
    const center: Vec2 = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ];
    if (isWalkable(doc, center)) return center;
  }
  return null;
}
