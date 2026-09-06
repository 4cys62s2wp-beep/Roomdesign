// Startseite: die sechs Schritte auf einen Blick, jeder mit seiner Animation.
// Ohne Projektbezug — zeigt, was einen erwartet, bevor man loslegt.

import { DEVICE_LABELS, PHASES } from "@/lib/journey";
import { PhaseIllustration } from "@/components/journey/Illustrations";

export function JourneyOverview() {
  return (
    <section data-testid="journey-overview">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">So funktioniert es — in sechs Schritten</h2>
        <p className="text-sm text-ink-soft">
          Die App führt dich durch jeden Schritt und zeigt, was gerade dran ist.
        </p>
      </div>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PHASES.map((phase, index) => (
          <li key={phase.id} className="card flex flex-col p-0" style={{ "--i": index } as React.CSSProperties}>
            <div className="border-b border-line bg-[#FBF9F3] p-3">
              <PhaseIllustration id={phase.id} className="w-full" />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-semibold text-cream">
                  {index + 1}
                </span>
                <h3 className="font-display text-lg font-semibold">{phase.title}</h3>
              </div>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-soft">{phase.lead}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="badge">{DEVICE_LABELS[phase.device]}</span>
                <span className="badge">{phase.minutes}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
