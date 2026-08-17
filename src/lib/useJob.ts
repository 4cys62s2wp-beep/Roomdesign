"use client";

// Pollt einen Job bis zum Abschluss (Analyse-/Design-Jobs).

import { useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/client";

export interface JobState {
  id: string;
  type: "analysis" | "design";
  status: "queued" | "running" | "succeeded" | "failed";
  step: string | null;
  progress: number;
  statusText: string | null;
  error: string | null;
  result: unknown;
}

export function useJob(jobId: string | null, intervalMs = 1200) {
  const [job, setJob] = useState<JobState | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await fetchJson<JobState>(`/api/jobs/${jobId}`);
        if (cancelled) return;
        setJob(data);
        setPollError(null);
        if (data.status === "queued" || data.status === "running") {
          timerRef.current = setTimeout(poll, intervalMs);
        }
      } catch (error) {
        if (cancelled) return;
        setPollError(error instanceof Error ? error.message : String(error));
        timerRef.current = setTimeout(poll, intervalMs * 2);
      }
    };
    void poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId, intervalMs]);

  return { job, pollError };
}
