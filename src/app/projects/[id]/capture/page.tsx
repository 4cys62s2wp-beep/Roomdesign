"use client";

// Video-Aufnahme & Upload: MediaRecorder mit Codec-Erkennung, Raum-Tagging
// während der Aufnahme, clientseitige Frame-Extraktion und Frame-Upload.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client";
import { extractFramesFromBlob, pickRecorderMimeType } from "@/lib/frames/extract-client";
import type { RoomTag } from "@/lib/types";

const TAG_SUGGESTIONS = ["Gang", "Wohnzimmer", "Küche", "Schlafzimmer", "Bad", "WC", "Balkon", "Büro"];

type Phase =
  | { name: "idle" }
  | { name: "recording"; startedAt: number }
  | { name: "processing"; text: string; progress: number | null }
  | { name: "error"; message: string };

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
    return () => stopStream();
  }, []);

  useEffect(() => {
    if (phase.name !== "recording") return;
    const timer = setInterval(() => setElapsed(Date.now() - phase.startedAt), 500);
    return () => clearInterval(timer);
  }, [phase]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
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
      setPhase({ name: "recording", startedAt: Date.now() });
    } catch {
      setPhase({
        name: "error",
        message:
          "Kamera-Zugriff nicht möglich. Bitte Berechtigung erteilen oder unten ein Video hochladen.",
      });
    }
  };

  const addTag = (label: string) => {
    if (phase.name !== "recording") return;
    setTags((prev) => [...prev, { timestampMs: Date.now() - recordStartRef.current, label }]);
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-ink-soft hover:text-ink">
          ← Zurück zum Projekt
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold">Wohnungs-Rundgang aufnehmen</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Gehe langsam durch jede Ecke der Wohnung. Filme Türen und Fenster komplett — sie dienen
          der KI als Maßstab. Tippe während des Rundgangs auf den Raumnamen, in dem du dich gerade
          befindest. Das Video verlässt dein Gerät nicht: Es werden nur einzelne Standbilder
          hochgeladen.
        </p>
      </div>

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
              <video
                ref={videoRef}
                muted
                playsInline
                className="aspect-video w-full object-cover"
              />
              {phase.name === "recording" && (
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  {Math.floor(elapsed / 60000)}:{String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0")}
                </div>
              )}
              {phase.name === "idle" && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-cream/70">
                  {cameraSupported ? "Kamera-Vorschau erscheint hier" : "Kamera-Aufnahme wird von diesem Browser nicht unterstützt"}
                </div>
              )}
            </div>

            {phase.name === "recording" && (
              <div>
                <p className="label">Ich bin gerade im Raum … (antippen)</p>
                <div className="flex flex-wrap gap-2">
                  {TAG_SUGGESTIONS.map((label) => (
                    <button key={label} className="chip" onClick={() => addTag(label)}>
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
                          addTag(customTag.trim());
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
                    Getaggt:{" "}
                    {tags.map((tag) => `${tag.label} (${Math.round(tag.timestampMs / 1000)}s)`).join(" · ")}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {phase.name === "idle" && cameraSupported && (
                <button className="btn-terra" onClick={startRecording}>
                  ● Aufnahme starten
                </button>
              )}
              {phase.name === "recording" && (
                <button className="btn-primary" onClick={stopRecording}>
                  ■ Aufnahme beenden & analysieren
                </button>
              )}
              {phase.name === "idle" && (
                <label className="btn-secondary cursor-pointer">
                  Video hochladen
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={onFileSelected}
                  />
                </label>
              )}
            </div>
          </section>

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

          {isDemo && (
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
