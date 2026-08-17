// Verbindlicher Aufnahme-Standard für den Wohnungs-Rundgang.
//
// Warum das wichtig ist: Die KI schätzt Maße aus Einzelbildern über
// Referenzobjekte. Verzerrte Weitwinkel-Aufnahmen, Bewegungsunschärfe oder
// angeschnittene Türen machen diese Schätzung unbrauchbar. Je gleichförmiger
// die Videos sind, desto vergleichbarer werden die Ergebnisse.
//
// Diese Datei ist die einzige Quelle für die Anleitungsseite, die Kurzfassung
// auf der Aufnahmeseite und die Live-Begleitung während der Aufnahme.

export interface GuideItem {
  /** Kurze, verbindliche Vorgabe. */
  title: string;
  /** Begründung bzw. Ausführung. */
  detail: string;
}

export interface GuideSection {
  id: string;
  title: string;
  intro?: string;
  items: GuideItem[];
}

/** Zielwerte für die Aufnahmedauer (Sekunden). */
export const RECORDING_TARGETS = {
  /** Richtwert je Raum. */
  perRoomSec: 30,
  /** Angestrebte Gesamtlänge. */
  totalTargetSec: 180,
  /** Ab hier wird gewarnt: die Bilder pro Raum werden zu wenige. */
  totalWarnSec: 300,
  /** Anzahl Standbilder, die die App gleichmäßig aus dem Video zieht. */
  extractedFrames: 28,
  /** Dauer einer vollen 360°-Drehung. */
  fullTurnSec: 20,
} as const;

/** Die harten Kameravorgaben — hier gibt es bewusst nur eine richtige Antwort. */
export const CAMERA_SETTINGS: GuideItem[] = [
  {
    title: "Objektiv: 1× (Hauptkamera)",
    detail:
      "Nicht 0,5×: Das Ultraweitwinkel verbiegt gerade Kanten stark zum Rand hin — Türrahmen und Wände erscheinen krumm, und genau daraus liest die KI die Maße ab. Auch nicht 2× oder 3×, der Ausschnitt wird zu eng. Während der Aufnahme keinesfalls zoomen.",
  },
  {
    title: "Auflösung: 1080p bei 30 fps",
    detail:
      "4K bringt keinen Vorteil — die App rechnet jedes Bild ohnehin auf 1024 Pixel herunter — kostet aber ein Vielfaches an Speicher und Verarbeitungszeit. 60 fps sind ebenfalls unnötig.",
  },
  {
    title: "Quer halten (Landscape)",
    detail:
      "Im Querformat passt deutlich mehr Raumbreite ins Bild. Hochkant siehst du viel Decke und Boden, aber nur einen Ausschnitt der Wand.",
  },
  {
    title: "HDR-Video ausschalten",
    detail:
      "iPhone: Einstellungen → Kamera → Video aufnehmen → HDR-Video aus. HDR-Aufnahmen wirken beim Auslesen im Browser oft flau oder überstrahlt, wodurch Kanten verloren gehen.",
  },
  {
    title: "Bildstabilisierung an, Blitz aus",
    detail:
      "Die Stabilisierung reduziert Bewegungsunschärfe. Das Blitzlicht erzeugt harte Schlagschatten, die wie Wandkanten aussehen.",
  },
  {
    title: "Während der Aufnahme nicht auf den Bildschirm tippen",
    detail:
      "Antippen setzt Fokus und Belichtung neu — es entstehen Helligkeitssprünge und kurze Unschärfen. Einzige Ausnahme: die Raum-Schaltflächen in dieser App.",
  },
];

