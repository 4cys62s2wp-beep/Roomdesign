// Clientseitige Frame-Extraktion: Statt ein großes Video hochzuladen, werden
// im Browser gleichmäßig verteilte Standbilder gezogen (Canvas → JPEG).
// Funktioniert für Aufnahmen (MediaRecorder-Blob) und hochgeladene Dateien,
// solange der Browser das Format abspielen kann.

export interface ExtractedFrames {
  blobs: Blob[];
  timestampsMs: number[];
  durationSec: number;
}

export interface ExtractOptions {
  maxFrames?: number;
  minIntervalMs?: number;
  maxDimension?: number;
  quality?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function extractFramesFromBlob(
  source: Blob,
  options: ExtractOptions = {},
): Promise<ExtractedFrames> {
  const maxFrames = options.maxFrames ?? 28;
  const minIntervalMs = options.minIntervalMs ?? 1200;
  const maxDimension = options.maxDimension ?? 1024;
  const quality = options.quality ?? 0.8;

  const url = URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await waitForEvent(video, "loadedmetadata", 15000, "Video konnte nicht gelesen werden.");

    // MediaRecorder-WebM meldet oft duration=Infinity → Trick: ans Ende springen
    let durationSec = video.duration;
    if (!isFinite(durationSec) || durationSec <= 0) {
      video.currentTime = 1e7;
      await waitForEvent(video, "seeked", 8000, "Videolänge konnte nicht ermittelt werden.");
      durationSec = video.duration;
      video.currentTime = 0;
      await waitForEvent(video, "seeked", 8000, "Video konnte nicht zurückgespult werden.");
    }
    if (!isFinite(durationSec) || durationSec <= 0) {
      throw new Error("Videolänge konnte nicht ermittelt werden.");
    }

    const durationMs = durationSec * 1000;
    const interval = Math.max(minIntervalMs, durationMs / maxFrames);
    const count = Math.max(1, Math.min(maxFrames, Math.floor(durationMs / interval) + 1));
    const timestamps: number[] = [];
    for (let i = 0; i < count; i++) {
      timestamps.push(Math.min(i * interval + 250, Math.max(0, durationMs - 150)));
    }

    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth || 1, video.videoHeight || 1));
    const width = Math.max(2, Math.round((video.videoWidth || 640) * scale));
    const height = Math.max(2, Math.round((video.videoHeight || 480) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas wird nicht unterstützt.");

    const blobs: Blob[] = [];
    const usedTimestamps: number[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const targetMs = timestamps[i];
      try {
        await seekTo(video, targetMs / 1000);
        ctx.drawImage(video, 0, 0, width, height);
        const blob = await canvasToJpeg(canvas, quality);
        blobs.push(blob);
        usedTimestamps.push(Math.round(targetMs));
      } catch {
        // Einzelne fehlgeschlagene Seeks überspringen
      }
      options.onProgress?.(i + 1, timestamps.length);
    }

    if (blobs.length === 0) {
      throw new Error(
        "Aus dem Video konnten keine Bilder gelesen werden. Das Format wird vom Browser evtl. nicht unterstützt – bitte als MP4 exportieren oder direkt in der App aufnehmen.",
      );
    }
    return { blobs, timestampsMs: usedTimestamps, durationSec };
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}

async function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  video.currentTime = timeSec;
  await waitForEvent(video, "seeked", 6000, "Seek fehlgeschlagen.");
  // iOS Safari malt das Frame manchmal erst einen Tick später
  await new Promise((resolve) => setTimeout(resolve, 40));
}

function waitForEvent(
  target: HTMLMediaElement,
  event: string,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video-Fehler beim Verarbeiten."));
    };
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Frame konnte nicht kodiert werden."))),
      "image/jpeg",
      quality,
    );
  });
}

/** Bevorzugtes Aufnahmeformat des Browsers ermitteln (iOS: MP4, sonst meist WebM). */
export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}
