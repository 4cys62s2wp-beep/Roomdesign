import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import { validateFloorPlan } from "@/lib/geometry/floorplan";
import { saveFloorPlan } from "@/lib/jobs/analysis";
import type { FloorPlanDoc } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id: projectId } = await params;
    const floorPlan = await db.floorPlan.findUnique({
      where: { projectId },
      include: { rooms: true },
    });
    if (!floorPlan) return jsonError("Noch kein Grundriss vorhanden.", 404);
    return NextResponse.json({
      id: floorPlan.id,
      projectId: floorPlan.projectId,
      source: floorPlan.source,
      version: floorPlan.version,
      updatedAt: floorPlan.updatedAt,
      data: JSON.parse(floorPlan.data) as FloorPlanDoc,
      rooms: floorPlan.rooms,
    });
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id: projectId } = await params;
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return jsonError("Projekt nicht gefunden.", 404);

    const body = (await request.json()) as { data?: FloorPlanDoc };
    if (!body.data || !Array.isArray(body.data.rooms)) {
      return jsonError("Ungültiger Grundriss.");
    }
    const issues = validateFloorPlan(body.data);
    const errors = issues.filter((issue) => issue.level === "error");
    if (errors.length > 0) {
      return jsonError(`Grundriss ungültig: ${errors.map((e) => e.message).join("; ")}`);
    }

    const floorPlan = await saveFloorPlan(projectId, body.data, "manual");
    return NextResponse.json({
      id: floorPlan.id,
      version: floorPlan.version,
      warnings: issues.filter((issue) => issue.level === "warning").map((w) => w.message),
    });
  });
}
