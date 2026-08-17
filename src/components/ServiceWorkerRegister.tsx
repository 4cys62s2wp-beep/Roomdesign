"use client";

import { useEffect } from "react";

/** Registriert den Service Worker nur im Production-Build (Dev-Caching wäre störend). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA ist optional – Fehler still ignorieren
    });
  }, []);
  return null;
}
