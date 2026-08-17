"use client";

import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";

const ApartmentViewer = dynamic(
  () => import("@/components/three/ApartmentViewer").then((m) => m.ApartmentViewer),
  { ssr: false, loading: () => <p className="text-sm text-ink-soft">3D-Ansicht wird geladen …</p> },
);

export default function View3DPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Wird geladen …</p>}>
      <View3DContent />
    </Suspense>
  );
}

function View3DContent() {
  const { id: projectId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  return (
    <div className="space-y-4">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-ink-soft hover:text-ink">
          ← Zurück zum Projekt
        </Link>
        <h1 className="font-display text-2xl font-semibold">3D-Rundgang</h1>
      </div>
      <ApartmentViewer projectId={projectId} initialProposalId={searchParams.get("proposal")} />
    </div>
  );
}
