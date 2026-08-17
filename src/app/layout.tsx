import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: {
    default: "Roomdesign – Wohnungsplanung per Video",
    template: "%s · Roomdesign",
  },
  description:
    "Nimm einen Video-Rundgang durch deine leere Wohnung auf, lass die KI Räume und Maße erkennen und erhalte komplette Einrichtungsvorschläge mit 3D-Vorschau.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Roomdesign" },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ec",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-terra text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l9-8 9 8" />
                  <path d="M5 9.5V21h14V9.5" />
                  <path d="M10 21v-6h4v6" />
                </svg>
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">Roomdesign</span>
            </Link>
            <nav className="flex items-center gap-1.5">
              <Link href="/" className="btn-ghost">
                Projekte
              </Link>
              <Link href="/settings" className="btn-ghost">
                Einstellungen
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pt-4 pb-10 text-xs text-ink-soft/70">
          Roomdesign · KI-gestützte Wohnungsplanung · Maße sind Schätzwerte und ersetzen kein Aufmaß.
        </footer>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
