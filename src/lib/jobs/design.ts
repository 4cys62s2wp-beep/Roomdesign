import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import type { DesignJobPayload, FloorPlanDoc, ProposalDoc } from "@/lib/types";
import { updateJobProgress } from "@/lib/jobs/queue";
import { fitFurniture } from "@/lib/geometry/furniture-fit";

export async function runDesignJob(jobId: string): Promise<void> {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const payload = JSON.parse(job.payload) as DesignJobPayload;

  const room = await db.room.findUniqueOrThrow({
    where: { id: payload.roomDbId },
    include: { floorPlan: { include: { project: true } } },
  });
  const doc = JSON.parse(room.floorPlan.data) as FloorPlanDoc;
  const roomShape = doc.rooms.find((r) => r.id === room.key);
  if (!roomShape) {
    throw new Error(`Raum „${room.name}" ist im aktuellen Grundriss nicht mehr vorhanden.`);
  }

  let previous: ProposalDoc | undefined;
  let previousFeedback: Array<{ feedback: string; at: string }> = [];
  if (payload.refineOfProposalId) {
    const previousRow = await db.designProposal.findUnique({
      where: { id: payload.refineOfProposalId },
    });
    if (previousRow) {
      previous = JSON.parse(previousRow.data) as ProposalDoc;
      previousFeedback = previousRow.feedback
        ? (JSON.parse(previousRow.feedback) as Array<{ feedback: string; at: string }>)
        : [];
    }
  }

  const provider = await getProvider();
  const proposals = await provider.generateDesigns(
    {
      doc,
      roomKey: room.key,
      stylePrompt: payload.stylePrompt,
      presets: payload.presets,
      budgetEur: payload.budgetEur,
      globalStyle: room.floorPlan.project.globalStyle,
      count: payload.count,
      previous,
      feedback: payload.feedback,
    },
    (progress, step, statusText) => updateJobProgress(jobId, progress, step, statusText),
  );

  await updateJobProgress(jobId, 92, "saving", "Vorschläge werden geprüft und gespeichert …");

  const proposalIds: string[] = [];
  for (const proposal of proposals) {
    // Plausibilisierung: Möbel in den Raum klemmen, Tür-Kollisionen als Hinweise sammeln
    const { items, issues } = fitFurniture(proposal.furniture, roomShape, doc);
    const fitted: ProposalDoc & { fitIssues?: string[] } = {
      ...proposal,
      furniture: items,
      ...(issues.length > 0 ? { fitIssues: issues.map((i) => i.message) } : {}),
    };

    const feedbackHistory = payload.feedback
      ? [...previousFeedback, { feedback: payload.feedback, at: new Date().toISOString() }]
      : previousFeedback;

    const row = await db.designProposal.create({
      data: {
        roomId: room.id,
        title: fitted.title,
        stylePrompt: payload.stylePrompt || null,
        data: JSON.stringify(fitted),
        totalCostEur: fitted.budget.totalEur,
        feedback: feedbackHistory.length > 0 ? JSON.stringify(feedbackHistory) : null,
      },
    });
    proposalIds.push(row.id);
  }

  await db.job.update({
    where: { id: jobId },
    data: { result: JSON.stringify({ proposalIds }) },
  });
}
