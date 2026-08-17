import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

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
    const body = (await request.json()) as { isFavorite?: boolean };
    const proposal = await db.designProposal.update({
      where: { id },
      data: { ...(body.isFavorite !== undefined ? { isFavorite: body.isFavorite } : {}) },
    });
    return NextResponse.json({ id: proposal.id, isFavorite: proposal.isFavorite });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await db.designProposal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
