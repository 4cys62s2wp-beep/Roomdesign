// Der Leitfaden: die eine Quelle dafür, was in welcher Reihenfolge zu tun ist.
//
// Sechs Phasen, jede mit Gerät, Zeitbedarf und konkreten Unterschritten. Aus
// dem Projektstand (Video da? Grundriss da? Räume bestätigt? Favoriten?) wird
// abgeleitet, welche Phase gerade dran ist — der Assistent, die Projektkarte
// und die Startseite lesen alle von hier. Manche Unterschritte kann die App
// nicht selbst prüfen („Lichter an“); die hakt der Nutzer ab, und der Haken
// wird am Projekt gespeichert, damit Mac und Handy dasselbe zeigen.
//
// Bewusst ohne Abhängigkeiten zu Prisma oder React: läuft im Browser und im
// Route-Handler gleichermaßen.

export type PhaseId = "prepare" | "record" | "analyze" | "floorplan" | "design" | "experience";

/** Auf welchem Gerät ein Schritt am besten erledigt wird. */
export type Device = "phone" | "mac" | "both" | "auto";

export const DEVICE_LABELS: Record<Device, string> = {
  phone: "Am Handy",
  mac: "Am Mac",
  both: "Mac oder Handy",
  auto: "Läuft von selbst",
};

export interface JourneyRoom {
  /** Datenbank-ID (für Links). */
  id: string;
  name: string;
  /** Maße vom Nutzer bestätigt (confidence === 1). */
  confirmed: boolean;
  hasProposals: boolean;
  hasFavorite: boolean;
}

export interface JourneyState {
  projectId: string;
  videoCount: number;
  hasPlan: boolean;
  rooms: JourneyRoom[];
  analysisRunning: boolean;
  /** Letzter Analyse-Job fehlgeschlagen und noch kein Grundriss vorhanden. */
  analysisFailed: boolean;
  /** ID des laufenden oder zuletzt gelaufenen Analyse-Jobs, für den Link. */
  analysisJobId: string | null;
  designRunning: boolean;
  hasGlobalStyle: boolean;
  provider: "demo" | "claude" | "unknown";
  /** Vom Nutzer abgehakte Unterschritte, Schlüssel = `${phase}.${substep}`. */
  checks: Record<string, boolean>;
}

export interface SubStep {
  key: string;
  title: string;
  detail: string;
  /** Kann die App selbst erkennen, ob das erledigt ist? */
  auto?: (state: JourneyState) => boolean;
  /** Fortschrittstext, z. B. „3 von 5 Räumen“. */
  progress?: (state: JourneyState) => string | null;
  optional?: boolean;
  link?: { label: string; href: (state: JourneyState) => string | null };
}

export interface Phase {
  id: PhaseId;
  title: string;
  /** Kurzer Satz: worum es geht. */
  lead: string;
  device: Device;
  minutes: string;
  substeps: SubStep[];
  done: (state: JourneyState) => boolean;
  cta: (state: JourneyState) => { label: string; href: string } | null;
}

export type PhaseStatus = "done" | "current" | "upcoming";

export interface DerivedSubStep {
  sub: SubStep;
  done: boolean;
  /** Erledigt, weil der Nutzer es abgehakt hat (statt automatisch erkannt). */
  manual: boolean;
  progress: string | null;
  /** Fertig aufgelöster Link, falls der Unterschritt einen hat. */
  link: { label: string; href: string } | null;
}

export interface DerivedPhase {
  phase: Phase;
  index: number;
  status: PhaseStatus;
  substeps: DerivedSubStep[];
  doneCount: number;
  requiredCount: number;
  cta: { label: string; href: string } | null;
}

export interface Journey {
  phases: DerivedPhase[];
  currentIndex: number;
  current: DerivedPhase;
  /** Anteil erledigter Phasen, 0..1 */
  completion: number;
}

// ----------------------------------------------------------------- Helfer

