"use client";

// Möbel selbst anordnen: ziehen, drehen, entfernen — direkt im Grundriss
// des Raums. Positionen werden beim Ziehen in den Raum geklemmt, damit kein
// Möbelstück in einer Wand landet.

import { useRef, useState } from "react";
import {
  openingWorldSegment,
  polygonBounds,
} from "@/lib/geometry/floorplan";
import { clampFurnitureIntoRoom } from "@/lib/geometry/furniture-fit";
import { fmtCm } from "@/lib/format";
import type { FloorPlanDoc, FurnitureItem, RoomShape, Vec2 } from "@/lib/types";
import { FURNITURE_KIND_LABELS } from "@/lib/types";

const SNAP_CM = 5;

function snap(value: number): number {
  return Math.round(value / SNAP_CM) * SNAP_CM;
}

export function FurniturePlanEditor({
  doc,
  room,
  furniture,
  floorColorHex,
  onChange,
}: {
  doc: FloorPlanDoc;
  room: RoomShape;
  furniture: FurnitureItem[];
  floorColorHex?: string;
  onChange: (next: FurnitureItem[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; grabDx: number; grabDy: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const bounds = polygonBounds([room.polygon]);
  const margin = 50;
  const viewBox = `${bounds.minX - margin} ${bounds.minY - margin} ${bounds.width + margin * 2} ${bounds.height + margin * 2}`;

  const selected = furniture.find((item) => item.id === selectedId) ?? null;

  const toWorld = (clientX: number, clientY: number): Vec2 => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [point.x, point.y];
  };

  const updateItem = (id: string, patch: Partial<FurnitureItem>) => {
    onChange(
      furniture.map((item) =>
        item.id === id ? clampFurnitureIntoRoom({ ...item, ...patch }, room) : item,
      ),
    );
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const [wx, wy] = toWorld(event.clientX, event.clientY);
    updateItem(drag.id, { x: snap(wx - drag.grabDx), y: snap(wy - drag.grabDy) });
  };

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    svgRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const rotateSelected = () => {
    if (!selected) return;
    updateItem(selected.id, { rotationDeg: (selected.rotationDeg + 90) % 360 });
  };

  const removeSelected = () => {
    if (!selected) return;
    onChange(furniture.filter((item) => item.id !== selected.id));
    setSelectedId(null);
  };

  const rugs = furniture.filter((item) => item.kind === "rug");
  const solid = furniture.filter((item) => item.kind !== "rug");
  const openings = doc.openings.filter(
    (opening) => opening.wall.roomId === room.id || opening.roomB === room.id,
  );

  return (
    <div className="space-y-3">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="max-h-96 w-full touch-none rounded-xl border border-line bg-white select-none"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={() => setSelectedId(null)}
        data-testid="furniture-editor"
      >
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
              <line x1={segment.a[0]} y1={segment.a[1]} x2={segment.b[0]} y2={segment.b[1]} stroke="#fff" strokeWidth={8} />
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

        {[...rugs, ...solid].map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <g
              key={item.id}
              transform={`rotate(${item.rotationDeg} ${item.x} ${item.y})`}
              className="cursor-move"
              data-testid="furniture-item"
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedId(item.id);
                const [wx, wy] = toWorld(event.clientX, event.clientY);
                dragRef.current = { id: item.id, grabDx: wx - item.x, grabDy: wy - item.y };
                svgRef.current?.setPointerCapture?.(event.pointerId);
              }}
            >
              <title>{item.label}</title>
              <rect
                x={item.x - item.wCm / 2}
                y={item.y - item.dCm / 2}
                width={item.wCm}
                height={item.dCm}
                rx={item.kind === "rug" ? 6 : 3}
                fill={item.colorHex}
                fillOpacity={item.kind === "rug" ? 0.55 : 0.92}
                stroke={isSelected ? "#b5674c" : "#26231d"}
                strokeOpacity={isSelected ? 1 : item.kind === "rug" ? 0.25 : 0.6}
                strokeWidth={isSelected ? 5 : 2}
              />
              {/* Vorderseite markieren, damit die Drehung ablesbar ist */}
              {item.kind !== "rug" && (
                <line
                  x1={item.x - item.wCm / 2 + 6}
                  y1={item.y + item.dCm / 2 - 4}
                  x2={item.x + item.wCm / 2 - 6}
                  y2={item.y + item.dCm / 2 - 4}
                  stroke="#26231d"
                  strokeOpacity={0.35}
                  strokeWidth={3}
                />
              )}
              {item.wCm >= 70 && item.dCm >= 45 && item.kind !== "rug" && (
                <text
                  x={item.x}
                  y={item.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none"
                  // Beschriftung immer aufrecht halten: ohne Gegenrotation stünde
                  // sie bei 180° auf dem Kopf und bei 90° quer.
                  transform={
                    item.rotationDeg !== 0 ? `rotate(${-item.rotationDeg} ${item.x} ${item.y})` : undefined
                  }
                  style={{ fontSize: 15, fill: "#26231d", opacity: 0.75 }}
                >
                  {item.label.split(",")[0].slice(0, 16)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {selected ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-sand/60 p-3">
          <div className="mr-auto">
            <p className="text-sm font-medium">{selected.label}</p>
            <p className="text-xs text-ink-soft">
              {FURNITURE_KIND_LABELS[selected.kind] ?? selected.kind} ·{" "}
              {fmtCm(selected.wCm)} × {fmtCm(selected.dCm)} · {selected.rotationDeg}°
            </p>
          </div>
          <button className="btn-secondary px-3 py-1.5 text-sm" onClick={rotateSelected} data-testid="rotate-furniture">
            ⟳ 90° drehen
          </button>
          <button className="btn-ghost text-sm text-terra-deep" onClick={removeSelected}>
            Entfernen
          </button>
        </div>
      ) : (
        <p className="text-xs text-ink-soft">
          Möbelstück antippen und ziehen. Ausgewählte Stücke lassen sich drehen oder entfernen;
          alles rastet auf {SNAP_CM} cm und bleibt automatisch im Raum.
        </p>
      )}
    </div>
  );
}
