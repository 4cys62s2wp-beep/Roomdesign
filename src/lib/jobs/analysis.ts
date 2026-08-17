import { promises as fs } from "fs";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import type { FrameInput } from "@/lib/ai/types";
import type { AnalysisJobPayload, FloorPlanDoc, RoomTag } from "@/lib/types";
import { updateJobProgress } from "@/lib/jobs/queue";
import { normalizeDoc, roomAreaM2 } from "@/lib/geometry/floorplan";

export async function runAnalysisJob(jobId: string): Promise<void> {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const payload = JSON.parse(job.payload) as AnalysisJobPayload;

  // Frames + Raum-Tags des Videos laden (falls vorhanden)
  const video = payload.videoId
    ? await db.videoAsset.findUnique({ where: { id: payload.videoId }, include: { frames: true } })
    : await db.videoAsset.findFirst({
        where: { projectId: job.projectId },
        orderBy: { createdAt: "desc" },
        include: { frames: true },
      });

  const frames: FrameInput[] = [];
  if (video) {
    const sorted = [...video.frames].sort((a, b) => a.index - b.index);
    for (const frame of sorted) {
      try {
        const data = await fs.readFile(frame.filePath);
        frames.push({
          base64: data.toString("base64"),
          mediaType: "image/jpeg",
          timestampMs: frame.timestampMs,
        });
      } catch {
        // Fehlende Einzelframes überspringen statt den Job abzubrechen
      }
    }
  }
  const roomTags: RoomTag[] = video?.roomTags ? (JSON.parse(video.roomTags) as RoomTag[]) : [];

  const provider = await getProvider();
  const result = await provider.analyzeApartment(
    { frames, roomTags, userHints: payload.userHints },
    (progress, step, statusText) => updateJobProgress(jobId, progress, step, statusText),
  );

  await updateJobProgress(jobId, 95, "saving", "Grundriss wird gespeichert …");
  const doc = normalizeDoc(result.floorPlan, 40);
  const floorPlan = await saveFloorPlan(job.projectId, doc, provider.name === "demo" ? "demo" : "ai");

  await db.job.update({
    where: { id: jobId },
    data: { result: JSON.stringify({ floorPlanId: floorPlan.id, summary: result.summary }) },
  });
}

/** Speichert den Grundriss und synchronisiert die Room-Zeilen (für Relationen zu Vorschlägen). */
export async function saveFloorPlan(
  projectId: string,
  doc: FloorPlanDoc,
  source: "ai" | "manual" | "demo",
) {
  const data = JSON.stringify(doc);
  const existing = await db.floorPlan.findUnique({ where: { projectId } });
  const floorPlan = existing
    ? await db.floorPlan.update({
        where: { projectId },
        data: { data, source, version: existing.version + 1 },
      })
    : await db.floorPlan.create({ data: { projectId, data, source } });

  const keysInDoc = new Set(doc.rooms.map((room) => room.id));
  await db.room.deleteMany({
    where: { floorPlanId: floorPlan.id, key: { notIn: [...keysInDoc] } },
  });
  for (const room of doc.rooms) {
    await db.room.upsert({
      where: { floorPlanId_key: { floorPlanId: floorPlan.id, key: room.id } },
      update: { name: room.name, type: room.type, areaM2: roomAreaM2(room) },
      create: {
        floorPlanId: floorPlan.id,
        key: room.id,
        name: room.name,
        type: room.type,
        areaM2: roomAreaM2(room),
      },
    });
  }
  return floorPlan;
}
