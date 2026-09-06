import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import { activeProviderName } from "@/lib/ai";
import { journeyFromProject } from "@/lib/journey-server";
import { nextStepLabel } from "@/lib/journey";

export async function GET() {
  return withErrorHandling(async () => {
    const [projects, provider] = await Promise.all([
      db.project.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          floorPlan: {
            include: {
              rooms: {
                include: { proposals: { where: { deletedAt: null }, select: { isFavorite: true } } },
              },
            },
          },
          videos: { select: { id: true } },
          jobs: { orderBy: { createdAt: "desc" }, take: 3 },
        },
      }),
      activeProviderName(),
    ]);
    return NextResponse.json(
      projects.map((p) => {
        const journey = journeyFromProject(p, provider);
        return {
          id: p.id,
          name: p.name,
          address: p.address,
          globalStyle: p.globalStyle,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          roomCount: p.floorPlan?.rooms.length ?? 0,
          videoCount: p.videos.length,
          hasFloorPlan: Boolean(p.floorPlan),
          latestJob: p.jobs[0]
            ? { id: p.jobs[0].id, type: p.jobs[0].type, status: p.jobs[0].status }
            : null,
          // Für die Projektkarte: wo steht dieses Projekt im Leitfaden?
          nextStep: nextStepLabel(journey),
          journeyCompletion: journey.completion,
          currentPhase: journey.current.phase.id,
        };
      }),
    );
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const body = (await request.json()) as { name?: string; address?: string };
    const name = body.name?.trim();
    if (!name) return jsonError("Bitte gib einen Projektnamen an.");
    const project = await db.project.create({
      data: { name, address: body.address?.trim() || null },
    });
    return NextResponse.json(project, { status: 201 });
  });
}
