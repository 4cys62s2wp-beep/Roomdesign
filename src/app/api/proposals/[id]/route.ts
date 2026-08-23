import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import { fitFurniture } from "@/lib/geometry/furniture-fit";
import type { FloorPlanDoc, FurnitureItem, ProposalDoc } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const proposal = await db.designProposal.findUnique({
      where: { id },
      include: { room: { include: { floorPlan: true } } },
    });
    if (!proposal) return jsonError("Vorschlag nicht gefunden.", 404);
    return NextResponse.json({
      id: proposal.id,
      roomId: proposal.roomId,
      title: proposal.title,
      isFavorite: proposal.isFavorite,
      totalCostEur: proposal.totalCostEur,
      data: JSON.parse(proposal.data),
      feedback: proposal.feedback ? JSON.parse(proposal.feedback) : [],
    });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const body = (await request.json()) as {
      isFavorite?: boolean;
      furniture?: FurnitureItem[];
    };

    // Nur der Favoritenstatus ändert sich – kein Nachrechnen nötig
    if (body.furniture === undefined) {
      const proposal = await db.designProposal.update({
        where: { id },
        data: { ...(body.isFavorite !== undefined ? { isFavorite: body.isFavorite } : {}) },
      });
      return NextResponse.json({ id: proposal.id, isFavorite: proposal.isFavorite });
    }

    if (!Array.isArray(body.furniture)) {
      return jsonError("furniture muss eine Liste sein.");
    }
    if (!body.furniture.every(isValidFurniture)) {
      return jsonError("Mindestens ein Möbelstück hat ungültige Maße oder Koordinaten.");
    }

    const existing = await db.designProposal.findUnique({
      where: { id },
      include: { room: { include: { floorPlan: true } } },
    });
    if (!existing) return jsonError("Vorschlag nicht gefunden.", 404);

    const doc = JSON.parse(existing.room.floorPlan.data) as FloorPlanDoc;
    const roomShape = doc.rooms.find((r) => r.id === existing.room.key);
    if (!roomShape) {
      return jsonError("Der Raum ist im aktuellen Grundriss nicht mehr vorhanden.", 409);
    }

    // Auch manuell gesetzte Möbel werden geprüft: in den Raum klemmen und
    // Kollisionen mit Türschwenkbereichen als Hinweis zurückgeben.
    const { items, issues } = fitFurniture(body.furniture, roomShape, doc);
    const data = JSON.parse(existing.data) as ProposalDoc & { fitIssues?: string[] };
    const furnitureTotal = items.reduce((sum, item) => sum + item.estPriceEur, 0);
    const lightingTotal = data.lighting.reduce((sum, light) => sum + (light.estPriceEur ?? 0), 0);
    const totalEur = furnitureTotal + lightingTotal;

    const next: ProposalDoc & { fitIssues?: string[] } = {
      ...data,
      furniture: items,
      budget: { ...data.budget, totalEur },
      ...(issues.length > 0
        ? { fitIssues: issues.map((issue) => issue.message) }
        : { fitIssues: undefined }),
    };

    const proposal = await db.designProposal.update({
      where: { id },
      data: {
        data: JSON.stringify(next),
        totalCostEur: totalEur,
        ...(body.isFavorite !== undefined ? { isFavorite: body.isFavorite } : {}),
      },
    });

    return NextResponse.json({
      id: proposal.id,
      isFavorite: proposal.isFavorite,
      totalCostEur: totalEur,
      furniture: items,
      warnings: issues.map((issue) => issue.message),
    });
  });
}

function isValidFurniture(item: FurnitureItem): boolean {
  const numbers = [item.wCm, item.dCm, item.hCm, item.x, item.y, item.rotationDeg];
  return (
    typeof item.id === "string" &&
    typeof item.kind === "string" &&
    typeof item.label === "string" &&
    numbers.every((value) => typeof value === "number" && Number.isFinite(value)) &&
    item.wCm > 0 &&
    item.dCm > 0 &&
    item.hCm > 0
  );
}

/**
 * Sanftes Löschen: Der Vorschlag verschwindet aus allen Listen, bleibt aber
 * erhalten, damit ein Fehlgriff rückgängig gemacht werden kann.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const proposal = await db.designProposal.update({
      where: { id },
      data: { deletedAt: new Date(), isFavorite: false },
    });
    return NextResponse.json({ ok: true, id: proposal.id, restorable: true });
  });
}
