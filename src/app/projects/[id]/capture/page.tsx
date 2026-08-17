"use client";

// Video-Aufnahme & Upload: MediaRecorder mit Codec-Erkennung, Raum-Tagging
// während der Aufnahme, Live-Begleitung nach dem Aufnahme-Standard,
// clientseitige Frame-Extraktion und Frame-Upload.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client";
import { extractFramesFromBlob, pickRecorderMimeType } from "@/lib/frames/extract-client";
import {
  QUICK_CHECKLIST,
  RECORDING_TARGETS,
  ROOM_STEPS,
  currentRoomStep,
  currentRoomStepIndex,
  durationVerdict,
} from "@/lib/capture-guide";
import type { RoomTag } from "@/lib/types";

const TAG_SUGGESTIONS = ["Gang", "Wohnzimmer", "Küche", "Schlafzimmer", "Bad", "WC", "Balkon", "Büro"];
const GUIDE_SEEN_KEY = "roomdesign.captureGuideSeen";

type Phase =
  | { name: "idle" }
  | { name: "recording"; startedAt: number }
  | { name: "processing"; text: string; progress: number | null }
  | { name: "error"; message: string };

function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

export default function CapturePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [tags, setTags] = useState<RoomTag[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [hints, setHints] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [guideSeen, setGuideSeen] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(false);

  // Live-Begleitung: aktueller Raum und wann er betreten wurde
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [roomEnteredAt, setRoomEnteredAt] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);

  useEffect(() => {
    void fetchJson<{ activeProvider: string }>("/api/settings")
      .then((settings) => setIsDemo(settings.activeProvider === "demo"))
      .catch(() => {});
    setCameraSupported(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== "undefined",
    );
    try {
      setGuideSeen(localStorage.getItem(GUIDE_SEEN_KEY) === "1");
    } catch {
      setGuideSeen(true);
    }
    return () => stopStream();
  }, []);

  useEffect(() => {
    if (phase.name !== "recording") return;
    const timer = setInterval(() => setElapsed(Date.now() - phase.startedAt), 500);
    return () => clearInterval(timer);
  }, [phase]);

  const markGuideSeen = () => {
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {
      // Privater Modus o. Ä. – dann eben bei jedem Besuch erneut anbieten
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
      setTags([]);
      setElapsed(0);
      setCurrentRoom(null);
      setRoomEnteredAt(0);
      markGuideSeen();
      setPhase({ name: "recording", startedAt: Date.now() });
    } catch {
      setPhase({
        name: "error",
        message:
          "Kamera-Zugriff nicht möglich. Erteile die Berechtigung, rufe die Seite über HTTPS auf (npm run dev:https) oder lade unten ein Video hoch.",
      });
    }
  };

  const enterRoom = (label: string) => {
    if (phase.name !== "recording") return;
    const timestampMs = Date.now() - recordStartRef.current;
    setTags((prev) => [...prev, { timestampMs, label }]);
    setCurrentRoom(label);
    setRoomEnteredAt(timestampMs);
  };

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const mimeType = recorder.mimeType || "video/webm";
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;
    stopStream();
    if (videoRef.current) videoRef.current.srcObject = null;
    const blob = new Blob(chunksRef.current, { type: mimeType });
    await processVideo(blob, "recorded", tags);
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await processVideo(file, "uploaded", []);
  };

  const processVideo = async (blob: Blob, kind: "recorded" | "uploaded", videoTags: RoomTag[]) => {
    try {
      setPhase({ name: "processing", text: "Frames werden aus dem Video gezogen …", progress: 0 });
      const extracted = await extractFramesFromBlob(blob, {
        maxFrames: RECORDING_TARGETS.extractedFrames,
        onProgress: (done, total) =>
          setPhase({
            name: "processing",
            text: `Frames werden aus dem Video gezogen … (${done}/${total})`,
            progress: Math.round((done / total) * 60),
          }),
      });

      setPhase({ name: "processing", text: "Frames werden hochgeladen …", progress: 70 });
      const form = new FormData();
      form.set("kind", kind);
      form.set("durationSec", String(extracted.durationSec));
      form.set("timestamps", JSON.stringify(extracted.timestampsMs));
      if (videoTags.length > 0) form.set("roomTags", JSON.stringify(videoTags));
      extracted.blobs.forEach((frame, index) => {
        form.append("frames", frame, `frame-${index}.jpg`);
      });
      const upload = await fetchJson<{ videoId: string }>(`/api/projects/${projectId}/frames`, {
        method: "POST",
        body: form,
      });

      setPhase({ name: "processing", text: "Analyse wird gestartet …", progress: 90 });
      const analysis = await fetchJson<{ jobId: string }>(`/api/projects/${projectId}/analyze`, {
        method: "POST",
        body: JSON.stringify({ videoId: upload.videoId, userHints: hints || undefined }),
      });
      router.push(`/projects/${projectId}/analysis?job=${analysis.jobId}`);
    } catch (error) {
      setPhase({
        name: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const startDemoAnalysis = async () => {
    try {
      setPhase({ name: "processing", text: "Demo-Analyse wird gestartet …", progress: 50 });
      const analysis = await fetchJson<{ jobId: string }>(`/api/projects/${projectId}/analyze`, {
        method: "POST",
        body: JSON.stringify({ userHints: hints || undefined }),
      });
      router.push(`/projects/${projectId}/analysis?job=${analysis.jobId}`);
    } catch (error) {
      setPhase({ name: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const busy = phase.name === "processing";
  const recording = phase.name === "recording";

  // Live-Begleitung berechnen
  const secondsInRoom = recording ? Math.max(0, (elapsed - roomEnteredAt) / 1000) : 0;
  const step = currentRoomStep(secondsInRoom);
  const stepNumber = currentRoomStepIndex(secondsInRoom) + 1;
  const totalSec = elapsed / 1000;
  const verdict = durationVerdict(totalSec);
  const targetPct = Math.min(100, (totalSec / RECORDING_TARGETS.totalWarnSec) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-ink-soft hover:text-ink">
          ← Zurück zum Projekt
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold">Wohnungs-Rundgang aufnehmen</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Das Video verlässt dein Gerät nicht: Es werden nur einzelne Standbilder hochgeladen.
          Damit die Maßschätzung verlässlich wird, folge bitte dem Aufnahme-Standard.
        </p>
      </div>

      {/* Anleitung: beim ersten Mal prominent, danach als Kurzfassung */}
      {!guideSeen && !recording && !busy && (
        <section className="card border-terra/40 bg-terra/5" data-testid="guide-callout">
          <h2 className="font-display text-lg font-semibold">Zuerst: die Aufnahme-Anleitung</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Zwei Minuten Lesen entscheiden darüber, ob die Maße brauchbar werden. Darin steht
            genau, welches Objektiv, welche Auflösung, welches Tempo und welche Länge du wählen
            sollst — damit jede Aufnahme vergleichbar ist.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/projects/${projectId}/capture/guide`}
              className="btn-terra"
              onClick={markGuideSeen}
              data-testid="open-guide"
            >
              Anleitung ansehen
            </Link>
            <button
              className="btn-secondary"
              onClick={() => {
                markGuideSeen();
                setGuideSeen(true);
              }}
            >
              Kenne ich schon
            </button>
          </div>
        </section>
      )}

      {!recording && !busy && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Einstellungen vor dem Start</h2>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setChecklistOpen((open) => !open)}>
                {checklistOpen ? "Einklappen" : "Checkliste"}
              </button>
              <Link
                href={`/projects/${projectId}/capture/guide`}
                className="btn-secondary px-3 py-1.5 text-sm"
                onClick={markGuideSeen}
              >
                Ganze Anleitung
              </Link>
            </div>
          </div>
          {checklistOpen ? (
            <ul className="mt-3 space-y-1.5">
              {QUICK_CHECKLIST.map((entry) => (
                <li key={entry} className="flex gap-2.5 text-sm">
                  <span className="mt-0.5 text-terra">✓</span>
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              Kurz: Objektiv <strong>1×</strong> (nicht 0,5×), <strong>1080p / 30 fps</strong>, Handy{" "}
              <strong>quer</strong> auf Brusthöhe, ein Schritt pro Sekunde, volle Drehung in{" "}
              <strong>20 Sekunden</strong>, insgesamt <strong>2–4 Minuten</strong>.
            </p>
          )}
        </section>
      )}

      {phase.name === "error" && (
        <div className="card border-terra/40 bg-terra/5 text-sm text-terra-deep">
          {phase.message}
          <button className="btn-secondary mt-3 block" onClick={() => setPhase({ name: "idle" })}>
            Erneut versuchen
          </button>
        </div>
      )}

      {busy && (
        <div className="card space-y-3">
          <p className="text-sm font-medium">{(phase as Extract<Phase, { name: "processing" }>).text}</p>
          <div className="h-2 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full bg-terra transition-all"
              style={{ width: `${(phase as Extract<Phase, { name: "processing" }>).progress ?? 50}%` }}
            />
          </div>
        </div>
      )}

      {!busy && phase.name !== "error" && (
        <>
          <section className="card space-y-4">
            <div className="relative overflow-hidden rounded-xl bg-ink">
              <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
              {recording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  {formatClock(elapsed)}
                </div>
              )}
              {!recording && (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-cream/70">
                  {cameraSupported
                    ? "Kamera-Vorschau erscheint hier"
                    : "Kamera-Aufnahme wird von diesem Browser nicht unterstützt — nutze den Upload"}
                </div>
              )}
            </div>

            {recording && (
              <>
                {/* Live-Begleitung */}
                <div className="rounded-xl border border-terra/30 bg-terra/5 p-4" data-testid="live-coach">
                  {currentRoom ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold tracking-wide text-terra-deep uppercase">
                          {currentRoom} · Schritt {stepNumber} von {ROOM_STEPS.length}
                        </p>
                        <span className="text-xs text-ink-soft">
                          {Math.floor(secondsInRoom)} s in diesem Raum
                        </span>
                      </div>
                      <p className="mt-1 font-display text-lg font-semibold">{step.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{step.detail}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold tracking-wide text-terra-deep uppercase">
                        Erster Schritt
                      </p>
                      <p className="mt-1 font-display text-lg font-semibold">
                        Tippe an, in welchem Raum du stehst
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                        Danach führt dich die App durch den Ablauf. Starte am besten im Eingangsbereich.
                      </p>
                    </>
                  )}
                </div>

                {/* Gesamtlänge */}
                <div>
                  <div className="flex justify-between text-xs text-ink-soft">
                    <span>Gesamtlänge {formatClock(elapsed)}</span>
                    <span
                      className={
                        verdict.level === "long"
                          ? "text-terra-deep"
                          : verdict.level === "good"
                            ? "text-sage"
                            : ""
                      }
                    >
                      {verdict.message}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
                    <div
                      className={`h-full rounded-full transition-all ${
                        verdict.level === "long" ? "bg-terra" : "bg-sage"
                      }`}
                      style={{ width: `${targetPct}%` }}
                    />
                  </div>
                </div>

                {/* Raumwahl */}
                <div>
                  <p className="label">Raum wechseln (beim Betreten antippen)</p>
                  <div className="flex flex-wrap gap-2">
                    {TAG_SUGGESTIONS.map((label) => (
                      <button
                        key={label}
                        className={`chip ${currentRoom === label ? "chip-active" : ""}`}
                        onClick={() => enterRoom(label)}
                      >
                        {label}
                      </button>
                    ))}
                    <span className="flex items-center gap-1.5">
                      <input
                        className="input w-32 py-1.5"
                        placeholder="Eigener Raum"
                        value={customTag}
                        onChange={(event) => setCustomTag(event.target.value)}
                      />
                      <button
                        className="btn-secondary px-3 py-1.5"
                        onClick={() => {
                          if (customTag.trim()) {
                            enterRoom(customTag.trim());
                            setCustomTag("");
                          }
                        }}
                      >
                        +
                      </button>
                    </span>
                  </div>
                  {tags.length > 0 && (
                    <p className="mt-2 text-xs text-ink-soft">
                      Bisher: {tags.map((tag) => `${tag.label} (${Math.round(tag.timestampMs / 1000)}s)`).join(" · ")}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-3">
              {!recording && cameraSupported && (
                <button className="btn-terra" onClick={startRecording}>
                  ● Aufnahme starten
                </button>
              )}
              {recording && (
                <button className="btn-primary" onClick={stopRecording}>
                  ■ Aufnahme beenden & analysieren
                </button>
              )}
              {!recording && (
                <label className="btn-secondary cursor-pointer">
                  Video hochladen
                  <input type="file" accept="video/*" className="hidden" onChange={onFileSelected} />
                </label>
              )}
            </div>
          </section>

          {!recording && (
            <section className="card space-y-2">
              <label className="label" htmlFor="hints">
                Hinweise für die KI (optional)
              </label>
              <textarea
                id="hints"
                className="input min-h-20"
                placeholder="z. B. „Die Wohnungstür ist 2,05 m hoch“ oder „Erst kommt der Gang, am Ende das Bad, rechts das Wohnzimmer …“"
                value={hints}
                onChange={(event) => setHints(event.target.value)}
              />
            </section>
          )}

          {isDemo && !recording && (
            <section className="card border-sage/50 bg-sage/5">
              <h2 className="font-display text-lg font-semibold">Demo-Modus aktiv</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Es ist kein API-Key hinterlegt. Du kannst die komplette App mit einer
                Beispielwohnung ausprobieren (Gang, Bad, Wohnzimmer, Küche, Schlafzimmer) — ganz
                ohne Video.
              </p>
              <button className="btn-primary mt-3" onClick={startDemoAnalysis} data-testid="demo-analysis">
                Demo-Analyse starten
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

