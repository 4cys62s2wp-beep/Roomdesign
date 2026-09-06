// Animierte Illustrationen für die sechs Phasen des Leitfadens.
//
// Reine SVGs mit CSS-Keyframes (siehe globals.css, Abschnitt „Leitfaden“).
// Grundregel: Der Ruhezustand eines Elements ist immer der Endzustand der
// Animation. Wer „Bewegung reduzieren“ eingeschaltet hat, bekommt so ein
// fertiges, stehendes Bild statt einer abgeschnittenen Szene.
//
// Einzige Ausnahme sind die Wege (Rundgang, 3D): Bewegung entlang eines
// Pfads läuft über SMIL <animateMotion>, weil das auf jedem Handy-Browser
// zuverlässig funktioniert. Bei reduzierter Bewegung wird der Läufer
// ausgeblendet und ein statischer Punkt am Ziel gezeigt.

import type React from "react";
import type { PhaseId } from "@/lib/journey";

const INK = "#26231d";
const SOFT = "#57524a";
const TERRA = "#b5674c";
const TERRA_DEEP = "#97523c";
const SAGE = "#8a9a7e";
const SAND = "#efe9db";
const PAPER = "#fbf9f3";
const BLUE = "#4d7ba6";

export function PhaseIllustration({ id, className }: { id: PhaseId; className?: string }) {
  const cycle = CYCLE_SECONDS[id];
  const common = {
    className: `jn-anim ${className ?? ""}`,
    viewBox: "0 0 240 160",
    role: "img" as const,
    style: { "--jn-cycle": `${cycle}s` } as React.CSSProperties,
  };
  switch (id) {
    case "prepare":
      return <Prepare {...common} />;
    case "record":
      return <Record {...common} />;
    case "analyze":
      return <Analyze {...common} />;
    case "floorplan":
      return <Floorplan {...common} />;
    case "design":
      return <Design {...common} />;
    case "experience":
      return <Experience {...common} />;
  }
}

/** Länge eines Animationsdurchlaufs je Phase (Sekunden). */
const CYCLE_SECONDS: Record<PhaseId, number> = {
  prepare: 7,
  record: 16,
  analyze: 8,
  floorplan: 7,
  design: 8,
  experience: 10,
};

type SvgProps = { className: string; viewBox: string; role: "img"; style: React.CSSProperties };

// ------------------------------------------------------------ 1 Vorbereiten
// Eine Lampe geht an, ein Rollo fährt hoch, das Handy dreht sich ins
// Querformat und zeigt die drei Kameraeinstellungen.
function Prepare(props: SvgProps) {
  return (
    <svg {...props} aria-label="Lichter an, Rollo hoch, Handy quer halten und Kamera einstellen">
      {/* Lampe */}
      <g transform="translate(34 46)">
        <circle r="26" fill={TERRA} className="jn-glow-ring" />
        <circle r="17" fill={TERRA} className="jn-glow-ring jn-delay-1" />
        <path d="M-9 -4 a9 9 0 1 1 18 0 q0 5 -4 8 v5 h-10 v-5 q-4 -3 -4 -8z" fill="#f2c96b" stroke={INK} strokeWidth="2" className="jn-bulb" />
        <rect x="-5" y="10" width="10" height="4" rx="1" fill={INK} />
      </g>

      {/* Fenster mit Rollo */}
      <g transform="translate(186 16)">
        <rect x="0" y="0" width="40" height="50" fill="#dbe7f0" stroke={INK} strokeWidth="2" />
        <line x1="20" y1="0" x2="20" y2="50" stroke={INK} strokeWidth="1.5" />
        <line x1="0" y1="25" x2="40" y2="25" stroke={INK} strokeWidth="1.5" />
        <rect x="-1" y="0" width="42" height="50" fill={SAND} stroke={INK} strokeWidth="2" className="jn-blind" />
        <rect x="-3" y="-4" width="46" height="5" fill={INK} />
      </g>

      {/* Handy: dreht sich vom Hochformat ins Querformat */}
      <g transform="translate(120 96)">
        <g className="jn-phone">
          <rect x="-27" y="-46" width="54" height="92" rx="9" fill={INK} />
          <rect x="-23" y="-38" width="46" height="76" rx="4" fill={PAPER} />
          <circle cx="0" cy="-42" r="1.6" fill="#666" />
        </g>
        {/* Inhalt erscheint erst, wenn das Handy quer liegt */}
        <g className="jn-phone-ui">
          <text x="-32" y="-9" style={{ fontSize: 9, fontWeight: 700, fill: INK }}>
            1×
          </text>
          <rect x="-33" y="-19" width="16" height="13" rx="6.5" fill="none" stroke={TERRA} strokeWidth="1.6" />
          <text x="-9" y="-9" style={{ fontSize: 7.5, fill: SOFT }}>
            0,5×
          </text>
          <text x="-33" y="6" style={{ fontSize: 7.5, fill: INK }}>
            1080p · 30 fps
          </text>
          <text x="-33" y="19" style={{ fontSize: 7.5, fill: INK }}>
            HDR
          </text>
          {/* Schalter: an → aus */}
          <rect x="-12" y="12" width="20" height="10" rx="5" fill={SAND} stroke={SOFT} strokeWidth="1" />
          <circle cx="3" cy="17" r="3.6" fill={TERRA} className="jn-toggle" />
          <text x="12" y="19" style={{ fontSize: 6.5, fill: SOFT }}>
            aus
          </text>
        </g>
      </g>

      {/* Hinweis unten */}
      <text x="120" y="153" textAnchor="middle" style={{ fontSize: 8.5, fill: SOFT }}>
        quer · Brusthöhe · Objektiv 1×
      </text>
    </svg>
  );
}