/** Haltung, Tempo, Höhe. */
export const MOVEMENT_RULES: GuideItem[] = [
  {
    title: "Handy auf Brusthöhe, etwa 1,40 m",
    detail:
      "Diese Höhe ist der KI als zusätzlicher Anhaltspunkt für den Maßstab bekannt. Halte das Gerät waagerecht, nicht gekippt.",
  },
  {
    title: "Gehtempo: ein Schritt pro Sekunde",
    detail:
      "Also ungefähr halb so schnell wie normales Gehen. Schneller wird jedes zweite Standbild unscharf.",
  },
  {
    title: "Eine volle Drehung dauert 20 Sekunden",
    detail:
      "Zähle innerlich bis 20, während du dich einmal komplett um dich selbst drehst. Das entspricht etwa einer Handbreit Bildverschiebung pro Sekunde.",
  },
  {
    title: "Keine ruckartigen Schwenks",
    detail:
      "Ein schneller Schwenk erzeugt Bewegungsunschärfe. Ein einziges verwackeltes Bild kostet die KI unter Umständen einen ganzen Raum.",
  },
  {
    title: "Vorwärts gehen, nicht rückwärts",
    detail: "Rückwärtsgehen führt fast immer zu Wackeln und ungleichmäßigem Tempo.",
  },
];

/** Der Drei-Schritt-Ablauf, der in jedem Raum gleich abläuft. */
export interface RoomStep extends GuideItem {
  /** Ab dieser Sekunde nach dem Betreten des Raums gilt der Schritt. */
  fromSec: number;
  /** Bis zu dieser Sekunde (exklusiv). */
  toSec: number;
}

export const ROOM_STEPS: RoomStep[] = [
  {
    fromSec: 0,
    toSec: 6,
    title: "Im Türrahmen stehen bleiben",
    detail:
      "Nimm den Raum von der Tür aus einmal als Ganzes ins Bild — das gibt der KI den Überblick, wie der Raum geschnitten ist.",
  },
  {
    fromSec: 6,
    toSec: 26,
    title: "Langsame 360°-Drehung aus der Raummitte",
    detail:
      "Geh in die Mitte und dreh dich einmal komplett — 20 Sekunden. Schwenk dabei einmal kurz nach unten auf die Kante zwischen Boden und Wand und einmal nach oben zur Decke.",
  },
  {
    fromSec: 26,
    toSec: Number.POSITIVE_INFINITY,
    title: "Tür und Fenster einzeln komplett zeigen",
    detail:
      "Jede Tür einmal von der Oberkante bis zum Boden im Bild. Türen sind der Maßstab, an dem die KI alle übrigen Maße festmacht — angeschnittene Türen kosten Genauigkeit.",
  },
];

/** Licht. */
export const LIGHTING_RULES: GuideItem[] = [
  {
    title: "Alle Lichter an, Rollos hoch",
    detail: "Auch tagsüber. Gleichmäßiges Licht bedeutet gleichmäßig verwertbare Bilder.",
  },
  {
    title: "Nicht direkt gegen das Fenster filmen",
    detail:
      "Bei Gegenlicht regelt die Kamera ab, die Wände werden zu schwarzen Flächen und die Raumkanten verschwinden. Filme Fenster seitlich oder im Rückenlicht.",
  },
  {
    title: "Fensterlose Räume: Taschenlampe zuschalten",
    detail:
      "In Bad, Abstellraum oder Flur ohne Fenster hilft die Taschenlampe des Handys. Sie ist gleichmäßiger als der Blitz.",
  },
];

/** Reihenfolge und Wegführung. */
export const ROUTE_RULES: GuideItem[] = [
  {
    title: "An der Wohnungstür starten",
    detail: "Beginne dort, wo ein Besucher hereinkäme, und filme zuerst den Eingangsbereich.",
  },
  {
    title: "Jeden Raum genau einmal betreten",
    detail:
      "Geh die Wohnung in einer sinnvollen Runde ab und spring nicht zwischen Räumen hin und her. Die Reihenfolge im Video verrät der KI, wie die Räume zusammenhängen.",
  },
  {
    title: "Beim Betreten den Raumnamen antippen",
    detail:
      "Die Schaltflächen erscheinen während der Aufnahme. Damit weiß die KI sicher, welcher Bildabschnitt zu welchem Raum gehört — das ist der wirksamste einzelne Beitrag zu einem guten Ergebnis.",
  },
  {
    title: "Am Ende zur Wohnungstür zurückkehren",
    detail: "Der geschlossene Rundweg hilft dabei, die Räume korrekt aneinanderzusetzen.",
  },
];

