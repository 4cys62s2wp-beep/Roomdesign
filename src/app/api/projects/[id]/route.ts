import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id },
      include: {
        floorPlan: {
          include: {
            rooms: {
              include: {
                proposals: {
                  where: { deletedAt: null },
                  select: { id: true, title: true, isFavorite: true, totalCostEur: true, createdAt: true },
                  orderBy: { createdAt: "desc" },
                },
              },
            },
          },
        },
        videos: { include: { frames: { select: { id: true, index: true, timestampMs: true } } } },
        jobs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!project) return jsonError("Projekt nicht gefunden.", 404);
    return NextResponse.json({
      ...project,
      floorPlan: project.floorPlan
        ? { ...project.floorPlan, data: JSON.parse(project.floorPlan.data) }
        : null,
    });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      address?: string | null;
      globalStyle?: string | null;
    };
    const project = await db.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.address !== undefined ? { address: body.address?.trim() || null } : {}),
        ...(body.globalStyle !== undefined ? { globalStyle: body.globalStyle?.trim() || null } : {}),
      },
    });
    return NextResponse.json(project);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await db.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
