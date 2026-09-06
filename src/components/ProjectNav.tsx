"use client";

// Im Projekt zeigt die Kopfzeile den Weg zum Leitfaden und zur Übersicht —
// auch am Handy, wo es sonst keinen Seitenrand mit Links gibt.

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProjectNav() {
  const pathname = usePathname();
  const match = pathname?.match(/^\/projects\/([^/]+)/);
  if (!match) return null;
  const projectId = match[1];
  const onAssistant = pathname?.endsWith("/assistant");

  return (
    <>
      <Link
        href={`/projects/${projectId}/assistant`}
        className={`btn-ghost px-2 sm:px-2.5 ${onAssistant ? "bg-sand text-ink" : ""}`}
        data-testid="nav-assistant"
      >
        Leitfaden
      </Link>
      <Link href={`/projects/${projectId}`} className="btn-ghost px-2 sm:px-2.5">
        Übersicht
      </Link>
    </>
  );
}
