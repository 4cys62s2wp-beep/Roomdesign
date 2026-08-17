"use client";

// Einstellungen: Anthropic-API-Key, Modellwahl, Demo-Modus.

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client";

interface SettingsData {
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  keyFromEnv: boolean;
  model: string;
  forceDemo: boolean;
  activeProvider: "demo" | "claude";
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [forceDemo, setForceDemo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await fetchJson<SettingsData>("/api/settings");
    setSettings(data);
    setModel(data.model);
    setForceDemo(data.forceDemo);
  };

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          model,
          forceDemo,
        }),
      });
      setApiKey("");
      await load();
      setMessage("Gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    if (!confirm("API-Key wirklich entfernen? Die App wechselt in den Demo-Modus.")) return;
    await fetchJson("/api/settings", { method: "PUT", body: JSON.stringify({ apiKey: null }) });
    await load();
  };

  if (!settings) {
    return <p className="text-sm text-ink-soft">{error ?? "Wird geladen …"}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Aktiver Modus:{" "}
          {settings.activeProvider === "claude" ? (
            <span className="font-medium text-sage">Claude-KI aktiv</span>
          ) : (
            <span className="font-medium text-terra-deep">Demo-Modus (Beispieldaten)</span>
          )}
        </p>
      </div>

      <section className="card space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Anthropic-API-Key</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Mit einem API-Key von{" "}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="underline">
              console.anthropic.com
            </a>{" "}
            analysiert Claude deine Videoframes wirklich und entwirft individuelle Vorschläge. Ohne
            Key läuft die App vollständig im Demo-Modus. Der Key wird nur serverseitig gespeichert.
          </p>
        </div>
        {settings.hasApiKey && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-sand px-3.5 py-2.5 text-sm">
            <span>
              Hinterlegt: <code>{settings.apiKeyMasked}</code>
              {settings.keyFromEnv && " (aus Umgebungsvariable)"}
            </span>
            {!settings.keyFromEnv && (
              <button className="btn-ghost text-terra-deep" onClick={removeKey}>
                Entfernen
              </button>
            )}
          </div>
        )}
        <div>
          <label className="label" htmlFor="apiKey">
            {settings.hasApiKey ? "Key ersetzen" : "Key eintragen"}
          </label>
          <input
            id="apiKey"
            type="password"
            className="input"
            placeholder="sk-ant-…"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="model">
            Claude-Modell
          </label>
          <input
            id="model"
            className="input"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
          <p className="mt-1 text-xs text-ink-soft">
            Standard: claude-opus-5. Günstigere Alternative z. B. claude-sonnet-5.
          </p>
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={forceDemo}
            onChange={(event) => setForceDemo(event.target.checked)}
            className="h-4 w-4 accent-terra"
          />
          Demo-Modus erzwingen (auch mit hinterlegtem Key)
        </label>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Speichert …" : "Speichern"}
          </button>
          {message && <span className="text-sm text-sage">{message}</span>}
          {error && <span className="text-sm text-terra-deep">{error}</span>}
        </div>
      </section>

      <section className="card space-y-2 text-sm leading-relaxed text-ink-soft">
        <h2 className="font-display text-lg font-semibold text-ink">Über die Kosten</h2>
        <p>
          Eine Videoanalyse sendet bis zu 32 komprimierte Einzelbilder an Claude; ein
          Designvorschlag ist ein reiner Text-Aufruf. Fotorealistische Bild-Renders sind bewusst
          deaktiviert — die 3D-Vorschau entsteht lokal im Browser und kostet nichts. Eine
          Bild-KI-Schnittstelle ist vorbereitet und kann später aktiviert werden.
        </p>
      </section>
    </div>
  );
}
