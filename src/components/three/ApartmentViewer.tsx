"use client";

// 3D-Viewer: baut die Wohnung aus dem FloorPlanDoc (Böden, Wände mit
// Öffnungen, Fensterglas) und möbliert sie mit dem gewählten Vorschlag je
// Raum. Orbit-Ansicht und Ego-Rundgang (WASD + Maus).

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PointerLockControls } from "@react-three/drei";
import { fetchJson } from "@/lib/client";
import { buildWalls } from "@/lib/geometry/walls";
import { docBounds, openingWorldSegment } from "@/lib/geometry/floorplan";
import type { FloorPlanDoc, ProposalDoc, Vec2 } from "@/lib/types";
import { resolveMove, walkStartPoint } from "@/lib/geometry/walk";
import { Furniture } from "@/components/three/furniture";

interface FloorPlanResponse {
  data: FloorPlanDoc;
  rooms: Array<{ id: string; key: string; name: string }>;
}

interface ProposalRow {
  id: string;
  title: string;
  isFavorite: boolean;
  data: ProposalDoc;
}

type ProposalsByRoom = Record<string, ProposalRow[]>; // key = FloorPlan-Raum-Key

export function ApartmentViewer({
  projectId,
  initialProposalId,
}: {
  projectId: string;
  initialProposalId?: string | null;
}) {
  const [plan, setPlan] = useState<FloorPlanResponse | null>(null);
  const [proposalsByRoom, setProposalsByRoom] = useState<ProposalsByRoom>({});
  const [selected, setSelected] = useState<Record<string, string | "">>({});
  const [furnished, setFurnished] = useState(true);
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const planResponse = await fetchJson<FloorPlanResponse>(
          `/api/projects/${projectId}/floorplan`,
        );
        if (cancelled) return;
        setPlan(planResponse);

        const byRoom: ProposalsByRoom = {};
        const initialSelection: Record<string, string | ""> = {};
        await Promise.all(
          planResponse.rooms.map(async (room) => {
            const rows = await fetchJson<ProposalRow[]>(`/api/rooms/${room.id}/proposals`);
            byRoom[room.key] = rows;
            const fromUrl = initialProposalId
              ? rows.find((row) => row.id === initialProposalId)
              : undefined;
            const fallback = rows.find((row) => row.isFavorite) ?? rows[0];
            initialSelection[room.key] = (fromUrl ?? fallback)?.id ?? "";
          }),
        );
        if (cancelled) return;
        setProposalsByRoom(byRoom);
        setSelected(initialSelection);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, initialProposalId]);

  const activeProposals = useMemo(() => {
    const map: Record<string, ProposalDoc | undefined> = {};
    for (const [roomKey, proposalId] of Object.entries(selected)) {
      if (!proposalId) continue;
      map[roomKey] = proposalsByRoom[roomKey]?.find((row) => row.id === proposalId)?.data;
    }
    return map;
  }, [selected, proposalsByRoom]);

  if (error) {
    return <div className="card text-sm text-terra-deep">{error}</div>;
  }
  if (!plan) return <p className="text-sm text-ink-soft">3D-Ansicht wird geladen …</p>;

  const bounds = docBounds(plan.data);
  const center: [number, number, number] = [
    (bounds.minX + bounds.maxX) / 200,
    0,
    (bounds.minY + bounds.maxY) / 200,
  ];
  const size = Math.max(bounds.width, bounds.height) / 100;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="card relative overflow-hidden p-0">
        <Canvas
          camera={{ position: [center[0], size * 0.9 + 3, center[2] + size * 0.75], fov: 50 }}
          className="h-[560px]! w-full touch-none"
          data-testid="canvas3d"
        >
          <color attach="background" args={["#EDE8DB"]} />
          <hemisphereLight intensity={0.55} color="#fffaf0" groundColor="#b0a58f" />
          <directionalLight position={[6, 12, 4]} intensity={1.1} />
          <ambientLight intensity={0.25} />
          <ApartmentMesh doc={plan.data} proposals={activeProposals} furnished={furnished} />
          {mode === "orbit" ? (
            <OrbitControls target={center} maxPolarAngle={Math.PI / 2.05} minDistance={1.5} maxDistance={size * 4} />
          ) : (
            <WalkControls doc={plan.data} fallbackStart={[center[0], center[2]]} />
          )}
        </Canvas>
        {mode === "walk" && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-white">
            Klicken zum Umsehen · WASD/Pfeiltasten zum Gehen · Wände halten · ESC beendet
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="card space-y-3">
          <h2 className="font-display text-lg font-semibold">Ansicht</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={mode === "orbit" ? "btn-primary" : "btn-secondary"}
              onClick={() => setMode("orbit")}
            >
              Übersicht
            </button>
            <button
              className={mode === "walk" ? "btn-primary" : "btn-secondary"}
              onClick={() => setMode("walk")}
            >
              Rundgang
            </button>
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-terra"
              checked={furnished}
              onChange={(event) => setFurnished(event.target.checked)}
            />
            Eingerichtet anzeigen
          </label>
        </div>

        <div className="card space-y-3">
          <h2 className="font-display text-lg font-semibold">Design je Raum</h2>
          {plan.rooms.map((room) => {
            const rows = proposalsByRoom[room.key] ?? [];
            return (
              <div key={room.id}>
                <label className="label">{room.name}</label>
                <select
                  className="input"
                  value={selected[room.key] ?? ""}
                  onChange={(event) =>
                    setSelected((current) => ({ ...current, [room.key]: event.target.value }))
                  }
                >
                  <option value="">— leer —</option>
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.isFavorite ? "★ " : ""}
                      {row.title}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          <p className="text-xs leading-relaxed text-ink-soft">
            Die 3D-Möbel sind vereinfachte Modelle in Originalgröße und -farbe — ideal, um
            Proportionen und Stellflächen zu prüfen. Fotorealistische Renders kosten extra und sind
            deshalb deaktiviert.
          </p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Szene

function ApartmentMesh({
  doc,
  proposals,
  furnished,
}: {
  doc: FloorPlanDoc;
  proposals: Record<string, ProposalDoc | undefined>;
  furnished: boolean;
}) {
  const walls = useMemo(() => buildWalls(doc), [doc]);

  const floorGeometries = useMemo(() => {
    return doc.rooms.map((room) => {
      const shape = new THREE.Shape();
      room.polygon.forEach(([x, y], index) => {
        if (index === 0) shape.moveTo(x / 100, y / 100);
        else shape.lineTo(x / 100, y / 100);
      });
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(Math.PI / 2);
      return { roomId: room.id, geometry };
    });
  }, [doc]);

  const windowPanes = useMemo(() => {
    return doc.openings
      .filter((opening) => opening.kind === "window")
      .map((opening) => {
        const segment = openingWorldSegment(doc, opening);
        if (!segment) return null;
        const cx = (segment.a[0] + segment.b[0]) / 200;
        const cz = (segment.a[1] + segment.b[1]) / 200;
        const dx = segment.b[0] - segment.a[0];
        const dz = segment.b[1] - segment.a[1];
        const length = Math.hypot(dx, dz) / 100;
        const angle = -Math.atan2(dz, dx);
        const sill = (opening.sillCm ?? 90) / 100;
        const height = opening.heightCm / 100;
        return { id: opening.id, cx, cz, length, angle, y: sill + height / 2, height };
      })
      .filter((pane): pane is NonNullable<typeof pane> => pane !== null);
  }, [doc]);

  return (
    <group>
      {/* Böden */}
      {floorGeometries.map(({ roomId, geometry }) => {
        const proposal = furnished ? proposals[roomId] : undefined;
        const color = proposal?.floor.colorHex ?? "#D9CFB8";
        return (
          <mesh key={roomId} geometry={geometry} position={[0, 0.001, 0]}>
            <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.9} />
          </mesh>
        );
      })}

      {/* Wände (Öffnungen sind herausgeschnitten) */}
      {walls.map((wall) => {
        const proposal = furnished ? proposals[wall.roomId] : undefined;
        const color = proposal?.wallColorHex ?? "#F0EBDF";
        const dx = wall.b[0] - wall.a[0];
        const dy = wall.b[1] - wall.a[1];
        const angle = -Math.atan2(dy, dx);
        // Minimal unterschiedliche Wanddicke je Raum verhindert Z-Fighting
        // bei doppelt gezeichneten, geteilten Wänden.
        const thickness = 0.1 + (hashString(wall.roomId) % 5) * 0.006;
        return wall.pieces.map((piece, index) => {
          const length = (piece.end - piece.start) / 100;
          if (length <= 0.005) return null;
          const midT = (piece.start + piece.end) / 2 / 100;
          const ux = dx / Math.hypot(dx, dy) || 0;
          const uy = dy / Math.hypot(dx, dy) || 0;
          const cx = wall.a[0] / 100 + ux * midT;
          const cz = wall.a[1] / 100 + uy * midT;
          const height = (piece.z1 - piece.z0) / 100;
          return (
            <mesh
              key={`${wall.roomId}-${wall.edgeIndex}-${index}`}
              position={[cx, piece.z0 / 100 + height / 2, cz]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[length, height, thickness]} />
              <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>
          );
        });
      })}

      {/* Fensterglas */}
      {windowPanes.map((pane) => (
        <mesh key={pane.id} position={[pane.cx, pane.y, pane.cz]} rotation={[0, pane.angle, 0]}>
          <boxGeometry args={[pane.length, pane.height, 0.02]} />
          <meshStandardMaterial color="#AFC8D8" transparent opacity={0.35} roughness={0.1} />
        </mesh>
      ))}

      {/* Möbel */}
      {furnished &&
        doc.rooms.map((room) => {
          const proposal = proposals[room.id];
          if (!proposal) return null;
          return proposal.furniture.map((item) => <Furniture key={item.id} item={item} />);
        })}
    </group>
  );
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

// ------------------------------------------------------------- Ego-Modus

/** Augenhöhe im Rundgang (m). */
const EYE_HEIGHT_M = 1.55;
/** Gehgeschwindigkeit (m/s). */
const WALK_SPEED_MS = 2.2;

function WalkControls({
  doc,
  fallbackStart,
}: {
  doc: FloorPlanDoc;
  fallbackStart: [number, number];
}) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // In einem begehbaren Raum starten, nicht zwangsläufig in der Mitte der
    // Bounding-Box — die kann bei verwinkelten Wohnungen in einer Wand liegen.
    const start = walkStartPoint(doc);
    const point = start ?? [fallbackStart[0] * 100, fallbackStart[1] * 100];
    camera.position.set(point[0] / 100, EYE_HEIGHT_M, point[1] / 100);

    const down = (event: KeyboardEvent) => {
      keys.current[event.key.toLowerCase()] = true;
    };
    const up = (event: KeyboardEvent) => {
      keys.current[event.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [camera, doc, fallbackStart]);

  useFrame((_, delta) => {
    // Bildruckler begrenzen: Ohne Deckel entsteht nach einem Hänger ein
    // Riesenschritt, der die Wandprüfung unnötig auf die Probe stellt.
    const speed = WALK_SPEED_MS * Math.min(delta, 0.1);

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const move = new THREE.Vector3();
    const pressed = keys.current;
    if (pressed["w"] || pressed["arrowup"]) move.addScaledVector(forward, speed);
    if (pressed["s"] || pressed["arrowdown"]) move.addScaledVector(forward, -speed);
    if (pressed["a"] || pressed["arrowleft"]) move.addScaledVector(right, -speed);
    if (pressed["d"] || pressed["arrowright"]) move.addScaledVector(right, speed);

    camera.position.y = EYE_HEIGHT_M;
    if (move.lengthSq() === 0) return;

    // Szene rechnet in Metern, der Grundriss in Zentimetern
    const from: Vec2 = [camera.position.x * 100, camera.position.z * 100];
    const to: Vec2 = [(camera.position.x + move.x) * 100, (camera.position.z + move.z) * 100];
    const resolved = resolveMove(doc, from, to);
    camera.position.x = resolved[0] / 100;
    camera.position.z = resolved[1] / 100;
  });

  return <PointerLockControls />;
}