// -------------------------------------------------------------- 2 Aufnehmen
// Draufsicht der Wohnung (Gang, Bad, Küche, Wohnzimmer, Schlafzimmer). Ein
// Läufer geht mit Sichtkegel die Runde ab und dreht sich in jedem Raum.
const ROUTE =
  "M114 150 L114 94 L168 94 " + // Gang hoch, ins Wohnzimmer
  "a9 9 0 1 1 0.1 -0.1 " + // Drehung
  "L174 50 a9 9 0 1 1 0.1 -0.1 " + // Küche
  "L114 50 L114 94 L168 94 L168 134 a9 9 0 1 1 0.1 -0.1 " + // Schlafzimmer
  "L114 134 L114 22 a8 8 0 1 1 0.1 -0.1 " + // Bad
  "L114 150"; // zurück zur Tür

function Record(props: SvgProps) {
  return (
    <svg {...props} aria-label="Rundgang durch die Wohnung mit Drehung in jedem Raum">
      {/* Räume */}
      <g fill={SAND} stroke={INK} strokeWidth="2.5">
        <rect x="100" y="36" width="28" height="118" /> {/* Gang */}
        <rect x="90" y="8" width="48" height="28" /> {/* Bad */}
        <rect x="128" y="36" width="80" height="34" /> {/* Küche */}
        <rect x="128" y="70" width="80" height="48" /> {/* Wohnzimmer */}
        <rect x="128" y="118" width="80" height="36" /> {/* Schlafzimmer */}
      </g>
      {/* Türen / Durchgänge */}
      <g stroke={PAPER} strokeWidth="5">
        <line x1="108" y1="154" x2="122" y2="154" />
        <line x1="128" y1="88" x2="128" y2="100" />
        <line x1="152" y1="70" x2="170" y2="70" />
        <line x1="128" y1="128" x2="128" y2="140" />
        <line x1="108" y1="36" x2="120" y2="36" />
      </g>
      <g stroke={TERRA_DEEP} strokeWidth="2.5" strokeLinecap="round">
        <line x1="108" y1="154" x2="122" y2="154" />
        <line x1="128" y1="88" x2="128" y2="100" />
        <line x1="128" y1="128" x2="128" y2="140" />
        <line x1="108" y1="36" x2="120" y2="36" />
      </g>
      <line x1="152" y1="70" x2="170" y2="70" stroke={SAGE} strokeWidth="2.5" strokeLinecap="round" />
      {/* Fenster */}
      <g stroke={BLUE} strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round">
        <line x1="208" y1="80" x2="208" y2="108" />
        <line x1="208" y1="126" x2="208" y2="146" />
        <line x1="150" y1="36" x2="190" y2="36" />
      </g>
      {/* Beschriftung */}
      <g style={{ fontSize: 7, fill: SOFT }}>
        <text x="114" y="118" textAnchor="middle" transform="rotate(-90 114 118)">
          Gang
        </text>
        <text x="114" y="25" textAnchor="middle">
          Bad
        </text>
        <text x="168" y="56" textAnchor="middle">
          Küche
        </text>
        <text x="168" y="108" textAnchor="middle">
          Wohnzimmer
        </text>
        <text x="168" y="145" textAnchor="middle">
          Schlafzimmer
        </text>
      </g>

      {/* Route (leicht) */}
      <path d={ROUTE} fill="none" stroke={TERRA} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />

      {/* Läufer mit Sichtkegel — folgt der Route, dreht sich in den Schleifen */}
      <g className="jn-motion">
        <g>
          <path d="M0 0 L34 -14 L34 14 Z" fill={TERRA} fillOpacity="0.28" />
          <circle r="4.5" fill={INK} stroke={PAPER} strokeWidth="1.5" />
          <animateMotion dur="16s" repeatCount="indefinite" rotate="auto" path={ROUTE} />
        </g>
      </g>
      <g className="jn-motion-static">
        <circle cx="114" cy="150" r="4.5" fill={INK} stroke={PAPER} strokeWidth="1.5" />
      </g>

      {/* REC-Anzeige */}
      <g transform="translate(14 14)">
        <rect x="0" y="0" width="52" height="16" rx="8" fill={INK} />
        <circle cx="10" cy="8" r="3.5" fill="#e0483a" className="jn-blink" />
        <text x="18" y="11.5" style={{ fontSize: 8, fontWeight: 700, fill: PAPER, letterSpacing: 0.5 }}>
          REC
        </text>
      </g>
      {/* Zeitbalken: 2–4 Minuten */}
      <g transform="translate(14 40)">
        <text x="0" y="-4" style={{ fontSize: 7, fill: SOFT }}>
          2–4 Min gesamt
        </text>
        <rect x="0" y="0" width="60" height="5" rx="2.5" fill={SAND} />
        <rect x="0" y="0" width="60" height="5" rx="2.5" fill={SAGE} className="jn-timebar" />
      </g>
      <g transform="translate(14 64)" style={{ fontSize: 7, fill: SOFT }}>
        <text y="0">je Raum:</text>
        <text y="11">6 s Tür</text>
        <text y="22">20 s Drehung</text>
        <text y="33">Türen/Fenster</text>
      </g>
    </svg>
  );
}

