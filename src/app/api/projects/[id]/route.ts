import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";
import { activeProviderName } from "@/lib/ai";
import { journeyStateFromProject, parseChecks } from "@/lib/journey-server";

type Params = { params: Promise<{ id: string }> };

// Haken werden gelesen, zusammengeführt, geschrieben. Zwei schnelle Klicks
// hintereinander dürfen sich dabei nicht gegenseitig überschreiben — die
// Zusammenführungen laufen deshalb nacheinander. Ein Prozess, ein Nutzer:
// eine einfache Warteschlange genügt.
let checksQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const run = checksQueue.then(work, work);
  checksQueue = run.catch(() => undefined);
  return run;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const [project, provider] = await Promise.all([
      db.project.findUnique({
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
      }),
      activeProviderName(),
    ]);
    if (!project) return jsonError("Projekt nicht gefunden.", 404);
    return NextResponse.json({
      ...project,
      journeyChecks: parseChecks(project.journeyChecks),
      // Der Leitfaden-Stand wird hier zentral abgeleitet, damit Mac und Handy
      // dieselbe Antwort bekommen.
      journey: journeyStateFromProject(project, provider),
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
      /** Haken des Leitfadens — werden mit dem Bestand zusammengeführt. */
      journeyChecks?: Record<string, boolean>;
    };

    const update = async () => {
      let mergedChecks: string | undefined;
      if (body.journeyChecks !== undefined) {
        const current = await db.project.findUnique({ where: { id }, select: { journeyChecks: true } });
        if (!current) return null;
        const merged = { ...parseChecks(current.journeyChecks) };
        for (const [key, value] of Object.entries(body.journeyChecks)) {
          if (value) merged[key] = true;
          else delete merged[key];
        }
        mergedChecks = JSON.stringify(merged);
      }
      return db.project.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.address !== undefined ? { address: body.address?.trim() || null } : {}),
          ...(body.globalStyle !== undefined ? { globalStyle: body.globalStyle?.trim() || null } : {}),
          ...(mergedChecks !== undefined ? { journeyChecks: mergedChecks } : {}),
        },
      });
    };

    const project = body.journeyChecks !== undefined ? await serialized(update) : await update();
    if (!project) return jsonError("Projekt nicht gefunden.", 404);
    return NextResponse.json({ ...project, journeyChecks: parseChecks(project.journeyChecks) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await db.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
