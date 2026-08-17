"use client";

// Interaktiver SVG-Grundriss-Editor.
// - Räume: auswählen, verschieben, Ecken ziehen, Maße numerisch ändern
// - Öffnungen (Türen/Fenster/Durchgänge): auswählen, entlang der Wand
//   verschieben, Breite/Höhe/Brüstung ändern, anlegen, löschen
// - Undo, Zoom/Pan, Speichern mit Versionierung

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/client";
import {
  clampOpeningToEdge,
  docBounds,
  openingWorldSegment,
  polygonBounds,
  projectOnEdge,
  rect,
  roomAreaM2,
  roomEdge,
  validateFloorPlan,
} from "@/lib/geometry/floorplan";
import { fmtM2, fmtMeters } from "@/lib/format";
import type { FloorPlanDoc, Opening, RoomShape, RoomType, Vec2 } from "@/lib/types";
import { ROOM_TYPE_LABELS } from "@/lib/types";

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

type Selection =
  | { kind: "room"; roomId: string }
  | { kind: "opening"; openingId: string }
  | { kind: "edge"; roomId: string; edgeIndex: number }
  | null;

type DragState =
  | { type: "vertex"; roomId: string; index: number }
  | { type: "room"; roomId: string; start: Vec2; original: Vec2[] }
  | { type: "opening"; openingId: string }
  | { type: "pan"; start: [number, number]; originalViewBox: [number, number, number, number] }
  | null;

const SNAP = 5;

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

function clone(doc: FloorPlanDoc): FloorPlanDoc {
  return JSON.parse(JSON.stringify(doc)) as FloorPlanDoc;
}