/** Häufige Fehler, kompakt. */
export const COMMON_MISTAKES: GuideItem[] = [
  { title: "Zu schnell gegangen oder gedreht", detail: "Häufigste Ursache für unbrauchbare Bilder." },
  { title: "Mit 0,5× Weitwinkel gefilmt", detail: "Verzerrte Kanten führen zu falschen Maßen." },
  { title: "Hochkant gefilmt", detail: "Nur ein schmaler Ausschnitt der Wände landet im Bild." },
  { title: "Türen nur angeschnitten", detail: "Ohne vollständige Tür fehlt der Maßstab." },
  { title: "Gegen das Fenster gefilmt", detail: "Die Wände werden zu schwarzen Flächen." },
  { title: "Video deutlich über fünf Minuten", detail: "Je Raum bleiben dann zu wenige Bilder übrig." },
];

/** Die Kurzfassung für die Aufnahmeseite — das Wichtigste in einem Blick. */
export const QUICK_CHECKLIST: string[] = [
  "Objektiv auf 1× (nicht 0,5×), nicht zoomen",
  "1080p / 30 fps, HDR aus",
  "Handy quer und auf Brusthöhe halten",
  "Ein Schritt pro Sekunde, volle Drehung in 20 Sekunden",
  "Alle Lichter an, nicht gegen Fenster filmen",
  "Türen komplett von oben bis unten zeigen",
  "Pro Raum rund 30 Sekunden, insgesamt 2–4 Minuten",
];

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "kamera",
    title: "1 · Kamera einstellen",
    intro:
      "Diese Einstellungen einmal vor der Aufnahme setzen. Sie sind der Unterschied zwischen verwertbaren und unbrauchbaren Bildern.",
    items: CAMERA_SETTINGS,
  },
  {
    id: "haltung",
    title: "2 · Halten und bewegen",
    intro: "Alles hier zielt auf eines ab: scharfe Einzelbilder mit gleichmäßigem Abstand.",
    items: MOVEMENT_RULES,
  },
  {
    id: "raum",
    title: "3 · Ablauf in jedem Raum",
    intro:
      "Dieser Dreischritt wird in jedem Raum identisch wiederholt — rund 30 Sekunden pro Raum. Während der Aufnahme blendet die App ihn automatisch als Schritt-für-Schritt-Hilfe ein.",
    items: ROOM_STEPS,
  },
  {
    id: "licht",
    title: "4 · Licht",
    items: LIGHTING_RULES,
  },
  {
    id: "weg",
    title: "5 · Weg durch die Wohnung",
    items: ROUTE_RULES,
  },
  {
    id: "fehler",
    title: "6 · Häufige Fehler",
    items: COMMON_MISTAKES,
  },
];

/** Ermittelt den aktuellen Raum-Schritt anhand der Sekunden seit Raumwechsel. */
export function currentRoomStep(secondsInRoom: number): RoomStep {
  return (
    ROOM_STEPS.find((step) => secondsInRoom >= step.fromSec && secondsInRoom < step.toSec) ??
    ROOM_STEPS[ROOM_STEPS.length - 1]
  );
}

/** Bewertet die Gesamtlänge einer Aufnahme. */
export function durationVerdict(totalSec: number): {
  level: "short" | "good" | "long";
  message: string;
} {
  if (totalSec < 45) {
    return {
      level: "short",
      message: "Noch sehr kurz — pro Raum sollten es rund 30 Sekunden sein.",
    };
  }
  if (totalSec <= RECORDING_TARGETS.totalWarnSec) {
    return { level: "good", message: "Gute Länge." };
  }
  return {
    level: "long",
    message: `Über ${Math.round(RECORDING_TARGETS.totalWarnSec / 60)} Minuten — die App zieht nur ${RECORDING_TARGETS.extractedFrames} Bilder, pro Raum bleiben dann sehr wenige übrig.`,
  };
}

/** 0-basierter Index des aktuellen Raum-Schritts. */
export function currentRoomStepIndex(secondsInRoom: number): number {
  const index = ROOM_STEPS.findIndex(
    (step) => secondsInRoom >= step.fromSec && secondsInRoom < step.toSec,
  );
  return index === -1 ? ROOM_STEPS.length - 1 : index;
}
