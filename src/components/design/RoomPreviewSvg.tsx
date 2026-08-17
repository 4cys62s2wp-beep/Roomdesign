// Kleine 2D-Vorschau: Raumpolygon + Öffnungen + Möbel-Grundrisse eines Vorschlags.

import { openingWorldSegment, polygonBounds } from "@/lib/geometry/floorplan";
import type { FloorPlanDoc, FurnitureItem, RoomShape } from "@/lib/types";

export function RoomPreviewSvg({
  doc,
  room,
  furniture,
  floorColorHex,
  className,
}: {
  doc: FloorPlanDoc;
  room: RoomShape;
  furniture: FurnitureItem[];
  floorColorHex?: string;
  className?: string;
}) {
  const bounds = polygonBounds([room.polygon]);
  const margin = 40;
  const viewBox = `${bounds.minX - margin} ${bounds.minY - margin} ${bounds.width + margin * 2} ${bounds.height + margin * 2}`;

  const openings = doc.openings.filter(
    (opening) => opening.wall.roomId === room.id || opening.roomB === room.id,
  );

  const rugs = furniture.filter((item) => item.kind === "rug");
  const solid = furniture.filter((item) => item.kind !== "rug");

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={`Grundriss ${room.name}`}>
      <polygon
        points={room.polygon.map((p) => p.join(",")).join(" ")}
        fill={floorColorHex ?? "#EDE7D8"}
        stroke="#26231d"
        strokeWidth={6}
      />
      {openings.map((opening) => {
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
              strokeWidth={8}
            />
            <line
              x1={segment.a[0]}
              y1={segment.a[1]}
              x2={segment.b[0]}
              y2={segment.b[1]}
              stroke={color}
              strokeWidth={5}
              strokeDasharray={opening.kind === "window" ? "8 5" : undefined}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {[...rugs, ...solid].map((item) => (
        <g key={item.id} transform={`rotate(${item.rotationDeg} ${item.x} ${item.y})`}>
          <rect
            x={item.x - item.wCm / 2}
            y={item.y - item.dCm / 2}
            width={item.wCm}
            height={item.dCm}
            rx={item.kind === "rug" ? 6 : 3}
            fill={item.colorHex}
            fillOpacity={item.kind === "rug" ? 0.55 : 0.92}
            stroke="#26231d"
            strokeOpacity={item.kind === "rug" ? 0.25 : 0.6}
            strokeWidth={2}
          />
          {item.wCm >= 70 && item.dCm >= 45 && item.kind !== "rug" && (
            <text
              x={item.x}
              y={item.y}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={
                item.rotationDeg % 180 !== 0 ? `rotate(${-item.rotationDeg} ${item.x} ${item.y})` : undefined
              }
              style={{ fontSize: 15, fill: "#26231d", opacity: 0.75 }}
            >
              {shortLabel(item)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function shortLabel(item: FurnitureItem): string {
  const label = item.label.split(",")[0].split(" – ")[0];
  return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}
