"use client";

// Der Assistent: zeigt, wo du im Ablauf stehst, was jetzt genau zu tun ist,
// auf welchem Gerät — und führt mit einem Knopf an die richtige Stelle.
//
// Zwei Darstellungen: „full“ für die eigene Seite (alle Phasen, alle
// Unterschritte) und „compact“ als „Jetzt dran“-Karte auf der Projektübersicht.

import { useState } from "react";
import Link from "next/link";
import { DEVICE_LABELS, PHASES, type DerivedPhase, type Journey } from "@/lib/journey";
import { PhaseIllustration } from "@/components/journey/Illustrations";
import { PhoneConnect } from "@/components/journey/PhoneConnect";

const STATUS_LABELS = { done: "Erledigt", current: "Jetzt dran", upcoming: "Kommt später" } as const;

interface Props {
  projectId: string;
  journey: Journey;
  onCheck: (key: string, value: boolean) => void;
}

// ------------------------------------------------------------------ Voll

export function JourneyAssistant({ projectId, journey, onCheck }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    journey.phases.find((entry) => entry.phase.id === selectedId) ?? journey.current;
  const next = journey.phases[selected.index + 1] ?? null;

  return (
    <div className="space-y-6" data-testid="journey">
      {/* Kopf mit Fortschritt */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Leitfaden</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight" data-testid="journey-heading">
            {journey.current.status === "done"
              ? "Alles erledigt"
              : `Schritt ${journey.currentIndex + 1} von ${PHASES.length} · ${journey.current.phase.title}`}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{journey.current.phase.lead}</p>
        </div>
        <ProgressBar completion={journey.completion} />
      </div>

      {/* Stepper */}
      <ol className="jn-stepper" data-testid="journey-stepper">
        {journey.phases.map((entry) => (
          <li key={entry.phase.id}>
            <button
              type="button"
              className={`jn-step jn-step-${entry.status} ${
                entry.phase.id === selected.phase.id ? "jn-step-selected" : ""
              }`}
              onClick={() => setSelectedId(entry.phase.id)}
              aria-current={entry.status === "current" ? "step" : undefined}
              data-testid={`journey-step-${entry.phase.id}`}
              data-status={entry.status}
            >
              <span className="jn-step-num" aria-hidden>
                {entry.status === "done" ? "✓" : entry.index + 1}
              </span>
              <span className="jn-step-title">{entry.phase.title}</span>
              <span className="jn-step-device">{DEVICE_LABELS[entry.phase.device]}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Phasen-Karte */}
      <section
        key={selected.phase.id}
        className="card jn-card-in overflow-hidden p-0"
        data-testid="journey-phase"
        data-phase={selected.phase.id}
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`badge ${
                  selected.status === "current"
                    ? "border-terra/40 bg-terra/10 text-terra-deep"
                    : selected.status === "done"
                      ? "border-sage/50 bg-sage/10 text-sage"
                      : ""
                }`}
              >
                {STATUS_LABELS[selected.status]}
              </span>
              <span className="badge">{DEVICE_LABELS[selected.phase.device]}</span>
              <span className="badge">{selected.phase.minutes}</span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">
              {selected.index + 1} · {selected.phase.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{selected.phase.lead}</p>

            <ol className="mt-5 space-y-2.5" data-testid="journey-substeps">
              {selected.substeps.map((entry, index) => (
                <SubStepRow
                  key={entry.sub.key}
                  entry={entry}
                  index={index}
                  phaseId={selected.phase.id}
                  onCheck={onCheck}
                />
              ))}
            </ol>

            {(selected.phase.id === "prepare" || selected.phase.id === "record") && (
              <div className="mt-5">
                <PhoneConnect projectId={projectId} />
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {selected.cta && (
                <Link href={selected.cta.href} className="btn-terra" data-testid="journey-cta">
                  {selected.cta.label} →
                </Link>
              )}
              {selected.phase.id !== journey.current.phase.id && (
                <button className="btn-secondary" onClick={() => setSelectedId(null)}>
                  Zurück zu „Jetzt dran“
                </button>
              )}
              {next && selected.status !== "done" && (
                <span className="text-sm text-ink-soft">
                  Danach: {next.index + 1} · {next.phase.title}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center border-t border-line bg-[#FBF9F3] p-4 lg:border-t-0 lg:border-l">
            <PhaseIllustration id={selected.phase.id} className="w-full max-w-[360px]" />
          </div>
        </div>
      </section>
    </div>
  );
}

function SubStepRow({
  entry,
  index,
  phaseId,
  onCheck,
}: {
  entry: DerivedPhase["substeps"][number];
  index: number;
  phaseId: string;
  onCheck: Props["onCheck"];
}) {
  const key = `${phaseId}.${entry.sub.key}`;
  const auto = Boolean(entry.sub.auto);
  return (
    <li
      className={`flex gap-3 rounded-xl border p-3 transition-colors ${
        entry.done ? "border-sage/40 bg-sage/5" : "border-line bg-white"
      }`}
      data-testid="journey-substep"
      data-done={entry.done ? "1" : "0"}
    >
      <button
        type="button"
        className={`jn-check-btn ${entry.done ? "jn-check-btn-done" : ""} ${auto ? "cursor-default" : ""}`}
        onClick={() => {
          if (!auto) onCheck(key, !entry.manual);
        }}
        disabled={auto}
        aria-pressed={!auto ? entry.done : undefined}
        aria-label={
          auto
            ? entry.done
              ? "Erledigt — von der App erkannt"
              : "Erkennt die App von selbst"
            : entry.done
              ? "Als offen markieren"
              : "Als erledigt abhaken"
        }
        title={auto ? "Das erkennt die App von selbst" : undefined}
        data-testid="journey-check"
      >
        {entry.done ? "✓" : index + 1}
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium leading-snug">
          <span className={entry.done ? "text-ink-soft line-through decoration-sage/60" : ""}>
            {entry.sub.title}
          </span>
          {entry.sub.optional && <span className="badge py-0 text-[10px]">optional</span>}
          {entry.progress && (
            <span className="badge border-terra/40 py-0 text-[10px] text-terra-deep">
              {entry.progress}
            </span>
          )}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{entry.sub.detail}</p>
        {entry.link && (
          <Link href={entry.link.href} className="mt-1.5 inline-block text-sm text-terra-deep underline">
            {entry.link.label}
          </Link>
        )}
      </div>
    </li>
  );
}

function ProgressBar({ completion }: { completion: number }) {
  const percent = Math.round(completion * 100);
  return (
    <div className="w-full sm:w-56" data-testid="journey-progress">
      <div className="flex justify-between text-xs text-ink-soft">
        <span>Fortschritt</span>
        <span>{percent} %</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
        <div
          className="h-full rounded-full bg-sage transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(3, percent)}%` }}
        />
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Kompakt

export function JourneyNowCard({ projectId, journey, onCheck }: Props) {
  const { current } = journey;
  const open = current.substeps.filter((entry) => !entry.done && !entry.sub.optional).slice(0, 3);
  const allDone = current.status === "done";

  return (
    <section
      className="card jn-card-in overflow-hidden p-0"
      data-testid="journey-now"
      data-phase={current.phase.id}
    >
      <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-5 sm:p-6">
          <p className="label">
            {allDone ? "Leitfaden" : `Jetzt dran · Schritt ${current.index + 1} von ${PHASES.length}`}
          </p>
          <h2 className="font-display text-2xl font-semibold">
            {allDone ? "Alles erledigt" : current.phase.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {allDone
              ? "Grundriss, Einrichtung, Rundgang und Einkaufsliste sind komplett. Für eine weitere Wohnung legst du ein neues Projekt an."
              : current.phase.lead}
          </p>

          {open.length > 0 && (
            <ol className="mt-4 space-y-1.5">
              {open.map((entry) => (
                <li key={entry.sub.key} className="flex items-start gap-2.5 text-sm">
                  <button
                    type="button"
                    className={`jn-check-btn jn-check-btn-sm ${entry.sub.auto ? "cursor-default" : ""}`}
                    disabled={Boolean(entry.sub.auto)}
                    onClick={() => onCheck(`${current.phase.id}.${entry.sub.key}`, true)}
                    aria-label={entry.sub.auto ? "Erkennt die App von selbst" : "Als erledigt abhaken"}
                  >
                    {current.substeps.indexOf(entry) + 1}
                  </button>
                  <span className="leading-snug">
                    {entry.sub.title}
                    {entry.progress && (
                      <span className="ml-2 text-xs text-terra-deep">{entry.progress}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {current.cta && !allDone && (
              <Link href={current.cta.href} className="btn-terra" data-testid="journey-now-cta">
                {current.cta.label} →
              </Link>
            )}
            <Link href={`/projects/${projectId}/assistant`} className="btn-secondary" data-testid="journey-open">
              Ganzer Leitfaden
            </Link>
          </div>

          <MiniStepper journey={journey} />
        </div>
        <div className="flex items-center justify-center border-t border-line bg-[#FBF9F3] p-4 md:border-t-0 md:border-l">
          <PhaseIllustration id={current.phase.id} className="w-full max-w-[260px]" />
        </div>
      </div>
    </section>
  );
}

function MiniStepper({ journey }: { journey: Journey }) {
  return (
    <ol className="mt-5 grid grid-cols-6 gap-1" aria-label="Alle Schritte">
      {journey.phases.map((entry) => (
        <li key={entry.phase.id} className="min-w-0">
          <div
            className={`h-1.5 rounded-full ${
              entry.status === "done"
                ? "bg-sage"
                : entry.status === "current"
                  ? "bg-terra jn-pulse"
                  : "bg-sand"
            }`}
          />
          <p className="mt-1 truncate text-[10px] text-ink-soft">{entry.phase.title}</p>
        </li>
      ))}
    </ol>
  );
}