// ------------------------------------------------------------ 3 Analysieren
// Standbilder wandern durch eine Abtastlinie, rechts zeichnet sich der
// Grundriss Raum für Raum, dann erscheinen die Maße.
function Analyze(props: SvgProps) {
  const frames = [0, 1, 2, 3];
  return (
    <svg {...props} aria-label="Standbilder werden analysiert, daraus entsteht der Grundriss">
      {/* Standbilder */}
      {frames.map((index) => (
        <g key={index} transform={`translate(22 ${28 + index * 26})`}>
          <g className="jn-frame" style={{ "--t": `${index * 0.6}s` } as React.CSSProperties}>
            <rect x="0" y="0" width="38" height="24" rx="2" fill={PAPER} stroke={INK} strokeWidth="1.5" />
            <path d="M4 18 L12 10 L18 15 L26 7 L34 14" fill="none" stroke={SOFT} strokeWidth="1.5" />
            <rect x="5" y="4" width="8" height="10" fill={TERRA_DEEP} opacity="0.8" />
          </g>
        </g>
      ))}

      {/* Abtastlinie */}
      <g transform="translate(96 0)">
        <line x1="0" y1="20" x2="0" y2="140" stroke={SAND} strokeWidth="2" />
        <rect x="-2" y="20" width="4" height="26" rx="2" fill={TERRA} className="jn-scan" />
      </g>

      {/* Grundriss zeichnet sich */}
      <g transform="translate(120 28)" fill="none" stroke={INK} strokeWidth="2.5">
        <rect x="0" y="0" width="26" height="100" className="jn-draw jn-draw-1" pathLength="100" />
        <rect x="26" y="0" width="76" height="46" className="jn-draw jn-draw-2" pathLength="100" />
        <rect x="26" y="46" width="76" height="54" className="jn-draw jn-draw-3" pathLength="100" />
      </g>
      <g transform="translate(120 28)" className="jn-late" fill={SAND} opacity="0.6">
        <rect x="1" y="1" width="24" height="98" />
        <rect x="27" y="1" width="74" height="44" />
        <rect x="27" y="47" width="74" height="52" />
      </g>
      {/* Maße */}
      <g transform="translate(120 28)" className="jn-late" style={{ fontSize: 7, fill: TERRA_DEEP, fontWeight: 600 }}>
        <text x="64" y="-5" textAnchor="middle">
          ≈ 4,2 m
        </text>
        <text x="110" y="76" textAnchor="middle" transform="rotate(90 110 76)">
          ≈ 3,1 m
        </text>
        <text x="13" y="112" textAnchor="middle" style={{ fill: SOFT, fontWeight: 400 }}>
          Gang
        </text>
        <text x="64" y="112" textAnchor="middle" style={{ fill: SOFT, fontWeight: 400 }}>
          Wohnen
        </text>
      </g>

      {/* Fortschritt */}
      <g transform="translate(22 146)">
        <rect x="0" y="0" width="196" height="5" rx="2.5" fill={SAND} />
        <rect x="0" y="0" width="196" height="5" rx="2.5" fill={TERRA} className="jn-progress" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------- 4 Grundriss prüfen
// Ein geschätzter (gestrichelter) Raum, eine Wand wird nachgezogen, das Maß
// springt um, der Raum wird bestätigt.
function Floorplan(props: SvgProps) {
  return (
    <svg {...props} aria-label="Wand verschieben, Maß korrigieren, Raum bestätigen">
      <g transform="translate(46 34)">
        {/* Raum: gestrichelt (Schätzung) → durchgezogen (bestätigt) */}
        <rect x="0" y="0" width="124" height="82" fill={SAND} stroke={INK} strokeWidth="3" strokeDasharray="8 6" className="jn-room-dashed" />
        <rect x="0" y="0" width="124" height="82" fill={SAND} stroke={INK} strokeWidth="3" className="jn-room-solid" />
        {/* Tür unten */}
        <line x1="26" y1="82" x2="52" y2="82" stroke={PAPER} strokeWidth="6" />
        <line x1="26" y1="82" x2="52" y2="82" stroke={TERRA_DEEP} strokeWidth="3" strokeLinecap="round" />
        {/* Fenster links */}
        <line x1="0" y1="20" x2="0" y2="52" stroke={PAPER} strokeWidth="6" />
        <line x1="0" y1="20" x2="0" y2="52" stroke={BLUE} strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" />

        {/* Griff an der rechten Wand + Pfeil */}
        <g className="jn-wall-shift">
          <circle cx="0" cy="41" r="6" fill={PAPER} stroke={TERRA} strokeWidth="2.5" />
          <path d="M10 41 h14 m-4 -4 l4 4 l-4 4" fill="none" stroke={TERRA} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="jn-arrow" />
        </g>

        {/* Maßlinie oben: 3,80 m → 4,10 m */}
        <g>
          <rect x="0" y="-12.5" width="124" height="1" fill={SOFT} className="jn-dim-line" />
          <line x1="0" y1="-16" x2="0" y2="-8" stroke={SOFT} strokeWidth="1" />
          <g className="jn-wall-shift">
            <line x1="0" y1="-16" x2="0" y2="-8" stroke={SOFT} strokeWidth="1" />
          </g>
          <rect x="44" y="-22" width="36" height="14" rx="3" fill={PAPER} />
          <text x="62" y="-11.5" textAnchor="middle" style={{ fontSize: 8.5, fill: SOFT }} className="jn-dim-a">
            ≈ 3,80 m
          </text>
          <text x="62" y="-11.5" textAnchor="middle" style={{ fontSize: 8.5, fill: TERRA_DEEP, fontWeight: 700 }} className="jn-dim-b">
            4,10 m
          </text>
        </g>

        {/* Zollstock */}
        <g transform="translate(30 30)" className="jn-ruler">
          <rect x="0" y="0" width="44" height="9" rx="1.5" fill="#f2c96b" stroke={INK} strokeWidth="1.2" />
          {[6, 12, 18, 24, 30, 36].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2={x % 12 === 0 ? 5 : 3} stroke={INK} strokeWidth="1" />
          ))}
        </g>

        {/* Bestätigt-Haken */}
        <g transform="translate(136 70)">
          <g className="jn-check">
            <circle r="11" fill={SAGE} />
            <path d="M-5 0 l3.5 3.5 l7 -7" fill="none" stroke={PAPER} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </g>
      <text x="120" y="150" textAnchor="middle" style={{ fontSize: 8.5, fill: SOFT }} className="jn-late">
        Maße bestätigen ✓
      </text>
    </svg>
  );
}

