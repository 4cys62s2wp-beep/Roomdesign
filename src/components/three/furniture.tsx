"use client";

// Prozedurale Low-Poly-Möbel für den 3D-Viewer. Jede Komponente baut ihr
// Möbelstück aus Primitiven auf; Maße und Farben kommen aus dem FurnitureItem.
// Lokales Koordinatensystem: x = Breite, z = Tiefe, "Front" zeigt nach +z.

import React from "react";
import type { FurnitureItem, FurnitureKind } from "@/lib/types";

interface Props {
  item: FurnitureItem;
}

function shade(hex: string, factor: number): string {
  const match = hex.replace("#", "");
  if (match.length !== 6) return hex;
  const num = parseInt(match, 16);
  const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((num & 0xff) * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function dims(item: FurnitureItem) {
  return { w: item.wCm / 100, d: item.dCm / 100, h: item.hCm / 100, color: item.colorHex };
}

/** Einfacher Quader mit Unterkante auf y=0-Versatz. */
function B({
  x = 0,
  y = 0,
  z = 0,
  w,
  h,
  d,
  color,
  transparent,
  opacity,
}: {
  x?: number;
  y?: number;
  z?: number;
  w: number;
  h: number;
  d: number;
  color: string;
  transparent?: boolean;
  opacity?: number;
}) {
  return (
    <mesh position={[x, y + h / 2, z]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} roughness={0.85} />
    </mesh>
  );
}

function Cyl({
  x = 0,
  y = 0,
  z = 0,
  r,
  h,
  color,
  rTop,
}: {
  x?: number;
  y?: number;
  z?: number;
  r: number;
  h: number;
  color: string;
  rTop?: number;
}) {
  return (
    <mesh position={[x, y + h / 2, z]}>
      <cylinderGeometry args={[rTop ?? r, r, h, 16]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Legs({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const ix = w / 2 - 0.05;
  const iz = d / 2 - 0.05;
  return (
    <>
      {[
        [ix, iz],
        [-ix, iz],
        [ix, -iz],
        [-ix, -iz],
      ].map(([x, z], index) => (
        <Cyl key={index} x={x} z={z} r={0.025} h={h} color={color} />
      ))}
    </>
  );
}

// --------------------------------------------------------------- Möbeltypen

function Bed({ item }: Props) {
  const { w, d, color } = dims(item);
  const frame = shade(color, 0.8);
  return (
    <group>
      <B w={w} h={0.25} d={d} color={frame} />
      <B y={0.25} w={w - 0.08} h={0.16} d={d - 0.25} z={0.08} color="#F4F1E8" />
      <B y={0.25} z={-d / 2 + 0.05} w={w} h={0.75} d={0.09} color={color} />
      {w >= 1.2 ? (
        <>
          <B x={-w / 4} y={0.41} z={-d / 2 + 0.32} w={w / 2 - 0.18} h={0.09} d={0.4} color="#FFFFFF" />
          <B x={w / 4} y={0.41} z={-d / 2 + 0.32} w={w / 2 - 0.18} h={0.09} d={0.4} color="#FFFFFF" />
        </>
      ) : (
        <B y={0.41} z={-d / 2 + 0.32} w={w - 0.3} h={0.09} d={0.4} color="#FFFFFF" />
      )}
      <B y={0.32} z={d / 4} w={w - 0.16} h={0.06} d={d / 2.2} color={shade(color, 1.15)} />
    </group>
  );
}

function Sofa({ item }: Props) {
  const { w, d, h, color } = dims(item);
  const dark = shade(color, 0.85);
  return (
    <group>
      <B w={w} h={0.22} d={d} color={dark} />
      <B y={0.22} w={w - 0.36} h={0.2} d={d - 0.14} z={0.05} color={color} />
      <B y={0.2} z={-d / 2 + 0.11} w={w} h={Math.max(0.5, h - 0.05)} d={0.22} color={color} />
      <B x={-w / 2 + 0.09} y={0.2} w={0.18} h={0.42} d={d} color={dark} />
      <B x={w / 2 - 0.09} y={0.2} w={0.18} h={0.42} d={d} color={dark} />
    </group>
  );
}

function Armchair({ item }: Props) {
  return <Sofa item={item} />;
}

function Table({ item }: Props) {
  const { w, d, h, color } = dims(item);
  const legColor = shade(color, 0.6);
  return (
    <group>
      <B y={h - 0.04} w={w} h={0.04} d={d} color={color} />
      <Legs w={w} d={d} h={h - 0.04} color={legColor} />
    </group>
  );
}

function Chair({ item }: Props) {
  const { w, d, color } = dims(item);
  const seatH = 0.46;
  return (
    <group>
      <B y={seatH - 0.04} w={w} h={0.04} d={d} color={color} />
      <Legs w={w} d={d} h={seatH - 0.04} color={shade(color, 0.7)} />
      <B y={seatH} z={-d / 2 + 0.025} w={w} h={0.42} d={0.05} color={color} />
    </group>
  );
}

function Wardrobe({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return (
    <group>
      <B w={w} h={h} d={d} color={color} />
      <B y={0} z={d / 2 + 0.001} w={0.015} h={h * 0.96} d={0.012} color={shade(color, 0.6)} />
      <B x={-0.05} y={h * 0.5} z={d / 2 + 0.008} w={0.025} h={0.18} d={0.02} color={shade(color, 0.5)} />
      <B x={0.05} y={h * 0.5} z={d / 2 + 0.008} w={0.025} h={0.18} d={0.02} color={shade(color, 0.5)} />
    </group>
  );
}

function Sideboard({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return (
    <group>
      <B y={0.1} w={w} h={h - 0.1} d={d} color={color} />
      <Legs w={w - 0.05} d={d - 0.05} h={0.1} color={shade(color, 0.5)} />
      <B y={h - 0.015} w={w + 0.02} h={0.015} d={d + 0.02} color={shade(color, 0.75)} />
    </group>
  );
}

function Shelf({ item }: Props) {
  const { w, d, h, color } = dims(item);
  const boards = Math.max(3, Math.round(h / 0.38));
  return (
    <group>
      <B x={-w / 2 + 0.012} w={0.025} h={h} d={d} color={color} />
      <B x={w / 2 - 0.012} w={0.025} h={h} d={d} color={color} />
      {Array.from({ length: boards + 1 }, (_, index) => (
        <B key={index} y={(h / boards) * index} w={w} h={0.025} d={d} color={color} />
      ))}
    </group>
  );
}

function TvBoard({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return (
    <group>
      <B y={0.08} w={w} h={h - 0.08} d={d} color={color} />
      <Legs w={w - 0.06} d={d - 0.04} h={0.08} color={shade(color, 0.5)} />
      {/* Fernseher */}
      <B y={h + 0.02} w={Math.min(1.1, w * 0.75)} h={Math.min(1.1, w * 0.75) * 0.58} d={0.035} color="#1c1c1e" />
    </group>
  );
}

function KitchenBlock({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return (
    <group>
      <B w={w} h={h - 0.04} d={d} color={color} />
      <B y={h - 0.04} w={w + 0.02} h={0.04} d={d + 0.02} color={shade(color, 0.55)} />
      <B y={h} z={-d / 2 + 0.015} w={w} h={0.5} d={0.03} color={shade(color, 1.18)} />
      {/* Spüle + Kochfeld angedeutet */}
      <B x={-w / 4} y={h} w={0.5} h={0.012} d={Math.min(0.44, d - 0.15)} color="#B9BDC1" />
      <B x={w / 4} y={h} w={0.55} h={0.012} d={Math.min(0.5, d - 0.12)} color="#232323" />
    </group>
  );
}

function Fridge({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return (
    <group>
      <B w={w} h={h} d={d} color={color} />
      <B x={w / 2 - 0.05} y={h * 0.55} z={d / 2 + 0.01} w={0.03} h={0.35} d={0.03} color={shade(color, 0.6)} />
      <B y={h * 0.66} z={d / 2 + 0.002} w={w} h={0.01} d={0.005} color={shade(color, 0.7)} />
    </group>
  );
}

function Bathtub({ item }: Props) {
  const { w, d, h } = dims(item);
  return (
    <group>
      <B w={w} h={h} d={d} color="#F7F6F2" />
      <B y={h - 0.03} w={w - 0.16} h={0.03} d={d - 0.16} color="#D7E4E8" />
      <Cyl x={-w / 2 + 0.12} y={h} r={0.02} h={0.15} color="#9aa0a6" />
    </group>
  );
}

function Shower({ item }: Props) {
  const { w, d, h } = dims(item);
  return (
    <group>
      <B w={w} h={0.06} d={d} color="#E8E6E0" />
      <B x={w / 2 - 0.01} y={0.06} w={0.02} h={h - 0.06} d={d} color="#BFD5DD" transparent opacity={0.35} />
      <B z={-d / 2 + 0.01} y={0.06} w={w} h={h - 0.06} d={0.02} color="#BFD5DD" transparent opacity={0.35} />
      <Cyl x={-w / 2 + 0.08} y={0.06} r={0.015} h={h - 0.2} color="#9aa0a6" />
    </group>
  );
}

function Toilet({ item }: Props) {
  const { w, d, color } = dims(item);
  return (
    <group>
      <B z={-d / 2 + 0.09} y={0.2} w={w} h={0.42} d={0.18} color={color} />
      <mesh position={[0, 0.35, d / 8]}>
        <cylinderGeometry args={[w / 2, w / 2.6, 0.12, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <Cyl z={d / 8} r={w / 2.4} h={0.35} color={shade(color, 0.96)} />
    </group>
  );
}

function Sink({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return (
    <group>
      <B y={0.1} w={w} h={h - 0.14} d={d} color={color} />
      <B y={h - 0.04} w={w + 0.03} h={0.05} d={d + 0.03} color="#F7F6F2" />
      <Cyl y={h} z={-d / 2 + 0.06} r={0.015} h={0.16} color="#9aa0a6" />
    </group>
  );
}

function WashingMachine({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return (
    <group>
      <B w={w} h={h} d={d} color={color} />
      <mesh position={[0, h * 0.5, d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[w * 0.28, w * 0.28, 0.015, 24]} />
        <meshStandardMaterial color="#3d4247" roughness={0.3} />
      </mesh>
      <B y={h - 0.09} z={d / 2 + 0.003} w={w} h={0.06} d={0.006} color={shade(color, 0.8)} />
    </group>
  );
}

function Rug({ item }: Props) {
  const { w, d, color } = dims(item);
  return <B y={0.002} w={w} h={0.015} d={d} color={color} />;
}

function FloorLamp({ item }: Props) {
  const { h, color } = dims(item);
  return (
    <group>
      <Cyl r={0.14} h={0.02} color={shade(color, 0.7)} />
      <Cyl r={0.015} h={h - 0.3} color={shade(color, 0.7)} />
      <mesh position={[0, h - 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.17, 0.28, 16, 1, true]} />
        <meshStandardMaterial color="#F1E9D8" side={2} />
      </mesh>
      <pointLight position={[0, h - 0.15, 0]} intensity={0.35} distance={4} color="#ffe9c9" />
    </group>
  );
}

function Plant({ item }: Props) {
  const { w, h } = dims(item);
  const potH = h * 0.25;
  return (
    <group>
      <Cyl r={w / 2.6} rTop={w / 2.2} h={potH} color="#A9836A" />
      <mesh position={[0, potH + (h - potH) * 0.45, 0]}>
        <sphereGeometry args={[w / 1.9, 10, 8]} />
        <meshStandardMaterial color="#5B7350" roughness={1} />
      </mesh>
      <mesh position={[w / 5, potH + (h - potH) * 0.75, w / 8]}>
        <sphereGeometry args={[w / 2.6, 10, 8]} />
        <meshStandardMaterial color="#6B855C" roughness={1} />
      </mesh>
    </group>
  );
}

function Mirror({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return (
    <group>
      <B w={w} h={h} d={Math.max(0.03, d / 4)} color={color} />
      <B y={h * 0.04} z={Math.max(0.03, d / 4) / 2 + 0.002} w={w * 0.88} h={h * 0.92} d={0.004} color="#CBD8DE" />
    </group>
  );
}

function GenericBox({ item }: Props) {
  const { w, d, h, color } = dims(item);
  return <B w={w} h={h} d={d} color={color} />;
}

const REGISTRY: Record<FurnitureKind, React.FC<Props>> = {
  bed: Bed,
  nightstand: Sideboard,
  sofa: Sofa,
  armchair: Armchair,
  coffee_table: Table,
  dining_table: Table,
  chair: Chair,
  wardrobe: Wardrobe,
  sideboard: Sideboard,
  shelf: Shelf,
  desk: Table,
  tv_board: TvBoard,
  kitchen_block: KitchenBlock,
  fridge: Fridge,
  bathtub: Bathtub,
  shower: Shower,
  toilet: Toilet,
  sink: Sink,
  washing_machine: WashingMachine,
  rug: Rug,
  floor_lamp: FloorLamp,
  plant: Plant,
  mirror: Mirror,
  other: GenericBox,
};

/** Platziert ein Möbelstück in Wohnungskoordinaten (cm → m, Plan-y → Szene-z). */
export function Furniture({ item }: Props) {
  const Component = REGISTRY[item.kind] ?? GenericBox;
  return (
    <group
      position={[item.x / 100, 0, item.y / 100]}
      rotation={[0, (-item.rotationDeg * Math.PI) / 180, 0]}
    >
      <Component item={item} />
    </group>
  );
}
