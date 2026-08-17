import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import { enqueueJob } from "@/lib/jobs/queue";
import type { DesignJobPayload } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id: roomId } = await params;
    const proposals = await db.designProposal.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      proposals.map((p) => ({
        id: p.id,
        title: p.title,
        stylePrompt: p.stylePrompt,
        totalCostEur: p.totalCostEur,
        isFavorite: p.isFavorite,
        createdAt: p.createdAt,
        feedback: p.feedback ? JSON.parse(p.feedback) : [],
        data: JSON.parse(p.data),
      })),
    );
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id: roomId } = await params;
    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { floorPlan: true },
    });
    if (!room) return jsonError("Raum nicht gefunden.", 404);

    const body = (await request.json().catch(() => ({}))) as {
      stylePrompt?: string;
      presets?: string[];
      budgetEur?: number | null;
      count?: number;
    };

    const payload: DesignJobPayload = {
      roomDbId: roomId,
      stylePrompt: body.stylePrompt?.trim() ?? "",
      presets: Array.isArray(body.presets) ? body.presets.slice(0, 4) : [],
      budgetEur: typeof body.budgetEur === "number" && body.budgetEur > 0 ? body.budgetEur : null,
      count: Math.min(3, Math.max(1, body.count ?? 2)),
    };

    const jobId = await enqueueJob(room.floorPlan.projectId, "design", payload);
    return NextResponse.json({ jobId }, { status: 202 });
  });
}