const project = (state: JourneyState) => `/projects/${state.projectId}`;

const roomsConfirmed = (state: JourneyState) =>
  state.rooms.length > 0 && state.rooms.every((room) => room.confirmed);

const roomsWithFavorite = (state: JourneyState) =>
  state.rooms.filter((room) => room.hasFavorite).length;

const roomsWithProposals = (state: JourneyState) =>
  state.rooms.filter((room) => room.hasProposals).length;

const allFavorites = (state: JourneyState) =>
  state.rooms.length > 0 && roomsWithFavorite(state) === state.rooms.length;

const countOf = (done: number, total: number, noun: string) =>
  total === 0 ? null : `${done} von ${total} ${noun}`;

/** Sind alle Pflicht-Unterschritte einer Phase abgehakt oder erkannt? */
function allRequiredChecked(phase: Phase, state: JourneyState): boolean {
  return phase.substeps
    .filter((sub) => !sub.optional)
    .every((sub) => sub.auto?.(state) || state.checks[`${phase.id}.${sub.key}`]);
}

// ----------------------------------------------------------------- Phasen

export const PHASES: Phase[] = [
  {
    id: "prepare",
    title: "Vorbereiten",
    lead: "Fünf Minuten, die über die Qualität der Maße entscheiden.",
    device: "both",
    minutes: "≈ 5 Min",
    substeps: [
      {
        key: "apartment",
        title: "Wohnung herrichten",
        detail:
          "Alle Lichter an, Rollos und Vorhänge auf, Zimmertüren offen. Kartons oder Gegenstände von Wänden und Türen wegräumen — jede verdeckte Kante fehlt der KI später.",
      },
      {
        key: "camera",
        title: "Kamera am Handy einstellen",
        detail:
          "iPhone: Einstellungen → Kamera → Video aufnehmen → 1080p bei 30 fps, darunter HDR-Video ausschalten. In der Kamera-App später 1× wählen (nicht 0,5×) und das Handy quer halten.",
      },
      {
        key: "connect",
        title: "Handy mit der App verbinden",
        detail:
          "Handy und Mac ins selbe WLAN. Die Adresse steht unten — mit der Kamera-App den Code scannen. Beim ersten Aufruf warnt der Browser vor dem Zertifikat: „Erweitert“ → „Trotzdem fortfahren“.",
      },
      {
        key: "ai",
        title: "Echte KI einschalten",
        detail:
          "Ohne API-Key läuft die App im Demo-Modus mit einer Beispielwohnung — zum Kennenlernen ideal, für die eigene Wohnung brauchst du den Key aus console.anthropic.com unter Einstellungen.",
        auto: (state) => state.provider === "claude",
        optional: true,
        link: { label: "Einstellungen öffnen", href: () => "/settings" },
      },
    ],
    done: (state) => state.videoCount > 0 || state.hasPlan || allRequiredChecked(PHASES[0], state),
    cta: (state) => ({ label: "Weiter zur Aufnahme", href: `${project(state)}/capture/guide` }),
  },
  {
    id: "record",
    title: "Aufnehmen",
    lead: "Ein ruhiger Rundgang, immer nach demselben Muster.",
    device: "phone",
    minutes: "≈ 3–4 Min",
    substeps: [
      {
        key: "guide",
        title: "Aufnahme-Anleitung einmal ganz lesen",
        detail:
          "Objektiv, Tempo, Licht und der Dreischritt pro Raum stehen dort. Zwei Minuten Lesen, damit jede Aufnahme gleich und damit auswertbar wird.",
        link: { label: "Anleitung öffnen", href: (state) => `${project(state)}/capture/guide` },
      },
      {
        key: "start",
        title: "An der Wohnungstür starten",
        detail:
          "Aufnahme-Seite öffnen, „Aufnahme starten“ antippen, dann sofort den Raum „Gang“ antippen. Handy quer, auf Brusthöhe, waagerecht.",
      },
      {
        key: "room",
        title: "In jedem Raum der Dreischritt",
        detail:
          "6 Sekunden im Türrahmen stehen bleiben → in die Mitte gehen und in 20 Sekunden einmal langsam um dich drehen → jede Tür und jedes Fenster einzeln komplett von oben bis unten zeigen. Die App blendet dir den aktuellen Schritt ein.",
      },
      {
        key: "route",
        title: "Jeden Raum genau einmal, Raumname antippen",
        detail:
          "Beim Betreten den Raum antippen — das ist der wirksamste Beitrag zu einem guten Ergebnis. Ein Schritt pro Sekunde, nicht rückwärts gehen, am Ende zur Wohnungstür zurück.",
      },
      {
        key: "stop",
        title: "„Aufnahme beenden & analysieren“",
        detail:
          "Die App zieht 28 Standbilder aus dem Video und lädt nur diese hoch — das Video selbst bleibt auf dem Handy. Die Analyse startet von selbst.",
        auto: (state) => state.videoCount > 0 || state.hasPlan,
      },
    ],
    done: (state) => state.videoCount > 0 || state.hasPlan,
    cta: (state) => ({ label: "Zur Aufnahme", href: `${project(state)}/capture` }),
  },
  {
    id: "analyze",
    title: "Analysieren",
    lead: "Die KI erkennt Räume, schätzt Maße und setzt den Grundriss zusammen.",
    device: "auto",
    minutes: "≈ 1–2 Min",
    substeps: [
      {
        key: "wait",
        title: "Analyse abwarten",
        detail:
          "Drei Schritte laufen hintereinander: Räume erkennen, Maße über Referenzobjekte wie Türhöhen schätzen, Grundriss zusammensetzen. Du kannst die Seite offen lassen oder später zurückkommen.",
        auto: (state) => state.hasPlan,
        link: {
          label: "Fortschritt ansehen",
          href: (state) =>
            state.analysisJobId ? `${project(state)}/analysis?job=${state.analysisJobId}` : null,
        },
      },
      {
        key: "summary",
        title: "Zusammenfassung lesen",
        detail:
          "Am Ende steht, welche Räume erkannt wurden und wo die KI unsicher war. Genau diese Stellen prüfst du im nächsten Schritt zuerst.",
        auto: (state) => state.hasPlan,
      },
    ],
    done: (state) => state.hasPlan,
    cta: (state) =>
      state.analysisRunning && state.analysisJobId
        ? { label: "Fortschritt ansehen", href: `${project(state)}/analysis?job=${state.analysisJobId}` }
        : state.analysisFailed
          ? { label: "Neu aufnehmen", href: `${project(state)}/capture` }
          : { label: "Zur Aufnahme", href: `${project(state)}/capture` },
  },
  {
    id: "floorplan",
    title: "Grundriss prüfen",
    lead: "Der wichtigste Schritt: Aus Schätzungen werden verlässliche Maße.",
    device: "mac",
    minutes: "≈ 10 Min",
    substeps: [
      {
        key: "names",
        title: "Raumnamen und Raumtypen prüfen",
        detail:
          "Jeden Raum im Editor antippen. Stimmen Name und Typ? Der Typ steuert später, welche Möbel vorgeschlagen werden.",
      },
      {
        key: "measure",
        title: "Maße nachmessen und eintragen",
        detail:
          "Mit dem Zollstock je Raum Breite und Tiefe messen und rechts im Raum-Panel eintragen. Gestrichelte Räume sind Schätzungen der KI — dort zuerst.",
      },
      {
        key: "openings",
        title: "Türen und Fenster prüfen",
        detail:
          "Sitzt jede Tür an der richtigen Wand? Fehlt ein Fenster? Öffnungen lassen sich ziehen; eine Wand antippen legt eine neue an.",
      },
      {
        key: "shape",
        title: "Nicht rechteckige Räume nachbauen",
        detail:
          "Mit dem + auf einer Wand fügst du eine Ecke ein — so entstehen L-förmige Räume. Türen und Fenster wandern mit. Mehrere Etagen ordnest du im Raum-Panel zu.",
        optional: true,
      },
      {
        key: "confirm",
        title: "Bei jedem Raum „Maße bestätigen ✓“ und speichern",
        detail:
          "Erst die Bestätigung macht aus der Schätzung ein verlässliches Maß. Die Einrichtungsvorschläge rechnen mit genau diesen Werten.",
        auto: roomsConfirmed,
        progress: (state) =>
          countOf(state.rooms.filter((room) => room.confirmed).length, state.rooms.length, "Räumen bestätigt"),
      },
    ],
    done: roomsConfirmed,
    cta: (state) => ({ label: "Grundriss-Editor öffnen", href: `${project(state)}/floorplan` }),
  },
  {
    id: "design",
    title: "Einrichten",
    lead: "Pro Raum Vorschläge entwerfen lassen und den besten festhalten.",
    device: "mac",
    minutes: "≈ 5 Min pro Raum",
    substeps: [
      {
        key: "style",
        title: "Roten Faden fürs ganze Zuhause setzen",
        detail:
          "Einmal zentral beschreiben, wie die Wohnung wirken soll — jeder Raumvorschlag nimmt darauf Rücksicht, damit alles wie aus einem Guss wirkt.",
        auto: (state) => state.hasGlobalStyle,
        link: { label: "Zur Projektübersicht", href: (state) => `${project(state)}#stil` },
      },
      {
        key: "generate",
        title: "Pro Raum Vorschläge entwerfen lassen",
        detail:
          "Raum öffnen, Stil wählen oder frei beschreiben, Budget setzen, „Vorschläge entwerfen“. Zwei bis drei Varianten sind ein guter Start.",
        auto: (state) => state.rooms.length > 0 && roomsWithProposals(state) === state.rooms.length,
        progress: (state) => countOf(roomsWithProposals(state), state.rooms.length, "Räumen mit Vorschlägen"),
      },
      {
        key: "favorite",
        title: "In jedem Raum einen Favoriten markieren ★",
        detail:
          "Der Favorit ist das, was in Einkaufsliste, 3D-Rundgang und PDF landet. Mit „Vergleichen“ stellst du zwei Vorschläge nebeneinander.",
        auto: allFavorites,
        progress: (state) => countOf(roomsWithFavorite(state), state.rooms.length, "Räumen mit Favorit"),
      },
      {
        key: "refine",
        title: "Nachschärfen und Möbel selbst anordnen",
        detail:
          "Feedback wie „mehr Holz, weniger Deko“ erzeugt eine überarbeitete Fassung. Mit „Möbel anordnen“ ziehst und drehst du Stücke selbst — das Budget rechnet mit.",
        optional: true,
      },
    ],
    done: allFavorites,
    cta: (state) => {
      const next = state.rooms.find((room) => !room.hasFavorite) ?? state.rooms[0];
      return next
        ? { label: `${next.name} einrichten`, href: `${project(state)}/rooms/${next.id}/design` }
        : null;
    },
  },
  {
    id: "experience",
    title: "Erleben & Einkaufen",
    lead: "Durch die Wohnung gehen, prüfen, ausdrucken, einkaufen.",
    device: "both",
    minutes: "≈ 10 Min",
    substeps: [
      {
        key: "view3d",
        title: "3D-Rundgang machen",
        detail:
          "Übersicht mit der Maus drehen, dann „Rundgang“: am Mac mit WASD und Maus, am Handy mit dem Joystick unten links und Wischen zum Umsehen. Stimmen die Proportionen? Bleibt genug Platz an Türen?",
        link: { label: "3D-Rundgang öffnen", href: (state) => `${project(state)}/view3d` },
      },
      {
        key: "shopping",
        title: "Einkaufsliste prüfen",
        detail:
          "Alle Favoriten zusammengefasst, mit Budget je Raum. Der CSV-Export öffnet sich in Numbers oder Excel.",
        link: { label: "Einkaufsliste öffnen", href: (state) => `${project(state)}/shopping` },
      },
      {
        key: "pdf",
        title: "Konzept als PDF sichern",
        detail:
          "Deckblatt, Grundriss, ein Kapitel pro Raum, Budget — im Druckdialog „Als PDF sichern“ wählen und Hintergrundgrafiken einschalten.",
        link: { label: "PDF-Ansicht öffnen", href: (state) => `${project(state)}/export` },
      },
      {
        key: "measure",
        title: "Vor dem Kauf: Aufmaß mit dem Zollstock",
        detail:
          "Die Maße aus dem Video sind Schätzungen, auch nach der Korrektur. Miss jede Stellfläche vor der Bestellung nach — besonders bei Küchenzeile, Schrank und Bett.",
      },
    ],
    done: (state) => allRequiredChecked(PHASES[5], state),
    cta: (state) => ({ label: "3D-Rundgang öffnen", href: `${project(state)}/view3d` }),
  },
];

