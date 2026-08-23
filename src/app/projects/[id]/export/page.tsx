"use client";

// Designkonzept als druckfertiges Dokument: Deckblatt, Grundriss je Etage,
// ein Kapitel pro Raum und die Einkaufsliste. Über die Druckfunktion des
// Browsers wird daraus ein PDF.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchJson } from "@/lib/client";
import { fmtDate, fmtEur, fmtM2 } from "@/lib/format";
import {
  docForLevel,
  docLevels,
  levelLabel,
  roomAreaM2,
} from "@/lib/geometry/floorplan";
import { ROOM_TYPE_LABELS, type FloorPlanDoc, type ProposalDoc, type RoomType } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { FloorPlanSvg } from "@/components/floorplan/FloorPlanSvg";
import { RoomPreviewSvg } from "@/components/design/RoomPreviewSvg";

interface Project {
  id: string;
  name: string;
  address: string | null;
  globalStyle: string | null;
}
interface FloorPlanResponse {
  data: FloorPlanDoc;
  rooms: Array<{ id: string; key: string; name: string; type: string }>;
}
interface ProposalRow {
  id: string;
  title: string;
  isFavorite: boolean;
  totalCostEur: number;
  data: ProposalDoc;
}
interface Shopping {
  perRoom: Array<{ roomName: string; totalEur: number; proposalTitle: string | null }>;
  totalEur: number;
}

