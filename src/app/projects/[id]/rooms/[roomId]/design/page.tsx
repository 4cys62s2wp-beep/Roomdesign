"use client";

// Design-Studio für einen Raum: Stilwünsche erfassen, Vorschläge generieren,
// vergleichen, favorisieren und mit Feedback überarbeiten.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client";
import { useJob } from "@/lib/useJob";
import { fmtEur, fmtM2 } from "@/lib/format";
import { STYLE_PRESETS, type FloorPlanDoc, type ProposalDoc } from "@/lib/types";
import { roomAreaM2 } from "@/lib/geometry/floorplan";
import { Markdown } from "@/components/Markdown";
import { RoomPreviewSvg } from "@/components/design/RoomPreviewSvg";

interface FloorPlanResponse {
  data: FloorPlanDoc;
  rooms: Array<{ id: string; key: string; name: string; type: string }>;
}

interface ProposalRow {
  id: string;
  title: string;
  stylePrompt: string | null;
  totalCostEur: number;
  isFavorite: boolean;
  createdAt: string;
  feedback: Array<{ feedback: string; at: string }>;
  data: ProposalDoc & { fitIssues?: string[] };
}

export default function DesignStudioPage() {
  const { id: projectId, roomId } = useParams<{ id: string; roomId: string }>();
  const router = useRouter();

  const [floorPlan, setFloorPlan] = useState<FloorPlanResponse | null>(null);
  const [proposals, setProposals] = useState<ProposalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [stylePrompt, setStylePrompt] = useState("");
  const [presets, setPresets] = useState<string[]>([]);
  const [budget, setBudget] = useState<string>("");
  const [count, setCount] = useState(2);
  const [jobId, setJobId] = useState<string | null>(null);
  const { job } = useJob(jobId);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [refineText, setRefineText] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [plan, rows] = await Promise.all([
        fetchJson<FloorPlanResponse>(`/api/projects/${projectId}/floorplan`),
        fetchJson<ProposalRow[]>(`/api/rooms/${roomId}/proposals`),
      ]);
      setFloorPlan(plan);
      setProposals(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Nach Jobende neu laden
  useEffect(() => {
    if (job?.status === "succeeded" || job?.status === "failed") {
      void load();
      if (job.status === "succeeded") setJobId(null);
    }
  }, [job?.status, load]);

  const roomRow = floorPlan?.rooms.find((r) => r.id === roomId);
  const roomShape = useMemo(
    () => floorPlan?.data.rooms.find((r) => r.id === roomRow?.key) ?? null,
    [floorPlan, roomRow],
  );

  const generate = async () => {
    try {
      const response = await fetchJson<{ jobId: string }>(`/api/rooms/${roomId}/proposals`, {
        method: "POST",
        body: JSON.stringify({
          stylePrompt,
          presets,
          budgetEur: budget ? Number(budget) : null,
          count,
        }),
      });
      setJobId(response.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleFavorite = async (proposal: ProposalRow) => {
    await fetchJson(`/api/proposals/${proposal.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isFavorite: !proposal.isFavorite }),
    });
    await load();
  };

  const removeProposal = async (proposal: ProposalRow) => {
    if (!confirm(`Vorschlag „${proposal.title}" löschen?`)) return;
    await fetchJson(`/api/proposals/${proposal.id}`, { method: "DELETE" });
    await load();
  };

  const refine = async (proposal: ProposalRow) => {
    const feedback = refineText[proposal.id]?.trim();
    if (!feedback) return;
    try {
      const response = await fetchJson<{ jobId: string }>(`/api/proposals/${proposal.id}/refine`, {
        method: "POST",
        body: JSON.stringify({ feedback }),
      });
      setRefineText((current) => ({ ...current, [proposal.id]: "" }));
      setJobId(response.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleCompare = (id: string) => {
    setCompare((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= 2
          ? [current[1], id]
          : [...current, id],
    );
  };

  if (error) {
    return (
      <div className="card mx-auto max-w-xl text-sm">
        <p className="text-terra-deep">{error}</p>
        <Link href={`/projects/${projectId}`} className="mt-3 inline-block underline">
          Zum Projekt
        </Link>
      </div>
    );
  }
  if (!floorPlan || !proposals || !roomRow || !roomShape) {
    return <p className="text-sm text-ink-soft">Wird geladen …</p>;
  }

  const generating = jobId !== null && (!job || job.status === "queued" || job.status === "running");
  const compareRows = compare
    .map((id) => proposals.find((p) => p.id === id))
    .filter((p): p is ProposalRow => Boolean(p));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}`} className="text-sm text-ink-soft hover:text-ink">
            ← Zurück zum Projekt
          </Link>
          <h1 className="font-display text-2xl font-semibold">
            Design-Studio · {roomShape.name}
            <span className="ml-2 align-middle text-sm font-normal text-ink-soft">
              {fmtM2(roomAreaM2(roomShape))}
            </span>
          </h1>
        </div>
        <select
          className="input w-auto"
          value={roomId}
          onChange={(event) =>
            router.push(`/projects/${projectId}/rooms/${event.target.value}/design`)
          }
        >
          {floorPlan.rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>

      {/* ------------------------------------------------ Wunsch-Formular */}
      <section className="card space-y-4">
        <div>
          <p className="label">Stilrichtung wählen (optional, max. 2)</p>
          <div className="flex flex-wrap gap-2">
            {STYLE_PRESETS.map((preset) => {
              const active = presets.includes(preset.id);
              return (
                <button
                  key={preset.id}
                  className={`chip ${active ? "chip-active" : ""}`}
                  title={preset.description}
                  onClick={() =>
                    setPresets((current) =>
                      active
                        ? current.filter((p) => p !== preset.id)
                        : current.length >= 2
                          ? [current[1], preset.id]
                          : [...current, preset.id],
                    )
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="stylePrompt">
            Beschreibe deine Wünsche
          </label>
          <textarea
            id="stylePrompt"
            className="input min-h-20"
            placeholder="z. B. „Gemütlich aber aufgeräumt, viel Holz, Platz für eine große Pflanze, Fernseher brauche ich nicht …“"
            value={stylePrompt}
            onChange={(event) => setStylePrompt(event.target.value)}
            data-testid="style-prompt"
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label" htmlFor="budget">
              Budget (€, optional)
            </label>
            <input
              id="budget"
              type="number"
              className="input w-36"
              placeholder="z. B. 2500"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="count">
              Vorschläge
            </label>
            <select
              id="count"
              className="input w-24"
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
          <button className="btn-terra" onClick={generate} disabled={generating} data-testid="generate-designs">
            {generating ? "KI entwirft …" : "Vorschläge entwerfen"}
          </button>
        </div>
        {generating && (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-terra transition-all duration-500"
                style={{ width: `${Math.max(5, job?.progress ?? 0)}%` }}
              />
            </div>
            <p className="text-xs text-ink-soft">{job?.statusText ?? "Wird gestartet …"}</p>
          </div>
        )}
        {job?.status === "failed" && (
          <p className="text-sm text-terra-deep">Entwurf fehlgeschlagen: {job.error}</p>
        )}
      </section>

      {/* ------------------------------------------------ Vergleich */}
      {compareRows.length === 2 && (
        <section className="card overflow-x-auto">
          <h2 className="mb-3 font-display text-lg font-semibold">Vergleich</h2>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft uppercase">
                <th className="py-1.5 pr-4"></th>
                {compareRows.map((p) => (
                  <th key={p.id} className="py-1.5 pr-4 font-display text-sm normal-case">
                    {p.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="py-2 pr-4 text-ink-soft">Budget</td>
                {compareRows.map((p) => (
                  <td key={p.id} className="py-2 pr-4 font-medium">
                    {fmtEur(p.totalCostEur)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 text-ink-soft">Stil</td>
                {compareRows.map((p) => (
                  <td key={p.id} className="py-2 pr-4">
                    {p.data.style.join(", ")}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 text-ink-soft">Wand / Boden</td>
                {compareRows.map((p) => (
                  <td key={p.id} className="py-2 pr-4">
                    <span className="mr-1 inline-block h-3.5 w-3.5 rounded-full border align-middle" style={{ background: p.data.wallColorHex }} />
                    {p.data.floor.material}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 text-ink-soft">Möbelstücke</td>
                {compareRows.map((p) => (
                  <td key={p.id} className="py-2 pr-4">
                    {p.data.furniture.length}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* ------------------------------------------------ Vorschläge */}
      {proposals.length === 0 ? (
        <div className="card text-sm text-ink-soft">
          Noch keine Vorschläge für diesen Raum. Beschreibe oben deine Wünsche und lass die KI
          entwerfen.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {proposals.map((proposal) => {
            const isOpen = expanded === proposal.id;
            return (
              <article key={proposal.id} className="card space-y-3" data-testid="proposal-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{proposal.title}</h3>
                    <p className="text-xs text-ink-soft">
                      {proposal.data.style.join(" · ")} · {fmtEur(proposal.totalCostEur)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className={`btn-ghost text-lg ${proposal.isFavorite ? "text-terra" : ""}`}
                      title={proposal.isFavorite ? "Favorit entfernen" : "Als Favorit markieren"}
                      onClick={() => toggleFavorite(proposal)}
                      data-testid="favorite-toggle"
                    >
                      {proposal.isFavorite ? "★" : "☆"}
                    </button>
                    <button className="btn-ghost" title="Löschen" onClick={() => removeProposal(proposal)}>
                      ✕
                    </button>
                  </div>
                </div>

                <RoomPreviewSvg
                  doc={floorPlan.data}
                  room={roomShape}
                  furniture={proposal.data.furniture}
                  floorColorHex={proposal.data.floor.colorHex}
                  className="max-h-64 w-full rounded-xl border border-line bg-white"
                />

                <div className="flex items-center gap-1.5">
                  {proposal.data.palette.slice(0, 6).map((color, index) => (
                    <span
                      key={index}
                      title={`${color.name} (${color.role})`}
                      className="h-6 w-6 rounded-full border border-line"
                      style={{ background: color.hex }}
                    />
                  ))}
                  <span className="ml-auto flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <input
                        type="checkbox"
                        className="accent-terra"
                        checked={compare.includes(proposal.id)}
                        onChange={() => toggleCompare(proposal.id)}
                      />
                      Vergleichen
                    </label>
                    <Link
                      href={`/projects/${projectId}/view3d?proposal=${proposal.id}`}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      In 3D ansehen
                    </Link>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => setExpanded(isOpen ? null : proposal.id)}
                    >
                      {isOpen ? "Weniger" : "Details"}
                    </button>
                  </span>
                </div>

                {proposal.data.fitIssues && proposal.data.fitIssues.length > 0 && (
                  <div className="rounded-xl bg-sand px-3 py-2 text-xs text-ink-soft">
                    {proposal.data.fitIssues.map((issue, index) => (
                      <p key={index}>⚠ {issue}</p>
                    ))}
                  </div>
                )}

                {isOpen && (
                  <div className="space-y-4 border-t border-line pt-3">
                    <Markdown text={proposal.data.concept} className="text-ink-soft" />

                    <div>
                      <h4 className="label">Möbel & Preise</h4>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-line">
                          {proposal.data.furniture.map((item) => (
                            <tr key={item.id}>
                              <td className="py-1.5 pr-2">
                                <span
                                  className="mr-2 inline-block h-3 w-3 rounded-sm border border-line align-middle"
                                  style={{ background: item.colorHex }}
                                />
                                {item.label}
                              </td>
                              <td className="py-1.5 pr-2 text-right text-xs whitespace-nowrap text-ink-soft">
                                {Math.round(item.wCm)}×{Math.round(item.dCm)} cm
                              </td>
                              <td className="py-1.5 text-right font-medium whitespace-nowrap">
                                {fmtEur(item.estPriceEur)}
                              </td>
                            </tr>
                          ))}
                          {proposal.data.lighting.map((light, index) => (
                            <tr key={`light-${index}`}>
                              <td className="py-1.5 pr-2 text-ink-soft">💡 {light.name}</td>
                              <td className="py-1.5 pr-2 text-right text-xs text-ink-soft">
                                {light.note ?? ""}
                              </td>
                              <td className="py-1.5 text-right whitespace-nowrap">
                                {light.estPriceEur ? fmtEur(light.estPriceEur) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-ink/20">
                            <td className="py-2 font-semibold">Gesamt</td>
                            <td />
                            <td className="py-2 text-right font-semibold">
                              {fmtEur(proposal.totalCostEur)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                      {proposal.data.budget.note && (
                        <p className="mt-1 text-xs text-ink-soft">{proposal.data.budget.note}</p>
                      )}
                    </div>

                    <div>
                      <h4 className="label">Materialien</h4>
                      <ul className="space-y-1 text-sm text-ink-soft">
                        {proposal.data.materials.map((material, index) => (
                          <li key={index}>
                            <span className="font-medium text-ink">{material.surface}:</span>{" "}
                            {material.material}
                            {material.note ? ` — ${material.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {proposal.data.tips.length > 0 && (
                      <div>
                        <h4 className="label">Tipps</h4>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                          {proposal.data.tips.map((tip, index) => (
                            <li key={index}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {proposal.feedback.length > 0 && (
                      <div>
                        <h4 className="label">Überarbeitungs-Verlauf</h4>
                        <ul className="space-y-1 text-xs text-ink-soft">
                          {proposal.feedback.map((entry, index) => (
                            <li key={index}>„{entry.feedback}"</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 border-t border-line pt-3">
                  <input
                    className="input py-2"
                    placeholder="Überarbeiten: z. B. „mehr Holz, weniger Deko“"
                    value={refineText[proposal.id] ?? ""}
                    onChange={(event) =>
                      setRefineText((current) => ({ ...current, [proposal.id]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void refine(proposal);
                    }}
                  />
                  <button
                    className="btn-secondary shrink-0"
                    onClick={() => refine(proposal)}
                    disabled={generating || !(refineText[proposal.id] ?? "").trim()}
                  >
                    Überarbeiten
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
