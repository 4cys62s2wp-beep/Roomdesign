import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import { enqueueJob } from "@/lib/jobs/queue";
import type { DesignJobPayload } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id: proposalId } = await params;
    const proposal = await db.designProposal.findUnique({
      where: { id: proposalId },
      include: { room: { include: { floorPlan: true } } },
    });
    if (!proposal) return jsonError("Vorschlag nicht gefunden.", 404);

    const body = (await request.json()) as { feedback?: string };
    const feedback = body.feedback?.trim();
    if (!feedback) return jsonError("Bitte beschreibe, was geändert werden soll.");

    const payload: DesignJobPayload = {
      roomDbId: proposal.roomId,
      stylePrompt: proposal.stylePrompt ?? "",
      presets: [],
      budgetEur: null,
      count: 1,
      refineOfProposalId: proposalId,
      feedback,
    };
    const jobId = await enqueueJob(proposal.room.floorPlan.projectId, "design", payload);
    return NextResponse.json({ jobId }, { status: 202 });
  });
}
