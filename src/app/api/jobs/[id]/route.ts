import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job) return jsonError("Job nicht gefunden.", 404);
    return NextResponse.json({
      id: job.id,
      projectId: job.projectId,
      type: job.type,
      status: job.status,
      step: job.step,
      progress: job.progress,
      statusText: job.statusText,
      error: job.error,
      result: job.result ? JSON.parse(job.result) : null,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    });
  });
}
