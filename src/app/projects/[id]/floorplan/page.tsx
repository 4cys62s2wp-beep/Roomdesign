"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FloorPlanEditor } from "@/components/floorplan/FloorPlanEditor";

export default function FloorPlanPage() {
  const { id: projectId } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/projects/${projectId}`} className="text-sm text-ink-soft hover:text-ink">
            ← Zurück zum Projekt
          </Link>
          <h1 className="font-display text-2xl font-semibold">Grundriss-Editor</h1>
        </div>
      </div>
      <FloorPlanEditor projectId={projectId} />
    </div>
  );
}
