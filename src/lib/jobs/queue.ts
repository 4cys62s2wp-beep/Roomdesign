// DB-gestützte In-Process-Jobqueue: Jobs liegen in SQLite, ein einzelner
// Worker pro Prozess arbeitet sie sequenziell ab (vermeidet SQLite-Write-
// Konflikte). Der Client pollt den Jobstatus über GET /api/jobs/[id].

import { db } from "@/lib/db";
import type { JobType } from "@/lib/types";

const globalForQueue = globalThis as unknown as { roomdesignQueueRunning?: boolean };

export async function enqueueJob(
  projectId: string,
  type: JobType,
  payload: unknown,
): Promise<string> {
  const job = await db.job.create({
    data: {
      projectId,
      type,
      status: "queued",
      progress: 0,
      statusText: "In Warteschlange …",
      payload: JSON.stringify(payload ?? {}),
    },
  });
  // Worker anstoßen, aber den Request nicht blockieren
  void processQueue();
  return job.id;
}

export async function updateJobProgress(
  jobId: string,
  progress: number,
  step: string,
  statusText: string,
): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: { progress: Math.round(progress), step, statusText },
  });
}

async function processQueue(): Promise<void> {
  if (globalForQueue.roomdesignQueueRunning) return;
  globalForQueue.roomdesignQueueRunning = true;
  try {
    // Jobs, die ein abgestürzter Prozess in "running" hinterlassen hat, neu einreihen
    await db.job.updateMany({
      where: { status: "running", startedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
      data: { status: "queued", statusText: "Neu eingereiht nach Unterbrechung …" },
    });

    for (;;) {
      const job = await db.job.findFirst({
        where: { status: "queued" },
        orderBy: { createdAt: "asc" },
      });
      if (!job) break;

      await db.job.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date(), statusText: "Gestartet …" },
      });

      try {
        await runJob(job.id, job.type as JobType);
        await db.job.update({
          where: { id: job.id },
          data: { status: "succeeded", progress: 100, finishedAt: new Date(), statusText: "Fertig" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[queue] Job ${job.id} (${job.type}) fehlgeschlagen:`, error);
        await db.job.update({
          where: { id: job.id },
          data: { status: "failed", finishedAt: new Date(), error: message, statusText: "Fehlgeschlagen" },
        });
      }
    }
  } finally {
    globalForQueue.roomdesignQueueRunning = false;
  }
}

async function runJob(jobId: string, type: JobType): Promise<void> {
  // Dynamische Imports vermeiden Zyklen zwischen Queue und Handlern
  if (type === "analysis") {
    const { runAnalysisJob } = await import("@/lib/jobs/analysis");
    await runAnalysisJob(jobId);
  } else {
    const { runDesignJob } = await import("@/lib/jobs/design");
    await runDesignJob(jobId);
  }
}
