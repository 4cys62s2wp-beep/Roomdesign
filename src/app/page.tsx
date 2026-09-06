"use client";

// Dashboard: Projektliste + neues Projekt anlegen.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { JourneyOverview } from "@/components/journey/JourneyOverview";

interface ProjectListItem {
  id: string;
  name: string;
  address: string | null;
  updatedAt: string;
  roomCount: number;
  videoCount: number;
  hasFloorPlan: boolean;
  latestJob: { id: string; type: string; status: string } | null;
  nextStep: string;
  journeyCompletion: number;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      setProjects(await fetchJson<ProjectListItem[]>("/api/projects"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await fetchJson<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      // Direkt in den Leitfaden: Der sagt, was als Erstes zu tun ist
      router.push(`/projects/${project.id}/assistant`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  };

  const deleteProject = async (id: string, projectName: string) => {
    if (!confirm(`Projekt „${projectName}" wirklich löschen? Alle Daten gehen verloren.`)) return;
    try {
      await fetchJson(`/api/projects/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-8">
      <section className="card bg-gradient-to-br from-white to-sand">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Deine neue Wohnung, fertig gedacht.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Nimm einen Video-Rundgang durch die leere Wohnung auf. Die KI erkennt Räume, schätzt die
          Maße und entwirft komplette Einrichtungsvorschläge – mit Grundriss-Editor, 3D-Vorschau,
          Farbpaletten, Möbellisten und Budget.
        </p>
        <form onSubmit={createProject} className="mt-5 flex max-w-xl flex-col gap-2 sm:flex-row">
          <input
            className="input"
            placeholder="Name der Wohnung, z. B. „Neue Wohnung Leopoldstraße“"
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-testid="new-project-name"
          />
          <button className="btn-terra shrink-0" disabled={creating || !name.trim()} data-testid="new-project-submit">
            {creating ? "Wird angelegt …" : "Projekt starten"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-terra-deep">{error}</p>}
      </section>

      {/* Wer noch kein Projekt hat, soll zuerst sehen, was ihn erwartet */}
      {projects !== null && projects.length === 0 && <JourneyOverview />}

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Projekte</h2>
        {projects === null ? (
          <p className="text-sm text-ink-soft">Wird geladen …</p>
        ) : projects.length === 0 ? (
          <div className="card text-sm text-ink-soft">
            Noch keine Projekte. Lege oben dein erstes Wohnungsprojekt an — im Demo-Modus kannst du
            alles ohne Video und ohne API-Key ausprobieren.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="card flex flex-col justify-between gap-3" data-testid="project-card">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-display text-lg font-semibold hover:text-terra-deep"
                    >
                      {project.name}
                    </Link>
                    <button
                      className="btn-ghost -mt-1 -mr-1 text-xs"
                      onClick={() => deleteProject(project.id, project.name)}
                      title="Projekt löschen"
                    >
                      Löschen
                    </button>
                  </div>
                  {project.address && <p className="text-xs text-ink-soft">{project.address}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-terra-deep" data-testid="project-next-step">
                      {project.nextStep}
                    </span>
                    <span className="text-ink-soft">{Math.round(project.journeyCompletion * 100)} %</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-sage" style={{ width: `${Math.max(3, project.journeyCompletion * 100)}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="badge">{project.roomCount} Räume</span>
                  <span className="badge">{project.videoCount} Videos</span>
                  {project.hasFloorPlan && <span className="badge">Grundriss ✓</span>}
                  {project.latestJob && (project.latestJob.status === "running" || project.latestJob.status === "queued") && (
                    <span className="badge border-terra/40 text-terra-deep">KI arbeitet …</span>
                  )}
                </div>
                <div className="text-xs text-ink-soft/70">Zuletzt geändert: {fmtDate(project.updatedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {projects !== null && projects.length > 0 && <JourneyOverview />}
    </div>
  );
}
