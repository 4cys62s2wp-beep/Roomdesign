"use client";

// Einkaufsliste & Budget: aggregiert pro Raum den favorisierten (sonst
// neuesten) Vorschlag. CSV-Export und Druckansicht (PDF über den Browser).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchJson } from "@/lib/client";
import { fmtEur } from "@/lib/format";

interface ShoppingItem {
  roomName: string;
  proposalTitle: string;
  label: string;
  category: string;
  dimensions: string;
  priceEur: number;
  searchQuery: string;
}

interface ShoppingResponse {
  items: ShoppingItem[];
  perRoom: Array<{
    roomId: string;
    roomName: string;
    proposalId: string | null;
    proposalTitle: string | null;
    totalEur: number;
  }>;
  totalEur: number;
}

export default function ShoppingPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<ShoppingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchJson<ShoppingResponse>(`/api/projects/${projectId}/shopping`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [projectId]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, ShoppingItem[]>();
    for (const item of data.items) {
      const list = map.get(item.roomName) ?? [];
      list.push(item);
      map.set(item.roomName, list);
    }
    return [...map.entries()];
  }, [data]);

  if (error) return <div className="card mx-auto max-w-xl text-sm text-terra-deep">{error}</div>;
  if (!data) return <p className="text-sm text-ink-soft">Wird geladen …</p>;

  const maxRoomTotal = Math.max(1, ...data.perRoom.map((room) => room.totalEur));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}`} className="text-sm text-ink-soft hover:text-ink no-print">
            ← Zurück zum Projekt
          </Link>
          <h1 className="font-display text-2xl font-semibold">Einkaufsliste & Budget</h1>
          <p className="text-sm text-ink-soft">
            Basis: der favorisierte (★) bzw. neueste Vorschlag jedes Raums.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <a href={`/api/projects/${projectId}/shopping?format=csv`} className="btn-secondary" download>
            CSV exportieren
          </a>
          <Link href={`/projects/${projectId}/export`} className="btn-secondary">
            Konzept als PDF
          </Link>
          <button className="btn-secondary" onClick={() => window.print()}>
            Liste drucken
          </button>
        </div>
      </div>

      {/* Budget-Übersicht */}
      <section className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Gesamtbudget</h2>
          <span className="font-display text-2xl font-semibold text-terra-deep" data-testid="total-budget">
            {fmtEur(data.totalEur)}
          </span>
        </div>
        <div className="mt-4 space-y-2.5">
          {data.perRoom.map((room) => (
            <div key={room.roomId}>
              <div className="flex justify-between text-sm">
                <span>
                  {room.roomName}
                  {room.proposalTitle && (
                    <span className="text-ink-soft"> · {room.proposalTitle}</span>
                  )}
                </span>
                <span className="font-medium">
                  {room.proposalId ? fmtEur(room.totalEur) : "— kein Vorschlag —"}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
                <div
                  className="h-full rounded-full bg-sage"
                  style={{ width: `${(room.totalEur / maxRoomTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Artikelliste */}
      {grouped.length === 0 ? (
        <div className="card text-sm text-ink-soft">
          Noch keine Artikel — generiere zuerst Design-Vorschläge und markiere deine Favoriten.
        </div>
      ) : (
        grouped.map(([roomName, items]) => (
          <section key={roomName} className="card overflow-x-auto">
            <h2 className="mb-2 font-display text-lg font-semibold">{roomName}</h2>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft uppercase">
                  <th className="py-1.5 pr-3">Artikel</th>
                  <th className="py-1.5 pr-3">Kategorie</th>
                  <th className="py-1.5 pr-3">Maße</th>
                  <th className="py-1.5 pr-3">Suchbegriff</th>
                  <th className="py-1.5 text-right">Preis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2 pr-3 font-medium">{item.label}</td>
                    <td className="py-2 pr-3 text-ink-soft">{item.category}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-soft">{item.dimensions}</td>
                    <td className="py-2 pr-3 text-ink-soft">
                      <span className="no-print">
                        <a
                          className="underline decoration-line hover:text-ink"
                          href={`https://www.google.com/search?q=${encodeURIComponent(item.searchQuery)}&tbm=shop`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.searchQuery}
                        </a>
                      </span>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">{fmtEur(item.priceEur)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink/20">
                  <td className="py-2 font-semibold" colSpan={4}>
                    Zwischensumme
                  </td>
                  <td className="py-2 text-right font-semibold">
                    {fmtEur(items.reduce((sum, item) => sum + item.priceEur, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        ))
      )}

      <p className="text-xs text-ink-soft">
        Preise sind KI-Schätzungen im mittleren Preissegment und dienen der Orientierung.
      </p>
    </div>
  );
}
