"use client";

// Analyse-Fortschritt: pollt den Job und zeigt am Ende die KI-Zusammenfassung.

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useJob } from "@/lib/useJob";
import { Markdown } from "@/components/Markdown";

export default function AnalysisPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Wird geladen …</p>}>
      <AnalysisContent />
    </Suspense>
  );
}

const STEP_LABELS: Record<string, string> = {
  analyzing_rooms: "Räume erkennen",
  estimating_geometry: "Maße schätzen",
  assembling: "Grundriss zusammensetzen",
  saving: "Speichern",
  designing: "Design entwerfen",
};

function AnalysisContent() {
  const { id: projectId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");
  const { job, pollError } = useJob(jobId);

  if (!jobId) {
    return (
      <div className="card mx-auto max-w-xl text-sm">
        Kein Analyse-Job angegeben.{" "}
        <Link href={`/projects/${projectId}/capture`} className="underline">
          Zur Aufnahme
        </Link>
      </div>
    );
  }

  const running = !job || job.status === "queued" || job.status === "running";
  const summary =
    job?.status === "succeeded" && job.result && typeof job.result === "object"
      ? ((job.result as { summary?: string }).summary ?? null)
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">
        {running ? "Deine Wohnung wird analysiert …" : job.status === "succeeded" ? "Analyse abgeschlossen" : "Analyse fehlgeschlagen"}
      </h1>

      {running && (
        <div className="card space-y-4" data-testid="analysis-progress">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-terra" />
            <p className="text-sm font-medium">
              {job?.statusText ?? "Wird gestartet …"}
            </p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full bg-terra transition-all duration-500"
              style={{ width: `${Math.max(4, job?.progress ?? 0)}%` }}
            />
          </div>
          {job?.step && (
            <p className="text-xs text-ink-soft">
              Schritt: {STEP_LABELS[job.step] ?? job.step} · {job.progress}%
            </p>
          )}
          {pollError && <p className="text-xs text-terra-deep">Verbindung: {pollError}</p>}
          <p className="text-xs leading-relaxed text-ink-soft">
            Die KI sichtet die Frames, erkennt Räume, schätzt Maße über Referenzobjekte (z. B.
            Türhöhen) und baut daraus einen Grundriss-Vorschlag. Danach kannst du alles prüfen und
            korrigieren.
          </p>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="card border-terra/40 bg-terra/5">
          <p className="text-sm text-terra-deep">{job.error ?? "Unbekannter Fehler."}</p>
          <div className="mt-4 flex gap-3">
            <Link href={`/projects/${projectId}/capture`} className="btn-primary">
              Neu aufnehmen
            </Link>
            <Link href={`/projects/${projectId}`} className="btn-secondary">
              Zum Projekt
            </Link>
          </div>
        </div>
      )}

      {job?.status === "succeeded" && (
        <>
          {summary && (
            <div className="card" data-testid="analysis-summary">
              <h2 className="font-display text-lg font-semibold">Was die Analyse ergeben hat</h2>
              <Markdown text={summary} className="mt-2 text-ink-soft" />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href={`/projects/${projectId}/floorplan`} className="btn-terra" data-testid="to-floorplan">
              Grundriss prüfen & anpassen
            </Link>
            <Link href={`/projects/${projectId}`} className="btn-secondary">
              Zur Projektübersicht
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
