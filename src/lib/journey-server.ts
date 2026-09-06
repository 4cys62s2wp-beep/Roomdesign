// Brücke zwischen Datenbank und Leitfaden: Baut aus einem Projekt (mit den
// üblichen Prisma-Includes) den JourneyState, den `deriveJourney` versteht.

import type { FloorPlanDoc } from "@/lib/types";
import { deriveJourney, type Journey, type JourneyState } from "@/lib/journey";

interface ProjectLike {
  id: string;
  globalStyle: string | null;
  journeyChecks: string | null;
  videos: Array<{ id: string }>;
  jobs: Array<{ id: string; type: string; status: string; createdAt: Date | string }>;
  floorPlan: {
    data: string | FloorPlanDoc;
    rooms: Array<{
      id: string;
      key: string;
      name: string;
      proposals: Array<{ isFavorite: boolean }>;
    }>;
  } | null;
}

export function parseChecks(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, value]) => value === true),
    ) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function journeyStateFromProject(
  project: ProjectLike,
  provider: JourneyState["provider"],
): JourneyState {
  const doc: FloorPlanDoc | null = project.floorPlan
    ? typeof project.floorPlan.data === "string"
      ? (JSON.parse(project.floorPlan.data) as FloorPlanDoc)
      : project.floorPlan.data
    : null;
  const confirmedByKey = new Map(doc?.rooms.map((room) => [room.id, room.confidence >= 1]) ?? []);

  // Jobs kommen absteigend nach Erstellung — der erste seiner Art ist der jüngste
  const jobs = [...project.jobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestAnalysis = jobs.find((job) => job.type === "analysis") ?? null;
  const isActive = (status: string) => status === "queued" || status === "running";

  return {
    projectId: project.id,
    videoCount: project.videos.length,
    hasPlan: Boolean(project.floorPlan),
    rooms:
      project.floorPlan?.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        confirmed: confirmedByKey.get(room.key) ?? false,
        hasProposals: room.proposals.length > 0,
        hasFavorite: room.proposals.some((proposal) => proposal.isFavorite),
      })) ?? [],
    analysisRunning: latestAnalysis ? isActive(latestAnalysis.status) : false,
    analysisFailed: !project.floorPlan && latestAnalysis?.status === "failed",
    analysisJobId: latestAnalysis?.id ?? null,
    designRunning: jobs.some((job) => job.type === "design" && isActive(job.status)),
    hasGlobalStyle: Boolean(project.globalStyle?.trim()),
    provider,
    checks: parseChecks(project.journeyChecks),
  };
}

export function journeyFromProject(
  project: ProjectLike,
  provider: JourneyState["provider"],
): Journey {
  return deriveJourney(journeyStateFromProject(project, provider));
}
