import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import { enqueueJob } from "@/lib/jobs/queue";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id: projectId } = await params;
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return jsonError("Projekt nicht gefunden.", 404);

    const body = (await request.json().catch(() => ({}))) as {
      videoId?: string;
      userHints?: string;
    };

    const jobId = await enqueueJob(projectId, "analysis", {
      videoId: body.videoId,
      userHints: body.userHints,
    });
    return NextResponse.json({ jobId }, { status: 202 });
  });
}
