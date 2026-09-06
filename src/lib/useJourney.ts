"use client";

// Lädt den Leitfaden-Stand eines Projekts, aktualisiert ihn, solange die KI
// arbeitet, und speichert Haken am Projekt — damit Mac und Handy dasselbe sehen.

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/client";
import { deriveJourney, type JourneyState } from "@/lib/journey";

export function useJourney(projectId: string) {
  const [state, setState] = useState<JourneyState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await fetchJson<{ journey: JourneyState }>(`/api/projects/${projectId}`);
      setState(data.journey);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Während Analyse oder Design laufen, regelmäßig nachsehen
  useEffect(() => {
    if (!state || !(state.analysisRunning || state.designRunning)) return;
    const timer = setInterval(() => void reload(), 2500);
    return () => clearInterval(timer);
  }, [state, reload]);

  const setCheck = useCallback(
    async (key: string, value: boolean) => {
      // Sofort anzeigen, dann speichern — der Haken soll sich nicht zäh anfühlen
      setState((current) =>
        current ? { ...current, checks: { ...current.checks, [key]: value } } : current,
      );
      try {
        await fetchJson(`/api/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({ journeyChecks: { [key]: value } }),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        await reload();
      }
    },
    [projectId, reload],
  );

  const journey = useMemo(() => (state ? deriveJourney(state) : null), [state]);
  return { state, journey, error, reload, setCheck };
}
