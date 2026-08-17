// Draufsicht auf einen Raum: die drei Schritte des Aufnahme-Ablaufs.

export function RoomProtocolDiagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 720 260" className={className} role="img" aria-labelledby="protokoll-titel">
      <title id="protokoll-titel">
        Draufsicht eines Raums mit den drei Aufnahmeschritten: Überblick von der Tür, langsame
        Drehung in der Raummitte, Türen und Fenster einzeln zeigen
      </title>

      {[0, 1, 2].map((index) => (
        <g key={index} transform={`translate(${index * 245}, 0)`}>
          {/* Raum */}
          <rect x="20" y="34" width="200" height="150" fill="#EDE7D8" stroke="#26231d" strokeWidth="4" />
          {/* Tür unten links */}
          <line x1="60" y1="184" x2="110" y2="184" stroke="#FBF9F3" strokeWidth="7" />
          <line x1="60" y1="184" x2="110" y2="184" stroke="#97523c" strokeWidth="4" strokeLinecap="round" />
          {/* Fenster oben rechts */}
          <line x1="150" y1="34" x2="200" y2="34" stroke="#FBF9F3" strokeWidth="7" />
          <line
            x1="150"
            y1="34"
            x2="200"
            y2="34"
            stroke="#4d7ba6"
            strokeWidth="4"
            strokeDasharray="7 5"
            strokeLinecap="round"
          />

          {/* Schrittnummer */}
          <circle cx="34" cy="16" r="13" fill="#b5674c" />
          <text x="34" y="21" textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: "#fff" }}>
            {index + 1}
          </text>
        </g>
      ))}

      {/* Schritt 1: Position in der Tür, Sichtkegel in den Raum */}
      <g>
        <path d="M85 178 L35 60 L200 60 Z" fill="#b5674c" fillOpacity="0.16" />
        <circle cx="85" cy="180" r="8" fill="#26231d" />
        <text x="120" y="212" textAnchor="middle" style={{ fontSize: 14, fill: "#26231d" }}>
          Von der Tür aus
        </text>
        <text x="120" y="230" textAnchor="middle" style={{ fontSize: 13, fill: "#57524a" }}>
          Überblick, ca. 6 s
        </text>
      </g>

      {/* Schritt 2: Drehung in der Raummitte */}
      <g transform="translate(245, 0)">
        <circle cx="120" cy="109" r="52" fill="none" stroke="#b5674c" strokeWidth="3" strokeDasharray="9 7" />
        <path d="M120 57 A52 52 0 0 1 168 92" fill="none" stroke="#b5674c" strokeWidth="4" />
        <path d="M168 92 l7 -13 l-14 3 z" fill="#b5674c" />
        <circle cx="120" cy="109" r="8" fill="#26231d" />
        <text x="120" y="212" textAnchor="middle" style={{ fontSize: 14, fill: "#26231d" }}>
          360° in der Mitte
        </text>
        <text x="120" y="230" textAnchor="middle" style={{ fontSize: 13, fill: "#57524a" }}>
          langsam, 20 s
        </text>
      </g>

      {/* Schritt 3: Tür und Fenster gezielt anvisieren */}
      <g transform="translate(490, 0)">
        <circle cx="120" cy="109" r="8" fill="#26231d" />
        <line x1="120" y1="109" x2="85" y2="180" stroke="#97523c" strokeWidth="3" strokeDasharray="6 5" />
        <path d="M85 180 l13 -6 l-3 -12 z" fill="#97523c" />
        <line x1="120" y1="109" x2="175" y2="38" stroke="#4d7ba6" strokeWidth="3" strokeDasharray="6 5" />
        <path d="M175 38 l-13 4 l1 12 z" fill="#4d7ba6" />
        <text x="120" y="212" textAnchor="middle" style={{ fontSize: 14, fill: "#26231d" }}>
          Tür &amp; Fenster einzeln
        </text>
        <text x="120" y="230" textAnchor="middle" style={{ fontSize: 13, fill: "#57524a" }}>
          komplett von oben bis unten
        </text>
      </g>
    </svg>
  );
}
