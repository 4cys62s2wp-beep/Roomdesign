// Nimmt clientseitig extrahierte Videoframes (JPEG) plus Metadaten entgegen.
// Erwartet multipart/form-data mit:
//   kind:        "recorded" | "uploaded"
//   durationSec: Gesamtdauer des Videos (optional)
//   roomTags:    JSON [{ timestampMs, label }] (optional)
//   timestamps:  JSON number[] – Zeitstempel (ms) je Frame, gleiche Reihenfolge
//   frames:      mehrere JPEG-Dateien

import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const MAX_FRAMES = 40;
const MAX_FRAME_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id: projectId } = await params;
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return jsonError("Projekt nicht gefunden.", 404);

    const form = await request.formData();
    const kind = form.get("kind") === "uploaded" ? "uploaded" : "recorded";
    const durationSec = Number(form.get("durationSec")) || null;
    const roomTagsRaw = form.get("roomTags");
    const timestampsRaw = form.get("timestamps");
    const files = form.getAll("frames").filter((f): f is File => f instanceof File);

    if (files.length === 0) return jsonError("Keine Frames übermittelt.");
    if (files.length > MAX_FRAMES) return jsonError(`Maximal ${MAX_FRAMES} Frames erlaubt.`);

    let timestamps: number[] = [];
    try {
      timestamps = timestampsRaw ? (JSON.parse(String(timestampsRaw)) as number[]) : [];
    } catch {
      return jsonError("timestamps ist kein gültiges JSON.");
    }

    const video = await db.videoAsset.create({
      data: {
        projectId,
        kind,
        durationSec,
        roomTags: roomTagsRaw ? String(roomTagsRaw) : null,
      },
    });

    const dir = path.join(process.cwd(), "data", "uploads", video.id);
    await fs.mkdir(dir, { recursive: true });

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (file.size > MAX_FRAME_BYTES) {
        return jsonError(`Frame ${index + 1} ist zu groß (max. 4 MB).`);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(dir, `frame-${String(index).padStart(3, "0")}.jpg`);
      await fs.writeFile(filePath, buffer);
      await db.frameAsset.create({
        data: {
          videoId: video.id,
          index,
          timestampMs: Math.round(timestamps[index] ?? index * 1500),
          filePath,
          width: 0,
          height: 0,
        },
      });
    }

    return NextResponse.json({ videoId: video.id, frameCount: files.length }, { status: 201 });
  });
}