export default function ExportPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [plan, setPlan] = useState<FloorPlanResponse | null>(null);
  const [chosen, setChosen] = useState<Record<string, ProposalRow | undefined>>({});
  const [shopping, setShopping] = useState<Shopping | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [projectData, planData, shoppingData] = await Promise.all([
        fetchJson<Project>(`/api/projects/${projectId}`),
        fetchJson<FloorPlanResponse>(`/api/projects/${projectId}/floorplan`),
        fetchJson<Shopping>(`/api/projects/${projectId}/shopping`),
      ]);
      setProject(projectData);
      setPlan(planData);
      setShopping(shoppingData);

      const byRoomKey: Record<string, ProposalRow | undefined> = {};
      await Promise.all(
        planData.rooms.map(async (room) => {
          const rows = await fetchJson<ProposalRow[]>(`/api/rooms/${room.id}/proposals`);
          byRoomKey[room.key] = rows.find((row) => row.isFavorite) ?? rows[0];
        }),
      );
      setChosen(byRoomKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <div className="card mx-auto max-w-xl text-sm text-terra-deep">{error}</div>;
  if (!project || !plan || !shopping) return <p className="text-sm text-ink-soft">Wird geladen …</p>;

  const levels = docLevels(plan.data);
  const totalArea = plan.data.rooms.reduce((sum, room) => sum + roomAreaM2(room), 0);
  const roomsWithProposal = plan.data.rooms.filter((room) => chosen[room.id]);

  return (
    <div className="mx-auto max-w-3xl" data-testid="export-doc">
      {/* Bedienleiste — im Druck ausgeblendet */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link href={`/projects/${projectId}`} className="text-sm text-ink-soft hover:text-ink">
          ← Zurück zum Projekt
        </Link>
        <button className="btn-terra ml-auto" onClick={() => window.print()} data-testid="print-export">
          Als PDF speichern
        </button>
      </div>
      <div className="no-print mb-8 rounded-xl border border-line bg-sand/60 p-4 text-sm leading-relaxed text-ink-soft">
        Der Knopf öffnet den Druckdialog deines Browsers. Wähle dort als Ziel{" "}
        <strong>„Als PDF sichern"</strong> (macOS) beziehungsweise <strong>„Als PDF speichern"</strong>{" "}
        (Windows). Aktiviere <strong>Hintergrundgrafiken</strong>, damit Farbflächen und Paletten
        mitgedruckt werden.
      </div>

      {/* ---------------- Deckblatt ---------------- */}
      <header className="avoid-break border-b-2 border-ink pb-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-terra uppercase">Designkonzept</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{project.name}</h1>
        {project.address && <p className="mt-1 text-ink-soft">{project.address}</p>}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs tracking-wide text-ink-soft uppercase">Räume</dt>
            <dd className="font-medium">{plan.data.rooms.length}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-ink-soft uppercase">Wohnfläche</dt>
            <dd className="font-medium">{fmtM2(totalArea)}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-ink-soft uppercase">Budget</dt>
            <dd className="font-medium">{fmtEur(shopping.totalEur)}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-ink-soft uppercase">Stand</dt>
            <dd className="font-medium">{fmtDate(new Date())}</dd>
          </div>
        </dl>
        {project.globalStyle && (
          <div className="mt-5 rounded-xl bg-sand/60 p-4">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Roter Faden
            </p>
            <p className="mt-1 text-sm leading-relaxed">{project.globalStyle}</p>
          </div>
        )}
      </header>

      {/* ---------------- Grundriss ---------------- */}
      {levels.map((level) => (
        <section key={level} className="avoid-break mt-8">
          <h2 className="font-display text-2xl font-semibold">
            Grundriss{levels.length > 1 ? ` · ${levelLabel(level)}` : ""}
          </h2>
          <FloorPlanSvg
            doc={docForLevel(plan.data, level)}
            className="mt-3 max-h-[420px] w-full"
          />
        </section>
      ))}

      {/* ---------------- Räume ---------------- */}
      {roomsWithProposal.map((room) => {
        const proposal = chosen[room.id]!;
        const doc = proposal.data;
        return (
          <section key={room.id} className="page-break mt-10" data-testid="export-room">
            <div className="avoid-break">
              <p className="text-xs font-semibold tracking-[0.16em] text-terra uppercase">
                {ROOM_TYPE_LABELS[room.type as RoomType] ?? room.type} · {fmtM2(roomAreaM2(room))}
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold">{room.name}</h2>
              <p className="mt-1 text-ink-soft">
                {doc.title} · {doc.style.join(" · ")}
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <RoomPreviewSvg
                  doc={plan.data}
                  room={room}
                  furniture={doc.furniture}
                  floorColorHex={doc.floor.colorHex}
                  className="max-h-64 w-full rounded-xl border border-line bg-white"
                />
                <div>
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Farbpalette
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {doc.palette.map((color, index) => (
                      <div key={index} className="text-center">
                        <span
                          className="block h-10 w-10 rounded-lg border border-line"
                          style={{ background: color.hex }}
                        />
                        <span className="mt-1 block text-[10px] text-ink-soft">{color.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Materialien
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
                    {doc.materials.map((material, index) => (
                      <li key={index}>
                        <span className="font-medium text-ink">{material.surface}:</span>{" "}
                        {material.material}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="avoid-break mt-4">
              <Markdown text={doc.concept} className="text-ink-soft" />
            </div>

            <div className="avoid-break mt-4">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                Möbel &amp; Leuchten
              </p>
              <table className="mt-2 w-full text-sm">
                <tbody className="divide-y divide-line">
                  {doc.furniture.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1.5">{item.label}</td>
                      <td className="py-1.5 text-right text-xs whitespace-nowrap text-ink-soft">
                        {Math.round(item.wCm)}×{Math.round(item.dCm)}×{Math.round(item.hCm)} cm
                      </td>
                      <td className="py-1.5 pl-3 text-right whitespace-nowrap">
                        {fmtEur(item.estPriceEur)}
                      </td>
                    </tr>
                  ))}
                  {doc.lighting.map((light, index) => (
                    <tr key={`l-${index}`}>
                      <td className="py-1.5 text-ink-soft">{light.name}</td>
                      <td className="py-1.5 text-right text-xs text-ink-soft">{light.note ?? ""}</td>
                      <td className="py-1.5 pl-3 text-right whitespace-nowrap">
                        {light.estPriceEur ? fmtEur(light.estPriceEur) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink/20">
                    <td className="py-2 font-semibold" colSpan={2}>
                      Summe {room.name}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {fmtEur(proposal.totalCostEur)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {doc.tips.length > 0 && (
              <div className="avoid-break mt-4 rounded-xl bg-sand/60 p-4">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Tipps</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
                  {doc.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      {/* ---------------- Budget ---------------- */}
      <section className="page-break mt-10 avoid-break">
        <h2 className="font-display text-2xl font-semibold">Budget nach Räumen</h2>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-line">
            {shopping.perRoom.map((row) => (
              <tr key={row.roomName}>
                <td className="py-2">{row.roomName}</td>
                <td className="py-2 text-ink-soft">{row.proposalTitle ?? "— kein Vorschlag —"}</td>
                <td className="py-2 text-right whitespace-nowrap">{fmtEur(row.totalEur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink">
              <td className="py-2.5 font-display text-lg font-semibold" colSpan={2}>
                Gesamt
              </td>
              <td className="py-2.5 text-right font-display text-lg font-semibold">
                {fmtEur(shopping.totalEur)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p className="mt-8 border-t border-line pt-4 text-xs text-ink-soft">
        Erstellt mit Roomdesign · Maße sind Schätzwerte aus der Videoanalyse und ersetzen kein
        Aufmaß. Preise sind Richtwerte im mittleren Preissegment.
      </p>
    </div>
  );
}
