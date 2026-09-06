"use client";

// Leitfaden-Seite: der Assistent in voller Länge.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useJourney } from "@/lib/useJourney";
import { JourneyAssistant } from "@/components/journey/JourneyAssistant";

export default function AssistantPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { journey, error, setCheck } = useJourney(projectId);

  if (error) return <div className="card mx-auto max-w-xl text-sm text-terra-deep">{error}</div>;
  if (!journey) return <p className="text-sm text-ink-soft">Wird geladen …</p>;

  return (
    <div className="space-y-4">
      <Link href={`/projects/${projectId}`} className="text-sm text-ink-soft hover:text-ink">
        ← Zur Projektübersicht
      </Link>
      <JourneyAssistant projectId={projectId} journey={journey} onCheck={setCheck} />
    </div>
  );
}
