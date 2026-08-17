"use client";

// Aufnahme-Anleitung: der verbindliche Standard für jeden Rundgang.

import Link from "next/link";
import { useParams } from "next/navigation";
import { GUIDE_SECTIONS, QUICK_CHECKLIST, RECORDING_TARGETS } from "@/lib/capture-guide";
import { RoomProtocolDiagram } from "@/components/capture/RoomProtocolDiagram";

export default function CaptureGuidePage() {
  const { id: projectId } = useParams<{ id: string }>();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href={`/projects/${projectId}/capture`} className="text-sm text-ink-soft hover:text-ink no-print">
          ← Zurück zur Aufnahme
        </Link>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          So filmst du deine Wohnung
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Die KI schätzt die Raummaße aus einzelnen Standbildern deines Videos — als Maßstab dienen
          ihr bekannte Objekte wie Türen. Damit das zuverlässig funktioniert und zwei Aufnahmen
          vergleichbar bleiben, sollte jedes Video nach dem gleichen Muster entstehen. Die folgenden
          Vorgaben sind bewusst eindeutig gehalten: Wo es eine beste Einstellung gibt, steht genau
          diese hier.
        </p>
      </div>

      {/* Kurzfassung */}
      <section className="card bg-gradient-to-br from-white to-sand">
        <h2 className="font-display text-lg font-semibold">Das Wichtigste auf einen Blick</h2>
        <ul className="mt-3 space-y-1.5">
          {QUICK_CHECKLIST.map((entry) => (
            <li key={entry} className="flex gap-2.5 text-sm">
              <span className="mt-0.5 text-terra">✓</span>
              <span>{entry}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Diagramm des Raum-Ablaufs */}
      <section className="card">
        <h2 className="font-display text-lg font-semibold">Der Ablauf in jedem Raum</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Immer gleich, rund {RECORDING_TARGETS.perRoomSec} Sekunden pro Raum.
        </p>
        <RoomProtocolDiagram className="mt-4 w-full" />
      </section>

      {/* Ausführliche Abschnitte */}
      {GUIDE_SECTIONS.map((section) => (
        <section key={section.id} className="card">
          <h2 className="font-display text-xl font-semibold">{section.title}</h2>
          {section.intro && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{section.intro}</p>}
          <dl className="mt-4 space-y-4">
            {section.items.map((item) => (
              <div key={item.title} className="border-l-2 border-line pl-4">
                <dt className="font-medium">{item.title}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink-soft">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {/* Warum die Längenvorgabe */}
      <section className="card border-sage/50 bg-sage/5">
        <h2 className="font-display text-lg font-semibold">Warum die Länge begrenzt ist</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Die App zieht aus deinem Video {RECORDING_TARGETS.extractedFrames} gleichmäßig verteilte
          Standbilder und schickt nur diese zur Analyse — das Video selbst verlässt dein Gerät nie.
          Bei drei Minuten Länge entspricht das etwa alle sechs Sekunden einem Bild, also gut fünf
          Bildern pro Raum. Wird das Video doppelt so lang, halbiert sich diese Zahl, und einzelne
          Räume können ganz durchrutschen. Lieber ruhig und vollständig in drei Minuten filmen als
          hektisch in zehn.
        </p>
      </section>

      <div className="flex flex-wrap gap-3 no-print">
        <Link href={`/projects/${projectId}/capture`} className="btn-terra">
          Alles klar — zur Aufnahme
        </Link>
        <button className="btn-secondary" onClick={() => window.print()}>
          Anleitung drucken
        </button>
      </div>
    </div>
  );
}
