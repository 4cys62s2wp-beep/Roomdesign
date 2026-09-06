"use client";

// Zeigt, unter welcher Adresse das Handy die Aufnahme-Seite erreicht — als
// QR-Code zum Scannen mit der Kamera-App und als Text zum Abtippen.

import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { fetchJson } from "@/lib/client";

interface NetworkInfo {
  addresses: string[];
  port: string;
  protocol: "http" | "https";
  secure: boolean;
}

export function PhoneConnect({ projectId }: { projectId: string }) {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [onPhone, setOnPhone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Wer die Seite nicht über localhost aufruft, ist vermutlich schon das Handy
    const host = window.location.hostname;
    setOnPhone(host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]");
    void fetchJson<NetworkInfo>("/api/network")
      .then(setNetwork)
      .catch(() => setFailed(true));
  }, []);

  const url =
    network && network.addresses.length > 0
      ? `${network.protocol}://${network.addresses[0]}:${network.port}/projects/${projectId}/capture`
      : null;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void toDataURL(url, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: "#26231d", light: "#ffffff" },
    })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="rounded-xl border border-line bg-sand/50 p-4" data-testid="phone-connect">
      <p className="label">Handy verbinden</p>
      {onPhone ? (
        <p className="text-sm leading-relaxed">
          Du bist schon am Handy — weiter geht es direkt mit der Aufnahme.
        </p>
      ) : failed ? (
        <p className="text-sm text-ink-soft">
          Die Netzwerk-Adresse ließ sich nicht ermitteln. Im Terminal steht sie hinter „Network:“.
        </p>
      ) : !network ? (
        <p className="text-sm text-ink-soft">Adresse wird ermittelt …</p>
      ) : !url ? (
        <p className="text-sm text-ink-soft">
          Keine Netzwerk-Adresse gefunden — ist dieser Rechner im WLAN?
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row">
          {qr ? (
            <img
              src={qr}
              alt={`QR-Code für ${url}`}
              className="h-36 w-36 shrink-0 rounded-lg bg-white p-1.5 shadow-[0_1px_3px_rgba(38,35,29,0.12)]"
              data-testid="phone-qr"
            />
          ) : (
            <div className="h-36 w-36 shrink-0 rounded-lg bg-white" />
          )}
          <div className="min-w-0 space-y-2 text-sm leading-relaxed">
            <p>
              Handy und Mac ins selbe WLAN, dann mit der <strong>Kamera-App</strong> den Code
              scannen — oder eintippen:
            </p>
            <code className="block overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs" data-testid="phone-url">
              {url}
            </code>
            {network.secure ? (
              <p className="text-ink-soft">
                Beim ersten Aufruf warnt der Browser vor dem Zertifikat: „Erweitert“ →
                „Trotzdem fortfahren“. Danach gibt er die Kamera frei.
              </p>
            ) : (
              <p className="text-terra-deep">
                Der Server läuft ohne HTTPS — die Kamera direkt im Browser bleibt am Handy
                gesperrt. Entweder mit <code>npm run dev:https</code> starten, oder am Handy
                „Video hochladen“ nehmen: Das öffnet die Kamera-App und funktioniert immer.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