// -------------------------------------------------------------- 5 Einrichten
// Farbpalette erscheint, Möbel rücken nacheinander in den Raum, der
// Favoritenstern leuchtet auf.
function Design(props: SvgProps) {
  return (
    <svg {...props} aria-label="Farbpalette wählen, Möbel einrichten, Favorit markieren">
      <g transform="translate(24 30)">
        <rect x="0" y="0" width="130" height="104" fill="#EDE7D8" stroke={INK} strokeWidth="3" />
        {/* Wandfarbe */}
        <rect x="1.5" y="1.5" width="127" height="101" fill="#d8c3a5" opacity="0.35" className="jn-wall-tint" />
        <line x1="40" y1="104" x2="66" y2="104" stroke={PAPER} strokeWidth="6" />
        <line x1="40" y1="104" x2="66" y2="104" stroke={TERRA_DEEP} strokeWidth="3" strokeLinecap="round" />
        <line x1="130" y1="24" x2="130" y2="70" stroke={PAPER} strokeWidth="6" />
        <line x1="130" y1="24" x2="130" y2="70" stroke={BLUE} strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" />

        {/* Teppich */}
        <rect x="30" y="34" width="72" height="50" rx="4" fill="#c9b79c" opacity="0.6" className="jn-furn" style={{ "--t": "1.2s" } as React.CSSProperties} />
        {/* Bett */}
        <g className="jn-furn" style={{ "--t": "2s" } as React.CSSProperties}>
          <rect x="44" y="14" width="46" height="60" rx="3" fill="#e8e1d3" stroke={INK} strokeWidth="1.5" strokeOpacity="0.6" />
          <rect x="47" y="17" width="19" height="12" rx="2" fill={PAPER} stroke={INK} strokeWidth="1" strokeOpacity="0.4" />
          <rect x="68" y="17" width="19" height="12" rx="2" fill={PAPER} stroke={INK} strokeWidth="1" strokeOpacity="0.4" />
        </g>
        {/* Nachttische */}
        <rect x="30" y="14" width="11" height="11" rx="1.5" fill="#8b6a4e" className="jn-furn" style={{ "--t": "2.6s" } as React.CSSProperties} />
        <rect x="93" y="14" width="11" height="11" rx="1.5" fill="#8b6a4e" className="jn-furn" style={{ "--t": "2.6s" } as React.CSSProperties} />
        {/* Schrank */}
        <rect x="6" y="40" width="14" height="56" rx="1.5" fill="#6f5a45" className="jn-furn" style={{ "--t": "3.2s" } as React.CSSProperties} />
        {/* Pflanze */}
        <circle cx="116" cy="90" r="7" fill={SAGE} className="jn-furn" style={{ "--t": "3.7s" } as React.CSSProperties} />
      </g>

      {/* Palette */}
      <g transform="translate(176 36)">
        {[
          ["#f4efe6", 0],
          ["#d8c3a5", 1],
          ["#8b6a4e", 2],
          ["#8a9a7e", 3],
        ].map(([hex, index]) => (
          <g key={String(hex)} transform={`translate(0 ${Number(index) * 24})`}>
            <g className="jn-pop" style={{ "--t": `${0.3 + Number(index) * 0.45}s` } as React.CSSProperties}>
              <circle r="9" fill={String(hex)} stroke={INK} strokeWidth="1.2" strokeOpacity="0.5" />
            </g>
          </g>
        ))}
        <text x="0" y="90" textAnchor="middle" style={{ fontSize: 7, fill: SOFT }}>
          Palette
        </text>
      </g>

      {/* Favoritenstern */}
      <g transform="translate(206 128)">
        <g className="jn-pop" style={{ "--t": "5.2s" } as React.CSSProperties}>
          <path d="M0 -11 L3.3 -3.6 L11 -3.4 L4.9 1.6 L6.8 9 L0 4.8 L-6.8 9 L-4.9 1.6 L-11 -3.4 L-3.3 -3.6 Z" fill={TERRA} />
        </g>
      </g>
    </svg>
  );
}

