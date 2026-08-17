// Liefert gespeicherte Frame-Bilder aus data/uploads aus.

import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const frame = await db.frameAsset.findUnique({ where: { id } });
    if (!frame) return jsonError("Frame nicht gefunden.", 404);
    try {
      const data = await fs.readFile(frame.filePath);
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=86400",
        },
      });
    } catch {
      return jsonError("Frame-Datei nicht mehr vorhanden.", 404);
    }
  });
}