export function FloorPlanEditor({ projectId }: { projectId: string }) {
  const [doc, setDoc] = useState<FloorPlanDoc | null>(null);
  const [meta, setMeta] = useState<{ version: number; source: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [viewBox, setViewBox] = useState<[number, number, number, number] | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState>(null);
  const historyRef = useRef<FloorPlanDoc[]>([]);

  // ---------------------------------------------------------------- Laden
  useEffect(() => {
    void fetchJson<{ data: FloorPlanDoc; version: number; source: string }>(
      `/api/projects/${projectId}/floorplan`,
    )
      .then((response) => {
        setDoc(response.data);
        setMeta({ version: response.version, source: response.source });
        const bounds = docBounds(response.data);
        const margin = 80;
        setViewBox([
          bounds.minX - margin,
          bounds.minY - margin,
          bounds.width + margin * 2,
          bounds.height + margin * 2,
        ]);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));
  }, [projectId]);

  const pushHistory = useCallback(() => {
    if (!doc) return;
    historyRef.current.push(clone(doc));
    if (historyRef.current.length > 60) historyRef.current.shift();
  }, [doc]);

  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (previous) {
      setDoc(previous);
      setDirty(true);
    }
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  const mutate = useCallback(
    (fn: (draft: FloorPlanDoc) => void, withHistory = true) => {
      setDoc((current) => {
        if (!current) return current;
        if (withHistory) {
          historyRef.current.push(clone(current));
          if (historyRef.current.length > 60) historyRef.current.shift();
        }
        const draft = clone(current);
        fn(draft);
        return draft;
      });
      setDirty(true);
    },
    [],
  );

  // ------------------------------------------------------- Koordinaten
  const toWorld = useCallback((clientX: number, clientY: number): Vec2 => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [point.x, point.y];
  }, []);

  // ------------------------------------------------------- Pointer-Logik
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || !doc) return;
    const [wx, wy] = toWorld(event.clientX, event.clientY);

    if (drag.type === "pan") {
      const svg = svgRef.current;
      if (!svg) return;
      const scaleX = drag.originalViewBox[2] / svg.clientWidth;
      const dx = (event.clientX - drag.start[0]) * scaleX;
      const dy = (event.clientY - drag.start[1]) * scaleX;
      setViewBox([
        drag.originalViewBox[0] - dx,
        drag.originalViewBox[1] - dy,
        drag.originalViewBox[2],
        drag.originalViewBox[3],
      ]);
      return;
    }

    if (drag.type === "vertex") {
      setDoc((current) => {
        if (!current) return current;
        const draft = clone(current);
        const room = draft.rooms.find((r) => r.id === drag.roomId);
        if (!room) return current;
        room.polygon[drag.index] = [snap(wx), snap(wy)];
        draft.openings = draft.openings.map((opening) =>
          opening.wall.roomId === room.id ? clampOpeningToEdge(draft, opening) : opening,
        );
        return draft;
      });
      setDirty(true);
      return;
    }

    if (drag.type === "room") {
      const dx = snap(wx - drag.start[0]);
      const dy = snap(wy - drag.start[1]);
      setDoc((current) => {
        if (!current) return current;
        const draft = clone(current);
        const room = draft.rooms.find((r) => r.id === drag.roomId);
        if (!room) return current;
        room.polygon = drag.original.map(([x, y]) => [x + dx, y + dy] as Vec2);
        return draft;
      });
      setDirty(true);
      return;
    }

    if (drag.type === "opening") {
      setDoc((current) => {
        if (!current) return current;
        const draft = clone(current);
        const opening = draft.openings.find((o) => o.id === drag.openingId);
        if (!opening) return current;
        const room = draft.rooms.find((r) => r.id === opening.wall.roomId);
        if (!room) return current;
        const edge = roomEdge(room, opening.wall.edgeIndex);
        const projection = projectOnEdge(edge, [wx, wy]);
        opening.offsetCm = snap(projection.t - opening.widthCm / 2);
        Object.assign(opening, clampOpeningToEdge(draft, opening));
        return draft;
      });
      setDirty(true);
    }
  };

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current && dragRef.current.type !== "pan") {
      // Verlauf wurde beim Drag-Start gesichert
    }
    dragRef.current = null;
    svgRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const startDrag = (event: React.PointerEvent, state: NonNullable<DragState>) => {
    event.stopPropagation();
    if (state.type !== "pan") pushHistory();
    dragRef.current = state;
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const onBackgroundPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!viewBox) return;
    setSelection(null);
    dragRef.current = {
      type: "pan",
      start: [event.clientX, event.clientY],
      originalViewBox: viewBox,
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (!viewBox) return;
    const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
    const [wx, wy] = toWorld(event.clientX, event.clientY);
    const [x, y, w, h] = viewBox;
    const nw = Math.min(20000, Math.max(200, w * factor));
    const nh = (nw / w) * h;
    setViewBox([wx - ((wx - x) / w) * nw, wy - ((wy - y) / h) * nh, nw, nh]);
  };

  // ------------------------------------------------------- Aktionen
  const addRoom = () => {
    if (!doc) return;
    const bounds = docBounds(doc);
    const id = `raum-${Date.now().toString(36)}`;
    mutate((draft) => {
      draft.rooms.push({
        id,
        name: "Neuer Raum",
        type: "other",
        polygon: rect(bounds.maxX + 60, bounds.minY, 300, 300),
        ceilingHeightCm: 250,
        confidence: 1,
      });
    });
    setSelection({ kind: "room", roomId: id });
  };

  const deleteRoom = (roomId: string) => {
    mutate((draft) => {
      draft.rooms = draft.rooms.filter((room) => room.id !== roomId);
      draft.openings = draft.openings.filter(
        (opening) => opening.wall.roomId !== roomId && opening.roomB !== roomId,
      );
    });
    setSelection(null);
  };

  const updateRoom = (roomId: string, patch: Partial<RoomShape>) => {
    mutate((draft) => {
      const room = draft.rooms.find((r) => r.id === roomId);
      if (room) Object.assign(room, patch);
    });
  };

  const resizeRoomBBox = (roomId: string, newW: number, newH: number) => {
    mutate((draft) => {
      const room = draft.rooms.find((r) => r.id === roomId);
      if (!room) return;
      const bounds = polygonBounds([room.polygon]);
      if (bounds.width < 1 || bounds.height < 1) return;
      const sx = newW / bounds.width;
      const sy = newH / bounds.height;
      room.polygon = room.polygon.map(
        ([x, y]) => [snap(bounds.minX + (x - bounds.minX) * sx), snap(bounds.minY + (y - bounds.minY) * sy)] as Vec2,
      );
      draft.openings = draft.openings.map((opening) =>
        opening.wall.roomId === roomId ? clampOpeningToEdge(draft, opening) : opening,
      );
    });
  };

  const addOpening = (roomId: string, edgeIndex: number, kind: Opening["kind"]) => {
    if (!doc) return;
    const room = doc.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const edge = roomEdge(room, edgeIndex);
    const width = kind === "window" ? 120 : kind === "passage" ? 140 : 90;
    const id = `opening-${Date.now().toString(36)}`;
    mutate((draft) => {
      draft.openings.push(
        clampOpeningToEdge(draft, {
          id,
          kind,
          wall: { roomId, edgeIndex },
          roomB: null,
          offsetCm: Math.max(5, edge.length / 2 - width / 2),
          widthCm: width,
          heightCm: kind === "window" ? 130 : kind === "passage" ? 210 : 200,
          ...(kind === "window" ? { sillCm: 90 } : {}),
        }),
      );
    });
    setSelection({ kind: "opening", openingId: id });
  };

  const updateOpening = (openingId: string, patch: Partial<Opening>) => {
    mutate((draft) => {
      const opening = draft.openings.find((o) => o.id === openingId);
      if (!opening) return;
      Object.assign(opening, patch);
      Object.assign(opening, clampOpeningToEdge(draft, opening));
    });
  };

  const deleteOpening = (openingId: string) => {
    mutate((draft) => {
      draft.openings = draft.openings.filter((o) => o.id !== openingId);
    });
    setSelection(null);
  };

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetchJson<{ version: number; warnings: string[] }>(
        `/api/projects/${projectId}/floorplan`,
        { method: "PUT", body: JSON.stringify({ data: doc }) },
      );
      setMeta((current) => (current ? { ...current, version: response.version, source: "manual" } : current));
      setWarnings(response.warnings);
      setDirty(false);
      setSaveMessage(`Gespeichert (Version ${response.version})`);
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------- Abgeleitetes
  const issues = useMemo(() => (doc ? validateFloorPlan(doc) : []), [doc]);
  const selectedRoom =
    doc && selection?.kind === "room" ? doc.rooms.find((r) => r.id === selection.roomId) : null;
  const selectedOpening =
    doc && selection?.kind === "opening"
      ? doc.openings.find((o) => o.id === selection.openingId)
      : null;
  const selectedEdge = selection?.kind === "edge" ? selection : null;

  if (loadError) {
    return (
      <div className="card text-sm">
        {loadError} — Starte zuerst eine{" "}
        <a href={`/projects/${projectId}/capture`} className="underline">
          Analyse
        </a>
        .
      </div>
    );
  }
  if (!doc || !viewBox) return <p className="text-sm text-ink-soft">Wird geladen …</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* -------------------------------------------------- Zeichenfläche */}
      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <button className="btn-secondary px-3 py-1.5" onClick={addRoom}>
            + Raum
          </button>
          <button className="btn-ghost" onClick={undo} title="Strg+Z">
            ↩ Rückgängig
          </button>
          <div className="ml-auto flex items-center gap-2">
            {meta && (
              <span className="badge">
                Version {meta.version} · {meta.source === "ai" ? "KI" : meta.source === "demo" ? "Demo" : "manuell"}
              </span>
            )}
            {saveMessage && <span className="text-xs text-ink-soft">{saveMessage}</span>}
            <button className="btn-primary px-3.5 py-1.5" onClick={save} disabled={saving || !dirty} data-testid="save-floorplan">
              {saving ? "Speichert …" : dirty ? "Speichern" : "Gespeichert ✓"}
            </button>
          </div>
        </div>
        <svg
          ref={svgRef}
          viewBox={viewBox.join(" ")}
          className="h-[520px] w-full touch-none bg-[#FBF9F3] select-none"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={onBackgroundPointerDown}
          onWheel={onWheel}
          data-testid="floorplan-svg"
        >
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#e8e2d2" strokeWidth="1" />
            </pattern>
          </defs>
          <rect
            x={viewBox[0]}
            y={viewBox[1]}
            width={viewBox[2]}
            height={viewBox[3]}
            fill="url(#grid)"
          />

          {/* Räume */}
          {doc.rooms.map((room) => {
            const isSelected = selection?.kind === "room" && selection.roomId === room.id;
            const centroid = polygonBounds([room.polygon]);
            const cx = (centroid.minX + centroid.maxX) / 2;
            const cy = (centroid.minY + centroid.maxY) / 2;
            const uncertain = room.confidence < 0.85;
            return (
              <g key={room.id}>
                <polygon
                  points={room.polygon.map((p) => p.join(",")).join(" ")}
                  fill={ROOM_FILLS[room.type] ?? ROOM_FILLS.other}
                  stroke={isSelected ? "#b5674c" : "#26231d"}
                  strokeWidth={isSelected ? 6 : 4}
                  strokeDasharray={uncertain ? "14 8" : undefined}
                  className="cursor-pointer"
                  onPointerDown={(event) => {
                    setSelection({ kind: "room", roomId: room.id });
                    startDrag(event, {
                      type: "room",
                      roomId: room.id,
                      start: toWorld(event.clientX, event.clientY),
                      original: room.polygon.map((p) => [...p] as Vec2),
                    });
                  }}
                />
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  className="pointer-events-none"
                  style={{ fontSize: 26, fontWeight: 600, fill: "#26231d" }}
                >
                  {room.name}
                </text>
                <text
                  x={cx}
                  y={cy + 22}
                  textAnchor="middle"
                  className="pointer-events-none"
                  style={{ fontSize: 20, fill: "#57524a" }}
                >
                  {uncertain ? "≈ " : ""}
                  {fmtM2(roomAreaM2(room))}
                </text>

                {/* Kanten-Klickziele + Maße für ausgewählten Raum */}
                {isSelected &&
                  room.polygon.map((_, edgeIndex) => {
                    const edge = roomEdge(room, edgeIndex);
                    const mx = (edge.a[0] + edge.b[0]) / 2;
                    const my = (edge.a[1] + edge.b[1]) / 2;
                    const isEdgeSelected =
                      selectedEdge?.roomId === room.id && selectedEdge.edgeIndex === edgeIndex;
                    return (
                      <g key={edgeIndex}>
                        <line
                          x1={edge.a[0]}
                          y1={edge.a[1]}
                          x2={edge.b[0]}
                          y2={edge.b[1]}
                          stroke={isEdgeSelected ? "#b5674c" : "transparent"}
                          strokeWidth={16}
                          className="cursor-pointer"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setSelection({ kind: "edge", roomId: room.id, edgeIndex });
                          }}
                        />
                        <text
                          x={mx + edge.dir[1] * 26}
                          y={my - edge.dir[0] * 26}
                          textAnchor="middle"
                          className="pointer-events-none"
                          style={{ fontSize: 17, fill: "#97523c" }}
                        >
                          {fmtMeters(edge.length)}
                        </text>
                      </g>
                    );
                  })}

                {/* Eckpunkte des ausgewählten Raums */}
                {isSelected &&
                  room.polygon.map((point, index) => (
                    <circle
                      key={index}
                      cx={point[0]}
                      cy={point[1]}
                      r={12}
                      fill="#b5674c"
                      stroke="#fff"
                      strokeWidth={3}
                      className="cursor-grab"
                      onPointerDown={(event) =>
                        startDrag(event, { type: "vertex", roomId: room.id, index })
                      }
                    />
                  ))}
              </g>
            );
          })}

          {/* Öffnungen */}
          {doc.openings.map((opening) => {
            const segment = openingWorldSegment(doc, opening);
            if (!segment) return null;
            const isSelected = selection?.kind === "opening" && selection.openingId === opening.id;
            const color =
              opening.kind === "window" ? "#4d7ba6" : opening.kind === "passage" ? "#8a9a7e" : "#97523c";
            return (
              <g
                key={opening.id}
                className="cursor-pointer"
                onPointerDown={(event) => {
                  setSelection({ kind: "opening", openingId: opening.id });
                  startDrag(event, { type: "opening", openingId: opening.id });
                }}
              >
                {/* Wandöffnung freistellen */}
                <line
                  x1={segment.a[0]}
                  y1={segment.a[1]}
                  x2={segment.b[0]}
                  y2={segment.b[1]}
                  stroke="#FBF9F3"
                  strokeWidth={10}
                />
                <line
                  x1={segment.a[0]}
                  y1={segment.a[1]}
                  x2={segment.b[0]}
                  y2={segment.b[1]}
                  stroke={color}
                  strokeWidth={isSelected ? 10 : 6}
                  strokeDasharray={
                    opening.kind === "window" ? "10 6" : opening.kind === "passage" ? "4 8" : undefined
                  }
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* -------------------------------------------------- Seitenpanel */}
      <div className="space-y-4">
        {issues.length > 0 && (
          <div className="card border-terra/40 bg-terra/5 text-xs leading-relaxed text-terra-deep">
            {issues.slice(0, 4).map((issue, index) => (
              <p key={index}>• {issue.message}</p>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="card text-xs leading-relaxed text-ink-soft">
            {warnings.map((warning, index) => (
              <p key={index}>⚠ {warning}</p>
            ))}
          </div>
        )}

        {selectedRoom && (
          <div className="card space-y-3" data-testid="room-panel">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Raum bearbeiten</h2>
              {selectedRoom.confidence < 0.85 && (
                <span className="badge border-terra/40 text-terra-deep">KI-Schätzung</span>
              )}
            </div>
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={selectedRoom.name}
                onChange={(event) => updateRoom(selectedRoom.id, { name: event.target.value })}
              />
            </div>
            <div>
              <label className="label">Raumtyp</label>
              <select
                className="input"
                value={selectedRoom.type}
                onChange={(event) =>
                  updateRoom(selectedRoom.id, { type: event.target.value as RoomType })
                }
              >
                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <RoomSizeInputs room={selectedRoom} onResize={resizeRoomBBox} />
            <div>
              <label className="label">Deckenhöhe (cm)</label>
              <input
                type="number"
                className="input"
                value={Math.round(selectedRoom.ceilingHeightCm)}
                onChange={(event) =>
                  updateRoom(selectedRoom.id, { ceilingHeightCm: Number(event.target.value) || 250 })
                }
              />
            </div>
            {selectedRoom.confidence < 1 && (
              <button
                className="btn-secondary w-full"
                onClick={() => updateRoom(selectedRoom.id, { confidence: 1 })}
              >
                Maße bestätigen ✓
              </button>
            )}
            <p className="text-xs text-ink-soft">
              Tipp: Klicke eine Wand des Raums an, um dort eine Tür oder ein Fenster einzufügen.
              Ecken lassen sich mit den orangen Punkten ziehen.
            </p>
            <button
              className="btn-ghost w-full text-terra-deep"
              onClick={() => deleteRoom(selectedRoom.id)}
            >
              Raum löschen
            </button>
          </div>
        )}

        {selectedEdge && doc.rooms.some((r) => r.id === selectedEdge.roomId) && (
          <div className="card space-y-3">
            <h2 className="font-display text-lg font-semibold">
              Wand {selectedEdge.edgeIndex + 1} ·{" "}
              {doc.rooms.find((r) => r.id === selectedEdge.roomId)?.name}
            </h2>
            <p className="text-xs text-ink-soft">Neue Öffnung auf dieser Wand einfügen:</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                className="btn-secondary"
                onClick={() => addOpening(selectedEdge.roomId, selectedEdge.edgeIndex, "door")}
              >
                Tür
              </button>
              <button
                className="btn-secondary"
                onClick={() => addOpening(selectedEdge.roomId, selectedEdge.edgeIndex, "window")}
              >
                Fenster
              </button>
              <button
                className="btn-secondary"
                onClick={() => addOpening(selectedEdge.roomId, selectedEdge.edgeIndex, "passage")}
              >
                Durchgang
              </button>
            </div>
          </div>
        )}

        {selectedOpening && (
          <div className="card space-y-3">
            <h2 className="font-display text-lg font-semibold">
              {selectedOpening.kind === "door"
                ? "Tür"
                : selectedOpening.kind === "window"
                  ? "Fenster"
                  : "Durchgang"}{" "}
              bearbeiten
            </h2>
            <div>
              <label className="label">Art</label>
              <select
                className="input"
                value={selectedOpening.kind}
                onChange={(event) =>
                  updateOpening(selectedOpening.id, {
                    kind: event.target.value as Opening["kind"],
                    ...(event.target.value === "window" ? { sillCm: selectedOpening.sillCm ?? 90 } : {}),
                  })
                }
              >
                <option value="door">Tür</option>
                <option value="window">Fenster</option>
                <option value="passage">Durchgang</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Breite (cm)</label>
                <input
                  type="number"
                  className="input"
                  value={Math.round(selectedOpening.widthCm)}
                  onChange={(event) =>
                    updateOpening(selectedOpening.id, { widthCm: Number(event.target.value) || 90 })
                  }
                />
              </div>
              <div>
                <label className="label">Höhe (cm)</label>
                <input
                  type="number"
                  className="input"
                  value={Math.round(selectedOpening.heightCm)}
                  onChange={(event) =>
                    updateOpening(selectedOpening.id, { heightCm: Number(event.target.value) || 200 })
                  }
                />
              </div>
            </div>
            {selectedOpening.kind === "window" && (
              <div>
                <label className="label">Brüstungshöhe (cm)</label>
                <input
                  type="number"
                  className="input"
                  value={Math.round(selectedOpening.sillCm ?? 90)}
                  onChange={(event) =>
                    updateOpening(selectedOpening.id, { sillCm: Number(event.target.value) || 90 })
                  }
                />
              </div>
            )}
            <p className="text-xs text-ink-soft">
              Öffnungen lassen sich direkt im Plan entlang ihrer Wand verschieben.
            </p>
            <button
              className="btn-ghost w-full text-terra-deep"
              onClick={() => deleteOpening(selectedOpening.id)}
            >
              Öffnung löschen
            </button>
          </div>
        )}

        {!selection && (
          <div className="card space-y-2 text-sm leading-relaxed text-ink-soft">
            <h2 className="font-display text-lg font-semibold text-ink">So funktioniert&apos;s</h2>
            <p>• Raum antippen: auswählen & verschieben</p>
            <p>• Orange Eckpunkte ziehen: Form ändern</p>
            <p>• Wand antippen: Tür/Fenster einfügen</p>
            <p>• Öffnung antippen: bearbeiten & verschieben</p>
            <p>• Mausrad: zoomen · Fläche ziehen: verschieben</p>
            <p>
              Gestrichelte Räume sind unbestätigte KI-Schätzungen — prüfe die Maße und bestätige
              sie im Raum-Panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RoomSizeInputs({
  room,
  onResize,
}: {
  room: RoomShape;
  onResize: (roomId: string, w: number, h: number) => void;
}) {
  const bounds = polygonBounds([room.polygon]);
  const [width, setWidth] = useState(Math.round(bounds.width));
  const [height, setHeight] = useState(Math.round(bounds.height));

  useEffect(() => {
    setWidth(Math.round(bounds.width));
    setHeight(Math.round(bounds.height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, Math.round(bounds.width), Math.round(bounds.height)]);

  const apply = () => {
    if (width >= 50 && height >= 50) onResize(room.id, width, height);
  };

  return (
    <div>
      <label className="label">Außenmaße Breite × Tiefe (cm)</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input"
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
          onBlur={apply}
          data-testid="room-width"
        />
        <span className="text-ink-soft">×</span>
        <input
          type="number"
          className="input"
          value={height}
          onChange={(event) => setHeight(Number(event.target.value))}
          onBlur={apply}
        />
      </div>
    </div>
  );
}