// ----------------------------------------------------- 6 Erleben & Einkaufen
// Ein Raum in Schrägsicht, in dem eine Person umhergeht; daneben das
// fertige Konzept als Dokument und die Einkaufsliste mit Haken.
const WALK_3D = "M60 112 L102 92 L136 108 L96 128 Z";

function Experience(props: SvgProps) {
  return (
    <svg {...props} aria-label="3D-Rundgang, Konzept als PDF und Einkaufsliste">
      {/* Raum in Schrägsicht: Boden + zwei Wände */}
      <g transform="translate(0 0)">
        <path d="M40 120 L100 90 L160 120 L100 150 Z" fill="#d9cfb8" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M40 120 L40 60 L100 30 L100 90 Z" fill="#f0ebdf" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M100 90 L100 30 L160 60 L160 120 Z" fill="#e6dfd0" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        {/* Fenster an der rechten Wand */}
        <path d="M116 58 L140 70 L140 96 L116 84 Z" fill="#dbe7f0" stroke={BLUE} strokeWidth="1.8" />
        {/* Sofa auf dem Boden */}
        <path d="M60 104 L84 92 L104 102 L80 114 Z" fill="#8b6a4e" />
        <path d="M60 104 L60 110 L80 120 L80 114 Z" fill="#6f5a45" />
        <path d="M80 114 L80 120 L104 108 L104 102 Z" fill="#7a6350" />
        {/* Person geht umher */}
        <g className="jn-motion">
          <g>
            <circle r="4" fill={INK} stroke={PAPER} strokeWidth="1.5" />
            <path d="M0 0 L22 -9 L22 9 Z" fill={TERRA} fillOpacity="0.3" />
            <animateMotion dur="10s" repeatCount="indefinite" rotate="auto" path={WALK_3D} />
          </g>
        </g>
        <g className="jn-motion-static">
          <circle cx="60" cy="112" r="4" fill={INK} stroke={PAPER} strokeWidth="1.5" />
        </g>
      </g>

      {/* Dokument */}
      <g transform="translate(176 22)">
       <g className="jn-slide" style={{ "--t": "1s" } as React.CSSProperties}>
        <rect x="0" y="0" width="48" height="62" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.8" />
        <rect x="6" y="7" width="22" height="4" rx="1" fill={TERRA} />
        <rect x="6" y="16" width="36" height="14" rx="1.5" fill={SAND} stroke={INK} strokeWidth="1" strokeOpacity="0.4" />
        <rect x="6" y="35" width="36" height="2.5" rx="1" fill={SOFT} opacity="0.6" className="jn-grow" style={{ "--t": "1.8s" } as React.CSSProperties} />
        <rect x="6" y="41" width="30" height="2.5" rx="1" fill={SOFT} opacity="0.6" className="jn-grow" style={{ "--t": "2.2s" } as React.CSSProperties} />
        <rect x="6" y="47" width="33" height="2.5" rx="1" fill={SOFT} opacity="0.6" className="jn-grow" style={{ "--t": "2.6s" } as React.CSSProperties} />
        <text x="24" y="59" textAnchor="middle" style={{ fontSize: 6.5, fontWeight: 700, fill: TERRA_DEEP }}>
          PDF
        </text>
       </g>
      </g>

      {/* Einkaufsliste */}
      <g transform="translate(176 96)">
       <g className="jn-slide" style={{ "--t": "3.4s" } as React.CSSProperties}>
        <rect x="0" y="0" width="48" height="46" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.8" />
        {[0, 1, 2].map((index) => (
          <g key={index} transform={`translate(6 ${9 + index * 12})`}>
            <rect x="11" y="2" width="26" height="3" rx="1" fill={SOFT} opacity="0.5" />
            <g className="jn-pop" style={{ "--t": `${4.4 + index * 0.6}s` } as React.CSSProperties}>
              <rect x="0" y="0" width="7" height="7" rx="1.5" fill={SAGE} />
              <path d="M1.5 3.5 l1.8 1.8 l3 -3" fill="none" stroke={PAPER} strokeWidth="1.3" strokeLinecap="round" />
            </g>
          </g>
        ))}
       </g>
      </g>
    </svg>
  );
}
