"use client";

// Projektübersicht: Fortschritt durch den Workflow, Räume mit Vorschlägen,
// globaler Wohnungsstil.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchJson } from "@/lib/client";
import { fmtM2 } from "@/lib/format";
import { ROOM_TYPE_LABELS, type RoomType } from "@/lib/types";
import { deriveJourney, type JourneyState } from "@/lib/journey";
import { JourneyNowCard } from "@/components/journey/JourneyAssistant";

interface ProjectDetail {
  id: string;
  name: string;
  address: string | null;
  globalStyle: string | null;
  floorPlan: {
    id: string;
    version: number;
    source: string;
    rooms: Array<{
      id: string;
      key: string;
      name: string;
      type: string;
      areaM2: number;
      proposals: Array<{ id: string; title: string; isFavorite: boolean; totalCostEur: number }>;
    }>;
  } | null;
  videos: Array<{ id: string; kind: string; frames: Array<{ id: string }> }>;
  jobs: Array<{ id: string; type: string; status: string; statusText: string | null; error: string | null }>;
  journey: JourneyState;
}

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [globalStyle, setGlobalStyle] = useState("");
  const [styleSaved, setStyleSaved] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAddress, setDraftAddress] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<ProjectDetail>(`/api/projects/${projectId}`);
      setProject(data);
      setGlobalStyle(data.globalStyle ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Solange Jobs laufen, regelmäßig aktualisieren
  useEffect(() => {
    if (!project) return;
    const active = project.jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!active) return;
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, [project, load]);

  const startRenaming = () => {
    if (!project) return;
    setDraftName(project.name);
    setDraftAddress(project.address ?? "");
    setRenaming(true);
  };

  const saveName = async () => {
    if (!draftName.trim()) return;
    await fetchJson(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: draftName, address: draftAddress }),
    });
    setRenaming(false);
    await load();
  };

  const setCheck = async (key: string, value: boolean) => {
    setProject((current) =>
      current
        ? { ...current, journey: { ...current.journey, checks: { ...current.journey.checks, [key]: value } } }
        : current,
    );
    await fetchJson(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ journeyChecks: { [key]: value } }),
    });
  };

  const saveGlobalStyle = async () => {
    await fetchJson(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ globalStyle }),
    });
    setStyleSaved(true);
    setTimeout(() => setStyleSaved(false), 2000);
    await load();
  };

  if (error) return <div className="card mx-auto max-w-xl text-sm text-terra-deep">{error}</div>;
  if (!project) return <p className="text-sm text-ink-soft">Wird geladen …</p>;

  const hasPlan = Boolean(project.floorPlan);
  const rooms = project.floorPlan?.rooms ?? [];
  const activeJob = project.jobs.find((job) => job.status === "queued" || job.status === "running");

  const journey = deriveJourney(project.journey);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="max-w-lg space-y-2" data-testid="rename-form">
              <input
                className="input font-display text-xl"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveName();
                  if (event.key === "Escape") setRenaming(false);
                }}
                aria-label="Projektname"
                autoFocus
                data-testid="rename-input"
              />
              <input
                className="input"
                placeholder="Adresse (optional)"
                value={draftAddress}
                onChange={(event) => setDraftAddress(event.target.value)}
                aria-label="Adresse"
              />
              <div className="flex gap-2">
                <button
                  className="btn-primary px-3.5 py-1.5 text-sm"
                  onClick={saveName}
                  disabled={!draftName.trim()}
                  data-testid="rename-save"
                >
                  Speichern
                </button>
                <button
                  className="btn-secondary px-3.5 py-1.5 text-sm"
                  onClick={() => setRenaming(false)}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  {project.name}
                </h1>
                <button
                  className="btn-ghost text-sm"
                  onClick={startRenaming}
                  title="Projekt umbenennen"
                  data-testid="rename-start"
                >
                  Umbenennen
                </button>
              </div>
              {project.address && <p className="text-sm text-ink-soft">{project.address}</p>}
            </>
          )}
        </div>
        {hasPlan && (
          <div className="flex gap-2">
            <Link href={`/projects/${project.id}/view3d`} className="btn-secondary">
              3D-Rundgang
            </Link>
            <Link href={`/projects/${project.id}/shopping`} className="btn-secondary">
              Einkaufsliste
            </Link>
            <Link href={`/projects/${project.id}/export`} className="btn-secondary">
              Konzept als PDF
            </Link>
          </div>
        )}
      </div>

      {activeJob && (
        <div className="card flex items-center gap-3 border-terra/40 bg-terra/5">
          <span className="h-3 w-3 animate-pulse rounded-full bg-terra" />
          <p className="text-sm">
            {activeJob.type === "analysis" ? "Analyse läuft" : "Design wird entworfen"} —{" "}
            {activeJob.statusText ?? "…"}
          </p>
          {activeJob.type === "analysis" && (
            <Link className="ml-auto text-sm underline" href={`/projects/${project.id}/analysis?job=${activeJob.id}`}>
              Fortschritt ansehen
            </Link>
          )}
        </div>
      )}

      <JourneyNowCard projectId={project.id} journey={journey} onCheck={setCheck} />

      {rooms.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Räume</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const favorite = room.proposals.find((p) => p.isFavorite);
              return (
                <Link
                  key={room.id}
                  href={`/projects/${project.id}/rooms/${room.id}/design`}
                  className="card transition hover:border-terra/50"
                  data-testid="room-card"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-display text-lg font-semibold">{room.name}</h3>
                    <span className="badge">{fmtM2(room.areaM2)}</span>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {ROOM_TYPE_LABELS[room.type as RoomType] ?? room.type}
                  </p>
                  <p className="mt-3 text-sm text-ink-soft">
                    {room.proposals.length === 0
                      ? "Noch keine Design-Vorschläge → jetzt entwerfen"
                      : favorite
                        ? `★ ${favorite.title}`
                        : `${room.proposals.length} Vorschläge`}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="card max-w-2xl scroll-mt-20 space-y-3" id="stil">
        <div>
          <h2 className="font-display text-lg font-semibold">Roter Faden fürs ganze Zuhause</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Beschreibe deinen Wunschstil einmal zentral — jeder Raumvorschlag nimmt darauf Rücksicht,
            damit die Wohnung wie aus einem Guss wirkt.
          </p>
        </div>
        <textarea
          className="input min-h-20"
          placeholder="z. B. „Japandi mit warmen Erdtönen, helles Holz, wenige aber hochwertige Möbel, keine kalten Grautöne“"
          value={globalStyle}
          onChange={(event) => setGlobalStyle(event.target.value)}
        />
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={saveGlobalStyle}>
            Stil speichern
          </button>
          {styleSaved && <span className="text-sm text-sage">Gespeichert ✓</span>}
        </div>
      </section>
    </div>
  );
}
