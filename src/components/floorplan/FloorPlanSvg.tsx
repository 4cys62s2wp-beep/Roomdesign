// Reine Darstellung eines kompletten Grundrisses (eine Etage) — für den
// Export und überall dort, wo nicht bearbeitet werden soll.

import {
  docBounds,
  openingWorldSegment,
  polygonBounds,
  roomAreaM2,
} from "@/lib/geometry/floorplan";
import { fmtM2 } from "@/lib/format";
import type { FloorPlanDoc } from "@/lib/types";

const ROOM_FILLS: Record<string, string> = {
  hallway: "#EFE6D2",
  living: "#E4EAD9",
  kitchen: "#F3E4D2",
  bedroom: "#DFE6EC",
  bathroom: "#DCEAEA",
  wc: "#DCEAEA",
  office: "#EAE2EE",
  kids: "#F5E7DE",
  dining: "#F0E9D2",
  storage: "#E8E4DC",
  balcony: "#E3EEE0",
  other: "#EAE7DE",
};

export function FloorPlanSvg({
  doc,
  className,
  showLabels = true,
}: {
  doc: FloorPlanDoc;
  className?: string;
  showLabels?: boolean;
}) {
  const bounds = docBounds(doc);
  const margin = 70;
  const viewBox = `${bounds.minX - margin} ${bounds.minY - margin} ${bounds.width + margin * 2} ${bounds.height + margin * 2}`;

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label="Grundriss">
      {doc.rooms.map((room) => {
        const b = polygonBounds([room.polygon]);
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        return (
          <g key={room.id}>
            <polygon
              points={room.polygon.map((p) => p.join(",")).join(" ")}
              fill={ROOM_FILLS[room.type] ?? ROOM_FILLS.other}
              stroke="#26231d"
              strokeWidth={5}
            />
            {showLabels && (
              <>
                <text
                  x={cx}
                  y={cy - 6}
                  textAnchor="middle"
                  style={{ fontSize: 24, fontWeight: 600, fill: "#26231d" }}
                >
                  {room.name}
                </text>
                <text x={cx} y={cy + 20} textAnchor="middle" style={{ fontSize: 19, fill: "#57524a" }}>
                  {fmtM2(roomAreaM2(room))}
                </text>
              </>
            )}
          </g>
        );
      })}

      {doc.openings.map((opening) => {
        const segment = openingWorldSegment(doc, opening);
        if (!segment) return null;
        const color =
          opening.kind === "window" ? "#4d7ba6" : opening.kind === "passage" ? "#8a9a7e" : "#97523c";
        return (
          <g key={opening.id}>
            <line
              x1={segment.a[0]}
              y1={segment.a[1]}
              x2={segment.b[0]}
              y2={segment.b[1]}
              stroke="#fff"
              strokeWidth={9}
            />
            <line
              x1={segment.a[0]}
              y1={segment.a[1]}
              x2={segment.b[0]}
              y2={segment.b[1]}
              stroke={color}
              strokeWidth={5}
              strokeDasharray={opening.kind === "window" ? "9 6" : undefined}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
