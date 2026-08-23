// Aggregierte Einkaufsliste: pro Raum der favorisierte (sonst neueste) Vorschlag,
// alle Möbel + Leuchten mit Preisen. ?format=csv liefert einen CSV-Export.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import type { ProposalDoc } from "@/lib/types";
import { FURNITURE_KIND_LABELS } from "@/lib/types";
import { buildCsv, type ShoppingItem } from "@/lib/shopping";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id: projectId } = await params;
    const floorPlan = await db.floorPlan.findUnique({
      where: { projectId },
      include: {
        rooms: {
          include: {
            proposals: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
          },
        },
        project: true,
      },
    });
    if (!floorPlan) return jsonError("Noch kein Grundriss vorhanden.", 404);

    const items: ShoppingItem[] = [];
    const perRoom: Array<{
      roomId: string;
      roomName: string;
      proposalId: string | null;
      proposalTitle: string | null;
      totalEur: number;
    }> = [];

    for (const room of floorPlan.rooms) {
      const chosen = room.proposals.find((p) => p.isFavorite) ?? room.proposals[0] ?? null;
      if (!chosen) {
        perRoom.push({
          roomId: room.id,
          roomName: room.name,
          proposalId: null,
          proposalTitle: null,
          totalEur: 0,
        });
        continue;
      }
      const doc = JSON.parse(chosen.data) as ProposalDoc;
      let roomTotal = 0;
      for (const item of doc.furniture) {
        roomTotal += item.estPriceEur;
        items.push({
          roomName: room.name,
          proposalTitle: chosen.title,
          label: item.label,
          category: FURNITURE_KIND_LABELS[item.kind] ?? item.kind,
          dimensions: `${Math.round(item.wCm)}×${Math.round(item.dCm)}×${Math.round(item.hCm)} cm`,
          priceEur: item.estPriceEur,
          searchQuery: item.searchQuery ?? item.label,
        });
      }
      for (const light of doc.lighting) {
        if (light.estPriceEur == null) continue;
        roomTotal += light.estPriceEur;
        items.push({
          roomName: room.name,
          proposalTitle: chosen.title,
          label: light.name,
          category: "Beleuchtung",
          dimensions: "",
          priceEur: light.estPriceEur,
          searchQuery: light.name,
        });
      }
      perRoom.push({
        roomId: room.id,
        roomName: room.name,
        proposalId: chosen.id,
        proposalTitle: chosen.title,
        totalEur: roomTotal,
      });
    }

    const format = request.nextUrl.searchParams.get("format");
    if (format === "csv") {
      const csv = buildCsv(items);
      const safeName = floorPlan.project.name.replace(/[^a-zA-Z0-9-_]/g, "_");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="einkaufsliste-${safeName}.csv"`,
        },
      });
    }

    return NextResponse.json({
      items,
      perRoom,
      totalEur: items.reduce((sum, item) => sum + item.priceEur, 0),
    });
  });
}