export const PHASE_BY_ID: Record<PhaseId, Phase> = Object.fromEntries(
  PHASES.map((phase) => [phase.id, phase]),
) as Record<PhaseId, Phase>;

// -------------------------------------------------------------- Ableitung

export function deriveJourney(state: JourneyState): Journey {
  const doneFlags = PHASES.map((phase) => phase.done(state));

  // Die erste nicht erledigte Phase ist dran. Alles davor gilt als erledigt,
  // auch wenn einzelne Häkchen fehlen — wer einen Grundriss hat, muss nicht
  // mehr „Lichter an“ abhaken.
  let currentIndex = doneFlags.findIndex((done) => !done);
  if (currentIndex === -1) currentIndex = PHASES.length - 1;

  const phases: DerivedPhase[] = PHASES.map((phase, index) => {
    const status: PhaseStatus =
      index < currentIndex ? "done" : index === currentIndex ? (doneFlags[index] ? "done" : "current") : "upcoming";

    const substeps: DerivedSubStep[] = phase.substeps.map((sub) => {
      const autoDone = sub.auto?.(state) ?? false;
      const manualDone = Boolean(state.checks[`${phase.id}.${sub.key}`]);
      const href = sub.link?.href(state) ?? null;
      return {
        sub,
        done: autoDone || manualDone || status === "done",
        manual: !autoDone && manualDone,
        progress: sub.progress?.(state) ?? null,
        link: sub.link && href ? { label: sub.link.label, href } : null,
      };
    });
    const required = substeps.filter((entry) => !entry.sub.optional);

    return {
      phase,
      index,
      status,
      substeps,
      doneCount: required.filter((entry) => entry.done).length,
      requiredCount: required.length,
      cta: phase.cta(state),
    };
  });

  const doneCount = phases.filter((entry) => entry.status === "done").length;
  return {
    phases,
    currentIndex,
    current: phases[currentIndex],
    completion: doneCount / PHASES.length,
  };
}

/** Leerer Ausgangszustand — für Tests und für die Startseite ohne Projekt. */
export function emptyJourneyState(projectId = "demo"): JourneyState {
  return {
    projectId,
    videoCount: 0,
    hasPlan: false,
    rooms: [],
    analysisRunning: false,
    analysisFailed: false,
    analysisJobId: null,
    designRunning: false,
    hasGlobalStyle: false,
    provider: "unknown",
    checks: {},
  };
}

/** Kurzer Text für Projektkarten: „Jetzt dran: Aufnehmen“. */
export function nextStepLabel(journey: Journey): string {
  const { current } = journey;
  if (current.status === "done") return "Alles erledigt";
  return `Jetzt dran: ${current.phase.title}`;
}
