// Demo-Daten: eine realistische Beispielwohnung, die exakt der vom Nutzer
// beschriebenen Topologie entspricht (Gang → Bad am Ende; rechts vor dem Bad
// das Wohnzimmer; links davon die Küche; hinten rechts, parallel zum Gang,
// das Schlafzimmer). Außerdem vollständige Design-Vorschläge pro Raumtyp.
//
// Möbelpositionen in den Vorlagen sind als Brüche (0..1) der Raum-Bounding-Box
// hinterlegt, damit die Vorlagen auch für vom Nutzer veränderte Grundrisse
// funktionieren. Beim Instanziieren werden sie in Weltkoordinaten umgerechnet
// und in den Raum geklemmt.

import type {
  FloorPlanDoc,
  FurnitureItem,
  FurnitureKind,
  LightingSpec,
  MaterialSpec,
  PaletteColor,
  ProposalDoc,
  RoomShape,
  RoomType,
} from "@/lib/types";
import { polygonBounds, rect } from "@/lib/geometry/floorplan";
import { clampFurnitureIntoRoom } from "@/lib/geometry/furniture-fit";

// ---------------------------------------------------------------------------
// Demo-Grundriss
// ---------------------------------------------------------------------------

export function demoFloorPlan(): FloorPlanDoc {
  const rooms: RoomShape[] = [
    {
      id: "gang",
      name: "Gang",
      type: "hallway",
      polygon: rect(100, 380, 140, 520),
      ceilingHeightCm: 258,
      confidence: 0.78,
    },
    {
      id: "bad",
      name: "Badezimmer",
      type: "bathroom",
      polygon: rect(0, 160, 240, 220),
      ceilingHeightCm: 258,
      confidence: 0.71,
    },
    {
      id: "wohnzimmer",
      name: "Wohnzimmer",
      type: "living",
      polygon: rect(240, 380, 420, 380),
      ceilingHeightCm: 258,
      confidence: 0.74,
    },
    {
      id: "kueche",
      name: "Küche",
      type: "kitchen",
      polygon: rect(240, 0, 280, 380),
      ceilingHeightCm: 258,
      confidence: 0.7,
    },
    {
      id: "schlafzimmer",
      name: "Schlafzimmer",
      type: "bedroom",
      polygon: rect(340, 760, 320, 380),
      ceilingHeightCm: 258,
      confidence: 0.73,
    },
  ];

  return {
    unit: "cm",
    rooms,
    openings: [
      // Wohnungstür am Südende des Gangs
      { id: "tuer-eingang", kind: "door", wall: { roomId: "gang", edgeIndex: 2 }, roomB: null, offsetCm: 25, widthCm: 95, heightCm: 205 },
      // Gang → Bad (am Ende des Gangs)
      { id: "tuer-bad", kind: "door", wall: { roomId: "gang", edgeIndex: 0 }, roomB: "bad", offsetCm: 30, widthCm: 85, heightCm: 200 },
      // Gang → Wohnzimmer (rechts, kurz vor dem Bad)
      { id: "tuer-wohnzimmer", kind: "door", wall: { roomId: "gang", edgeIndex: 1 }, roomB: "wohnzimmer", offsetCm: 40, widthCm: 100, heightCm: 205 },
      // Wohnzimmer → Küche (offener Durchgang)
      { id: "durchgang-kueche", kind: "passage", wall: { roomId: "kueche", edgeIndex: 2 }, roomB: "wohnzimmer", offsetCm: 60, widthCm: 160, heightCm: 215 },
      // Wohnzimmer → Schlafzimmer
      { id: "tuer-schlafzimmer", kind: "door", wall: { roomId: "schlafzimmer", edgeIndex: 0 }, roomB: "wohnzimmer", offsetCm: 40, widthCm: 90, heightCm: 205 },
      // Fenster
      { id: "fenster-wz-1", kind: "window", wall: { roomId: "wohnzimmer", edgeIndex: 1 }, roomB: null, offsetCm: 60, widthCm: 120, heightCm: 135, sillCm: 85 },
      { id: "fenster-wz-2", kind: "window", wall: { roomId: "wohnzimmer", edgeIndex: 1 }, roomB: null, offsetCm: 220, widthCm: 120, heightCm: 135, sillCm: 85 },
      { id: "fenster-kueche", kind: "window", wall: { roomId: "kueche", edgeIndex: 0 }, roomB: null, offsetCm: 80, widthCm: 130, heightCm: 115, sillCm: 100 },
      { id: "fenster-schlafzimmer", kind: "window", wall: { roomId: "schlafzimmer", edgeIndex: 2 }, roomB: null, offsetCm: 90, widthCm: 140, heightCm: 135, sillCm: 85 },
      { id: "fenster-bad", kind: "window", wall: { roomId: "bad", edgeIndex: 0 }, roomB: null, offsetCm: 95, widthCm: 60, heightCm: 75, sillCm: 135 },
    ],
    meta: {
      source: "demo",
      confidence: 0.73,
      note: "Maße aus Videoanalyse geschätzt (Referenz: Türhöhe ≈ 200 cm). Bitte im Editor prüfen und anpassen.",
    },
  };
}

export const DEMO_ANALYSIS_SUMMARY = [
  "Ich habe in deinem Rundgang **5 Räume** erkannt: Du betrittst die Wohnung über einen länglichen **Gang** (ca. 1,4 × 5,2 m). Am Ende des Gangs liegt das **Badezimmer** (ca. 5,3 m²) mit kleinem Fenster.",
  "Rechts vor dem Bad führt eine Tür ins **Wohnzimmer** (ca. 16 m², zwei Fenster an der Ostseite). Links davon öffnet sich die **Küche** (ca. 10,6 m²) über einen breiten Durchgang. Hinten rechts, parallel zum Gang, liegt das **Schlafzimmer** (ca. 12,2 m²).",
  "Die Maße sind aus dem Video geschätzt (Maßstab über die Türhöhe von ~200 cm abgeleitet, Konfidenz ~73 %). Bitte prüfe die Werte im Grundriss-Editor und korrigiere sie, wo nötig — besonders die Raumtiefen sind aus Videos schwer exakt zu bestimmen.",
].join("\n\n");

// ---------------------------------------------------------------------------
// Design-Vorlagen
// ---------------------------------------------------------------------------

interface RelFurniture {
  kind: FurnitureKind;
  label: string;
  w: number;
  d: number;
  h: number;
  /** Position des Mittelpunkts als Bruch der Raum-Bounding-Box (0..1). */
  fx: number;
  fy: number;
  rot: number;
  color: string;
  price: number;
  material?: string;
  query?: string;
}

export interface StyleTemplate {
  styleId: string;
  title: string;
  styleTags: string[];
  wallColorHex: string;
  floor: { material: string; colorHex: string };
  palette: PaletteColor[];
  materials: MaterialSpec[];
  lighting: LightingSpec[];
  concept: string;
  tips: string[];
  furniture: RelFurniture[];
}

const LIVING_TEMPLATES: StyleTemplate[] = [
  {
    styleId: "japandi",
    title: "Japandi – Ruhe & Wärme",
    styleTags: ["Japandi", "Naturmaterialien", "Reduziert"],
    wallColorHex: "#F4EFE6",
    floor: { material: "Eiche geölt", colorHex: "#C8A97E" },
    palette: [
      { name: "Warmweiß", hex: "#F4EFE6", role: "wall" },
      { name: "Eiche", hex: "#C8A97E", role: "floor" },
      { name: "Anthrazit", hex: "#3A3733", role: "primary" },
      { name: "Greige", hex: "#B7A99A", role: "secondary" },
      { name: "Salbei", hex: "#9AA88F", role: "accent" },
      { name: "Leinen", hex: "#E6DCCB", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Silikatfarbe, matt", colorHex: "#F4EFE6", note: "Warmweiß mit leichtem Beigeanteil" },
      { surface: "Boden", material: "Eiche-Parkett, geölt", colorHex: "#C8A97E" },
      { surface: "Textilien", material: "Leinen & Wolle", colorHex: "#E6DCCB" },
      { surface: "Akzente", material: "Schwarz gebeiztes Holz, Keramik", colorHex: "#2E2A26" },
    ],
    lighting: [
      { name: "Papier-Pendelleuchte", kind: "ceiling", note: "Weiches, diffuses Licht über der Sitzgruppe", estPriceEur: 89 },
      { name: "Stehleuchte mit Leinenschirm", kind: "floor", note: "Leseecke am Fenster", estPriceEur: 129 },
      { name: "LED-Band hinter TV-Board", kind: "led_strip", note: "Indirektes Abendlicht, 2700 K", estPriceEur: 35 },
    ],
    concept:
      "Das Wohnzimmer wird zum ruhigen Mittelpunkt der Wohnung: wenige, dafür hochwertige Möbel aus hellem Holz, " +
      "kombiniert mit schwarzen Akzenten und viel Leinen. Das niedrige Sofa steht mit dem Rücken zur Südwand und " +
      "blickt Richtung Küche und Fensterfront — so bleibt der Raum offen und das Tageslicht kommt tief in den Raum.\n\n" +
      "Die Möblierung hält die Wege frei: Der Durchgang zur Küche bleibt komplett offen, die Tür zum Schlafzimmer " +
      "wird nicht verstellt. Dekoration sparsam einsetzen — eine große Pflanze, Keramik, ein Bild reichen.",
    tips: [
      "Vorhänge aus Leinen in Wandfarbe lassen die Fenster größer wirken.",
      "Maximal zwei Holztöne mischen: Eiche (Boden) und Schwarzbraun (Akzente).",
      "Ein großer Teppich (mind. 240 cm) verbindet Sofa und Sessel zu einer Zone.",
    ],
    furniture: [
      { kind: "sofa", label: "3-Sitzer-Sofa, Leinen beige", w: 200, d: 90, h: 78, fx: 0.738, fy: 0.855, rot: 180, color: "#D8CDBB", price: 899, material: "Leinen", query: "3-Sitzer Sofa Leinen beige 200 cm" },
      { kind: "coffee_table", label: "Couchtisch Massivholz, dunkel", w: 110, d: 60, h: 38, fx: 0.726, fy: 0.579, rot: 0, color: "#4A3F35", price: 199, material: "Esche gebeizt", query: "Couchtisch Massivholz dunkel 110 cm" },
      { kind: "rug", label: "Teppich Wolle, naturweiß", w: 240, d: 170, h: 1, fx: 0.726, fy: 0.618, rot: 0, color: "#E3DAC9", price: 249, material: "Wolle", query: "Wollteppich 240x170 naturweiß" },
      { kind: "tv_board", label: "TV-Board Eiche, 160 cm", w: 160, d: 40, h: 45, fx: 0.06, fy: 0.579, rot: 270, color: "#B08F63", price: 329, material: "Eiche", query: "TV Lowboard Eiche 160 cm" },
      { kind: "shelf", label: "Regal schwarz, offen", w: 80, d: 35, h: 190, fx: 0.857, fy: 0.053, rot: 0, color: "#2E2A26", price: 149, material: "Metall/Holz", query: "Standregal schwarz 80 cm" },
      { kind: "armchair", label: "Sessel Bouclé", w: 75, d: 80, h: 76, fx: 0.881, fy: 0.263, rot: 90, color: "#CFC4B2", price: 379, material: "Bouclé", query: "Sessel Bouclé creme" },
      { kind: "floor_lamp", label: "Stehleuchte Leinen", w: 40, d: 40, h: 150, fx: 0.881, fy: 0.118, rot: 0, color: "#2E2A26", price: 129, query: "Stehleuchte Leinenschirm schwarz" },
      { kind: "plant", label: "Große Zimmerpflanze", w: 45, d: 45, h: 160, fx: 0.048, fy: 0.947, rot: 0, color: "#5B7350", price: 45, query: "Zimmerpflanze groß Kentia" },
    ],
  },
  {
    styleId: "industrial",
    title: "Industrial – Loft-Charakter",
    styleTags: ["Industrial", "Leder", "Metall"],
    wallColorHex: "#DED9D2",
    floor: { material: "Beton-Optik / Vinyl", colorHex: "#9B9691" },
    palette: [
      { name: "Hellgrau", hex: "#DED9D2", role: "wall" },
      { name: "Beton", hex: "#9B9691", role: "floor" },
      { name: "Cognac", hex: "#A05C2F", role: "primary" },
      { name: "Tiefschwarz", hex: "#26241F", role: "secondary" },
      { name: "Messing", hex: "#B08D57", role: "accent" },
      { name: "Anthrazit", hex: "#4B4A48", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Kalkputz-Optik, hellgrau", colorHex: "#DED9D2", note: "Eine Wand optional in Beton-Spachtel" },
      { surface: "Boden", material: "Vinyl in Beton-Optik", colorHex: "#9B9691" },
      { surface: "Möbel", material: "Leder, pulverbeschichteter Stahl, Altholz" },
    ],
    lighting: [
      { name: "Fabriklampen-Pendel, 3er", kind: "ceiling", note: "Schwarzer Schirm, warmweiße Filament-LED", estPriceEur: 119 },
      { name: "Tripod-Stehleuchte", kind: "floor", note: "Neben dem Sessel", estPriceEur: 99 },
    ],
    concept:
      "Loft-Atmosphäre auf 16 m²: Ein Cognac-Ledersofa setzt den warmen Kontrapunkt zu Beton-Boden und " +
      "Stahlregal. Die Möbel stehen frei und luftig, die Materialien — Leder, Metall, Altholz — dürfen " +
      "Gebrauchsspuren zeigen und werden mit den Jahren schöner.\n\n" +
      "Damit der Raum nicht kühl wirkt: warmweißes Licht (2700 K), ein grober Wollteppich und eine große " +
      "Pflanze als lebendiger Farbtupfer.",
    tips: [
      "Filament-Leuchtmittel sichtbar einsetzen — sie sind Teil des Looks.",
      "Schwarze Bilderrahmen in unterschiedlichen Größen als Galeriewand.",
      "Vintage-Fundstücke (Flohmarkt) machen den Stil glaubwürdig.",
    ],
    furniture: [
      { kind: "sofa", label: "Ledersofa Cognac, 3-Sitzer", w: 210, d: 92, h: 80, fx: 0.738, fy: 0.855, rot: 180, color: "#A05C2F", price: 1290, material: "Leder", query: "Ledersofa Cognac 3-Sitzer Vintage" },
      { kind: "coffee_table", label: "Couchtisch Altholz/Stahl", w: 115, d: 65, h: 40, fx: 0.726, fy: 0.579, rot: 0, color: "#6B5138", price: 249, material: "Altholz/Stahl", query: "Couchtisch Industrial Altholz" },
      { kind: "rug", label: "Teppich anthrazit, grob gewebt", w: 240, d: 170, h: 1, fx: 0.726, fy: 0.618, rot: 0, color: "#4B4A48", price: 199, material: "Wolle", query: "Teppich anthrazit 240x170" },
      { kind: "tv_board", label: "TV-Board Metall/Holz", w: 150, d: 42, h: 50, fx: 0.06, fy: 0.579, rot: 270, color: "#3B372F", price: 279, material: "Stahl/Mango", query: "TV Board Industrial Metall" },
      { kind: "shelf", label: "Stahlregal hoch", w: 90, d: 38, h: 200, fx: 0.857, fy: 0.055, rot: 0, color: "#26241F", price: 219, material: "Stahl", query: "Industrieregal schwarz 90 cm" },
      { kind: "armchair", label: "Clubsessel Leder", w: 80, d: 85, h: 74, fx: 0.881, fy: 0.263, rot: 90, color: "#7A4A28", price: 449, material: "Leder", query: "Clubsessel Leder Vintage" },
      { kind: "floor_lamp", label: "Tripod-Stehleuchte", w: 45, d: 45, h: 155, fx: 0.881, fy: 0.118, rot: 0, color: "#26241F", price: 99, query: "Tripod Stehleuchte schwarz" },
      { kind: "plant", label: "Geigenfeige im Topf", w: 45, d: 45, h: 170, fx: 0.048, fy: 0.947, rot: 0, color: "#4F6B45", price: 55, query: "Geigenfeige groß" },
    ],
  },
];

const BEDROOM_TEMPLATES: StyleTemplate[] = [
  {
    styleId: "scandi",
    title: "Skandinavisch – Hell & Gemütlich",
    styleTags: ["Skandinavisch", "Hell", "Hygge"],
    wallColorHex: "#F7F4EE",
    floor: { material: "Esche hell", colorHex: "#D9C4A3" },
    palette: [
      { name: "Wollweiß", hex: "#F7F4EE", role: "wall" },
      { name: "Esche", hex: "#D9C4A3", role: "floor" },
      { name: "Rauchblau", hex: "#7C93A6", role: "primary" },
      { name: "Hellgrau", hex: "#D4D2CC", role: "secondary" },
      { name: "Senf", hex: "#C9A227", role: "accent" },
      { name: "Naturleinen", hex: "#EDEAE3", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Dispersionsfarbe matt", colorHex: "#F7F4EE" },
      { surface: "Boden", material: "Esche-Parkett oder helles Laminat", colorHex: "#D9C4A3" },
      { surface: "Bettwäsche", material: "Leinen, stonewashed", colorHex: "#EDEAE3" },
    ],
    lighting: [
      { name: "Pendelleuchte Opalglas", kind: "ceiling", estPriceEur: 79 },
      { name: "2× Nachttischleuchte", kind: "table", note: "Warmes Licht, dimmbar", estPriceEur: 78 },
    ],
    concept:
      "Das Schlafzimmer bleibt hell und ruhig: Bett aus hellem Holz mit Leinenbettwäsche, dazu Rauchblau als " +
      "einzige kräftigere Farbe. Der Kleiderschrank steht an der Wand zum Wohnzimmer und puffert so auch den Schall.\n\n" +
      "Vor dem Fenster bleibt bewusst Freiraum — Morgenlicht fällt direkt aufs Bett.",
    tips: [
      "Verdunkelungsvorhänge in Wandfarbe halten den Raum optisch ruhig.",
      "Bettwäsche in zwei Sets (Naturleinen + Rauchblau) zum Wechseln.",
      "Eine Bank oder ein Hocker am Fußende erleichtert den Alltag.",
    ],
    furniture: [
      { kind: "bed", label: "Bett 160×200, Esche", w: 160, d: 200, h: 95, fx: 0.616, fy: 0.5, rot: 0, color: "#D9C4A3", price: 649, material: "Esche", query: "Bett 160x200 Holz hell" },
      { kind: "nightstand", label: "Nachttisch links", w: 45, d: 40, h: 50, fx: 0.288, fy: 0.276, rot: 0, color: "#D9C4A3", price: 89, query: "Nachttisch Holz hell" },
      { kind: "nightstand", label: "Nachttisch rechts", w: 40, d: 40, h: 50, fx: 0.938, fy: 0.276, rot: 0, color: "#D9C4A3", price: 89, query: "Nachttisch Holz hell" },
      { kind: "wardrobe", label: "Kleiderschrank 180 cm, weiß", w: 180, d: 60, h: 220, fx: 0.703, fy: 0.092, rot: 0, color: "#F2F0EB", price: 599, query: "Kleiderschrank 180 cm weiß" },
      { kind: "sideboard", label: "Kommode 100 cm", w: 100, d: 45, h: 85, fx: 0.078, fy: 0.632, rot: 270, color: "#EDE9E1", price: 229, query: "Kommode weiß Holz 100 cm" },
      { kind: "rug", label: "Teppich Wolle, hellgrau", w: 200, d: 140, h: 1, fx: 0.616, fy: 0.711, rot: 0, color: "#D4D2CC", price: 179, query: "Teppich hellgrau 200x140" },
      { kind: "mirror", label: "Standspiegel", w: 50, d: 30, h: 170, fx: 0.069, fy: 0.316, rot: 270, color: "#C9BFAF", price: 119, query: "Standspiegel Holzrahmen" },
      { kind: "plant", label: "Pflanze am Fenster", w: 40, d: 40, h: 120, fx: 0.906, fy: 0.921, rot: 0, color: "#5B7350", price: 35, query: "Zimmerpflanze Schlafzimmer" },
    ],
  },
  {
    styleId: "modern_luxe",
    title: "Modern Luxe – Tiefe Töne",
    styleTags: ["Modern Luxe", "Elegant", "Samt"],
    wallColorHex: "#39453E",
    floor: { material: "Nussbaum", colorHex: "#6E4F35" },
    palette: [
      { name: "Tannengrün", hex: "#39453E", role: "wall" },
      { name: "Nussbaum", hex: "#6E4F35", role: "floor" },
      { name: "Creme", hex: "#EFE8DA", role: "primary" },
      { name: "Messing", hex: "#B08D57", role: "accent" },
      { name: "Terrakotta", hex: "#B26E4B", role: "secondary" },
      { name: "Samt Salbei", hex: "#7E8D7B", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Matte Farbe in Tannengrün", colorHex: "#39453E", note: "Alle Wände — Mut zahlt sich in kleinen Räumen aus" },
      { surface: "Boden", material: "Nussbaum oder dunkles Vinyl", colorHex: "#6E4F35" },
      { surface: "Kopfteil", material: "Samt, Salbeigrün", colorHex: "#7E8D7B" },
      { surface: "Griffe/Leuchten", material: "Messing gebürstet", colorHex: "#B08D57" },
    ],
    lighting: [
      { name: "Messing-Wandleuchten am Bett", kind: "wall", note: "Ersetzen Nachttischlampen, schwenkbar", estPriceEur: 158 },
      { name: "Pendelleuchte Rauchglas", kind: "ceiling", estPriceEur: 139 },
    ],
    concept:
      "Ein Schlafzimmer wie ein Boutique-Hotel: tiefgrüne Wände, ein Polsterbett mit Samtkopfteil und " +
      "Messing-Details. Die dunkle Wandfarbe lässt die Raumkanten optisch zurücktreten — der Raum wirkt " +
      "größer und deutlich ruhiger.\n\n" +
      "Textilien in Creme und Terrakotta halten die Balance, damit es edel bleibt statt düster.",
    tips: [
      "Dunkle Wände brauchen mehrere warme Lichtquellen — nie nur die Deckenleuchte.",
      "Messing konsequent durchziehen: Griffe, Leuchten, Bilderrahmen.",
      "Creme-Bettwäsche als hellen Gegenpol zum Grün wählen.",
    ],
    furniture: [
      { kind: "bed", label: "Polsterbett 160×200, Samt", w: 170, d: 210, h: 110, fx: 0.616, fy: 0.5, rot: 0, color: "#7E8D7B", price: 949, material: "Samt", query: "Polsterbett Samt grün 160x200" },
      { kind: "nightstand", label: "Nachttisch schwarz/Messing", w: 45, d: 40, h: 55, fx: 0.288, fy: 0.276, rot: 0, color: "#2B2B28", price: 129, query: "Nachttisch schwarz Messing" },
      { kind: "nightstand", label: "Nachttisch schwarz/Messing", w: 40, d: 40, h: 55, fx: 0.938, fy: 0.276, rot: 0, color: "#2B2B28", price: 129, query: "Nachttisch schwarz Messing" },
      { kind: "wardrobe", label: "Kleiderschrank 180 cm, dunkel", w: 180, d: 60, h: 225, fx: 0.703, fy: 0.092, rot: 0, color: "#33322E", price: 799, query: "Kleiderschrank dunkelgrau 180" },
      { kind: "sideboard", label: "Kommode Nussbaum", w: 100, d: 45, h: 80, fx: 0.078, fy: 0.632, rot: 270, color: "#6E4F35", price: 329, query: "Kommode Nussbaum" },
      { kind: "rug", label: "Teppich Creme, Hochflor", w: 200, d: 140, h: 1, fx: 0.616, fy: 0.711, rot: 0, color: "#EFE8DA", price: 219, query: "Hochflor Teppich creme 200x140" },
      { kind: "mirror", label: "Standspiegel Messingrahmen", w: 50, d: 30, h: 175, fx: 0.069, fy: 0.316, rot: 270, color: "#B08D57", price: 169, query: "Standspiegel Messing" },
      { kind: "plant", label: "Pflanze dunkelgrün", w: 40, d: 40, h: 130, fx: 0.906, fy: 0.921, rot: 0, color: "#3F5A3C", price: 39, query: "Zimmerpflanze groß" },
    ],
  },
];

const KITCHEN_TEMPLATES: StyleTemplate[] = [
  {
    styleId: "scandi",
    title: "Skandinavisch – Hell & Praktisch",
    styleTags: ["Skandinavisch", "Hell", "Funktional"],
    wallColorHex: "#F6F3EC",
    floor: { material: "Fliese hell / Vinyl", colorHex: "#D8D3C8" },
    palette: [
      { name: "Warmweiß", hex: "#F6F3EC", role: "wall" },
      { name: "Steingrau", hex: "#D8D3C8", role: "floor" },
      { name: "Fronten Weiß", hex: "#EDEBE6", role: "primary" },
      { name: "Eiche", hex: "#C8A97E", role: "secondary" },
      { name: "Schwarz", hex: "#2E2A26", role: "accent" },
      { name: "Baumwolle", hex: "#E9E4D8", role: "textile" },
    ],
    materials: [
      { surface: "Küchenfronten", material: "Matt lackiert, weiß", colorHex: "#EDEBE6" },
      { surface: "Arbeitsplatte", material: "Eiche massiv, geölt", colorHex: "#C8A97E" },
      { surface: "Rückwand", material: "Metrofliesen weiß, glänzend" },
    ],
    lighting: [
      { name: "LED-Unterbauleuchten", kind: "led_strip", note: "Arbeitsflächen, 4000 K", estPriceEur: 49 },
      { name: "Pendelleuchte über Esstisch", kind: "ceiling", note: "2700 K, dimmbar", estPriceEur: 89 },
    ],
    concept:
      "Die Küchenzeile läuft kompakt an der Westwand entlang, die Eichen-Arbeitsplatte bringt Wärme in den " +
      "hellen Raum. Am Fenster steht ein Esstisch für vier — kurze Wege zum offenen Durchgang ins Wohnzimmer.\n\n" +
      "Offene Eichenborde statt Hängeschränken an einer Wandhälfte halten den Raum luftig.",
    tips: [
      "Arbeitslicht (4000 K) und Esstischlicht (2700 K) strikt trennen.",
      "Geräte hinter Fronten verbergen — ruhiges Bild in kleiner Küche.",
      "Ein Kräuterregal am Fenster ist Deko und Vorrat zugleich.",
    ],
    furniture: [
      { kind: "kitchen_block", label: "Küchenzeile 280 cm", w: 280, d: 62, h: 90, fx: 0.111, fy: 0.5, rot: 270, color: "#EDEBE6", price: 2490, material: "Front matt weiß, AP Eiche", query: "Küchenzeile 280 cm weiß Eiche" },
      { kind: "fridge", label: "Kühl-Gefrier-Kombi", w: 60, d: 65, h: 186, fx: 0.875, fy: 0.092, rot: 0, color: "#DDDBD4", price: 549, query: "Kühl-Gefrier-Kombination 186 cm" },
      { kind: "dining_table", label: "Esstisch Eiche 140×80", w: 140, d: 80, h: 76, fx: 0.643, fy: 0.526, rot: 0, color: "#C8A97E", price: 399, material: "Eiche", query: "Esstisch Eiche 140x80" },
      { kind: "chair", label: "Stuhl Holz/Schwarz", w: 45, d: 50, h: 82, fx: 0.518, fy: 0.382, rot: 180, color: "#2E2A26", price: 89, query: "Esszimmerstuhl Holz schwarz" },
      { kind: "chair", label: "Stuhl Holz/Schwarz", w: 45, d: 50, h: 82, fx: 0.768, fy: 0.382, rot: 180, color: "#2E2A26", price: 89, query: "Esszimmerstuhl Holz schwarz" },
      { kind: "chair", label: "Stuhl Holz/Schwarz", w: 45, d: 50, h: 82, fx: 0.518, fy: 0.671, rot: 0, color: "#2E2A26", price: 89, query: "Esszimmerstuhl Holz schwarz" },
      { kind: "chair", label: "Stuhl Holz/Schwarz", w: 45, d: 50, h: 82, fx: 0.768, fy: 0.671, rot: 0, color: "#2E2A26", price: 89, query: "Esszimmerstuhl Holz schwarz" },
      { kind: "shelf", label: "Wandregal Eiche", w: 60, d: 25, h: 90, fx: 0.946, fy: 0.789, rot: 90, color: "#C8A97E", price: 79, query: "Wandregal Eiche 60 cm" },
      { kind: "plant", label: "Kräuter & Pflanze", w: 35, d: 35, h: 60, fx: 0.929, fy: 0.921, rot: 0, color: "#5B7350", price: 25, query: "Kräutertopf Set" },
    ],
  },
  {
    styleId: "urban_dark",
    title: "Urban Dark – Anthrazit & Holz",
    styleTags: ["Modern", "Anthrazit", "Kontrast"],
    wallColorHex: "#E9E5DF",
    floor: { material: "Fliese Betonoptik", colorHex: "#A8A49E" },
    palette: [
      { name: "Hellbeige", hex: "#E9E5DF", role: "wall" },
      { name: "Beton", hex: "#A8A49E", role: "floor" },
      { name: "Anthrazit", hex: "#3A3F42", role: "primary" },
      { name: "Nussbaum", hex: "#7A5A3C", role: "secondary" },
      { name: "Schwarz matt", hex: "#23241F", role: "accent" },
      { name: "Grau", hex: "#B9B6AF", role: "textile" },
    ],
    materials: [
      { surface: "Küchenfronten", material: "Anthrazit, supermatt", colorHex: "#3A3F42" },
      { surface: "Arbeitsplatte", material: "Nussbaum-Dekor", colorHex: "#7A5A3C" },
      { surface: "Armatur/Griffe", material: "Schwarz matt", colorHex: "#23241F" },
    ],
    lighting: [
      { name: "Schienensystem schwarz", kind: "ceiling", note: "3 Spots, schwenkbar", estPriceEur: 129 },
      { name: "LED-Unterbau", kind: "led_strip", estPriceEur: 49 },
    ],
    concept:
      "Anthrazitfarbene Fronten und eine Arbeitsplatte in Nussbaum machen aus der Küche ein modernes " +
      "Statement. Die dunkle Zeile steht vor heller Wand — so bleibt der Raum trotz kräftiger Farben freundlich.\n\n" +
      "Esstisch und Stühle nehmen das Holz wieder auf; schwarze Details (Armatur, Griffe, Leuchten) rahmen das Bild.",
    tips: [
      "Dunkle Fronten zeigen Fingerabdrücke — supermatte Oberflächen wählen.",
      "Helle Wand und helles Licht als Ausgleich zur dunklen Zeile.",
      "Schwarze Hängeleuchten über dem Tisch schaffen Zonen.",
    ],
    furniture: [
      { kind: "kitchen_block", label: "Küchenzeile 280 cm, anthrazit", w: 280, d: 62, h: 90, fx: 0.111, fy: 0.5, rot: 270, color: "#3A3F42", price: 2790, material: "Anthrazit supermatt", query: "Küchenzeile anthrazit 280 cm" },
      { kind: "fridge", label: "Kühlschrank Edelstahl dunkel", w: 60, d: 65, h: 186, fx: 0.875, fy: 0.092, rot: 0, color: "#5A5C5E", price: 649, query: "Kühlschrank dark inox" },
      { kind: "dining_table", label: "Esstisch Nussbaum 140×80", w: 140, d: 80, h: 76, fx: 0.643, fy: 0.526, rot: 0, color: "#7A5A3C", price: 449, query: "Esstisch Nussbaum 140" },
      { kind: "chair", label: "Stuhl schwarz", w: 45, d: 50, h: 82, fx: 0.518, fy: 0.382, rot: 180, color: "#23241F", price: 79, query: "Stuhl schwarz Metall" },
      { kind: "chair", label: "Stuhl schwarz", w: 45, d: 50, h: 82, fx: 0.768, fy: 0.382, rot: 180, color: "#23241F", price: 79, query: "Stuhl schwarz Metall" },
      { kind: "chair", label: "Stuhl schwarz", w: 45, d: 50, h: 82, fx: 0.518, fy: 0.671, rot: 0, color: "#23241F", price: 79, query: "Stuhl schwarz Metall" },
      { kind: "chair", label: "Stuhl schwarz", w: 45, d: 50, h: 82, fx: 0.768, fy: 0.671, rot: 0, color: "#23241F", price: 79, query: "Stuhl schwarz Metall" },
      { kind: "shelf", label: "Regal schwarz/Nussbaum", w: 60, d: 25, h: 90, fx: 0.946, fy: 0.789, rot: 90, color: "#23241F", price: 99, query: "Wandregal schwarz Nussbaum" },
      { kind: "plant", label: "Pflanze", w: 35, d: 35, h: 60, fx: 0.929, fy: 0.921, rot: 0, color: "#5B7350", price: 25, query: "Zimmerpflanze Küche" },
    ],
  },
];

const BATHROOM_TEMPLATES: StyleTemplate[] = [
  {
    styleId: "spa_minimal",
    title: "Spa Minimal – Stein & Holz",
    styleTags: ["Minimalistisch", "Spa", "Naturstein"],
    wallColorHex: "#EFEBE3",
    floor: { material: "Feinsteinzeug Steinoptik", colorHex: "#C9C2B4" },
    palette: [
      { name: "Kalkweiß", hex: "#EFEBE3", role: "wall" },
      { name: "Stein", hex: "#C9C2B4", role: "floor" },
      { name: "Teak", hex: "#9C6B3F", role: "accent" },
      { name: "Weiß", hex: "#F7F6F2", role: "primary" },
      { name: "Anthrazit", hex: "#43423E", role: "secondary" },
      { name: "Waffelpiqué", hex: "#E8E3D7", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Großformat-Fliesen Steinoptik", colorHex: "#C9C2B4", note: "Wenige Fugen = ruhiges Bild" },
      { surface: "Akzente", material: "Teak (Hocker, Ablage)", colorHex: "#9C6B3F" },
      { surface: "Armaturen", material: "Schwarz matt", colorHex: "#43423E" },
    ],
    lighting: [
      { name: "Spiegelleuchte", kind: "wall", note: "Neutralweiß fürs Schminken/Rasieren", estPriceEur: 69 },
      { name: "Deckenspots dimmbar", kind: "ceiling", note: "Abends warm dimmen — Spa-Effekt", estPriceEur: 89 },
    ],
    concept:
      "Das kleine Bad wird zur Wellness-Nische: große Fliesen in Steinoptik, schwarze Armaturen und warme " +
      "Teak-Akzente. Wenige sichtbare Objekte — alles andere verschwindet im Spiegelschrank.\n\n" +
      "Waffelpiqué-Handtücher in Naturtönen und eine Duftkerze machen den Spa-Look komplett.",
    tips: [
      "Duschablage in die Wand fräsen lassen statt Körbe zu hängen.",
      "Ein Teak-Hocker funktioniert als Ablage und Deko zugleich.",
      "Handtücher in nur einer Farbfamilie halten das Bild ruhig.",
    ],
    furniture: [
      { kind: "bathtub", label: "Badewanne 170 cm", w: 170, d: 75, h: 58, fx: 0.375, fy: 0.182, rot: 0, color: "#F7F6F2", price: 780, query: "Badewanne 170x75" },
      { kind: "toilet", label: "Wand-WC", w: 37, d: 55, h: 42, fx: 0.125, fy: 0.818, rot: 180, color: "#F7F6F2", price: 320, query: "Wand-WC spülrandlos" },
      { kind: "sink", label: "Waschtisch 60 cm, Teak-Unterschrank", w: 60, d: 45, h: 85, fx: 0.896, fy: 0.545, rot: 90, color: "#9C6B3F", price: 449, query: "Waschtisch Unterschrank Teak 60" },
      { kind: "mirror", label: "Spiegelschrank", w: 55, d: 12, h: 70, fx: 0.971, fy: 0.545, rot: 90, color: "#DDD8CC", price: 189, query: "Spiegelschrank 55 cm" },
      { kind: "washing_machine", label: "Waschmaschine", w: 60, d: 60, h: 85, fx: 0.854, fy: 0.159, rot: 0, color: "#F0EFEA", price: 499, query: "Waschmaschine Frontlader 60 cm" },
      { kind: "plant", label: "Farn (feuchtigkeitsliebend)", w: 30, d: 30, h: 45, fx: 0.5, fy: 0.85, rot: 0, color: "#4F6B45", price: 19, query: "Badezimmerpflanze Farn" },
    ],
  },
  {
    styleId: "boho_warm",
    title: "Boho Warm – Terrakotta",
    styleTags: ["Boho", "Terrakotta", "Warm"],
    wallColorHex: "#EDDFCE",
    floor: { material: "Terrazzo-Optik", colorHex: "#C7AC94" },
    palette: [
      { name: "Sand", hex: "#EDDFCE", role: "wall" },
      { name: "Terrazzo", hex: "#C7AC94", role: "floor" },
      { name: "Terrakotta", hex: "#B26E4B", role: "primary" },
      { name: "Rattan", hex: "#C29A6B", role: "secondary" },
      { name: "Messing", hex: "#B08D57", role: "accent" },
      { name: "Baumwolle", hex: "#EFE6D6", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Kalkfarbe Sand + Terrakotta-Akzentwand", colorHex: "#EDDFCE" },
      { surface: "Boden", material: "Terrazzo- oder Zementfliesen-Optik", colorHex: "#C7AC94" },
      { surface: "Accessoires", material: "Rattan, Messing, Keramik" },
    ],
    lighting: [
      { name: "Rattan-Pendelleuchte", kind: "ceiling", estPriceEur: 59 },
      { name: "Spiegelbeleuchtung Messing", kind: "wall", estPriceEur: 79 },
    ],
    concept:
      "Warme Erdtöne statt kühler Badkeramik: Sandfarbene Wände, eine Akzentfläche in Terrakotta und " +
      "Naturmaterialien wie Rattan und Messing. Muster kommen über Textilien und einen kleinen Badteppich.\n\n" +
      "Pflanzen lieben das feuchte Klima und gehören zum Look — mindestens zwei verschiedene Größen.",
    tips: [
      "Terrakotta nur als Akzent — sonst wirkt das kleine Bad schnell eng.",
      "Rattankorb als Wäschekorb und Stauraum kombinieren.",
      "Messing-Accessoires (Haken, Seifenspender) als roter Faden.",
    ],
    furniture: [
      { kind: "bathtub", label: "Badewanne 170 cm", w: 170, d: 75, h: 58, fx: 0.375, fy: 0.182, rot: 0, color: "#F5F2EA", price: 780, query: "Badewanne 170x75" },
      { kind: "toilet", label: "Wand-WC", w: 37, d: 55, h: 42, fx: 0.125, fy: 0.818, rot: 180, color: "#F5F2EA", price: 320, query: "Wand-WC weiß" },
      { kind: "sink", label: "Waschtisch Rattanfront", w: 60, d: 45, h: 85, fx: 0.896, fy: 0.545, rot: 90, color: "#C29A6B", price: 389, query: "Waschtisch Rattan 60 cm" },
      { kind: "mirror", label: "Rundspiegel Messing", w: 55, d: 8, h: 55, fx: 0.971, fy: 0.545, rot: 90, color: "#B08D57", price: 99, query: "Rundspiegel Messing 55" },
      { kind: "washing_machine", label: "Waschmaschine", w: 60, d: 60, h: 85, fx: 0.854, fy: 0.159, rot: 0, color: "#F0EFEA", price: 499, query: "Waschmaschine 60 cm" },
      { kind: "plant", label: "Hängepflanze + Farn", w: 30, d: 30, h: 45, fx: 0.5, fy: 0.85, rot: 0, color: "#4F6B45", price: 29, query: "Badpflanzen Set" },
    ],
  },
];

const HALLWAY_TEMPLATES: StyleTemplate[] = [
  {
    styleId: "hell_funktional",
    title: "Hell & Funktional",
    styleTags: ["Funktional", "Hell", "Stauraum"],
    wallColorHex: "#F5F2EA",
    floor: { material: "Wie angrenzende Räume", colorHex: "#C8A97E" },
    palette: [
      { name: "Warmweiß", hex: "#F5F2EA", role: "wall" },
      { name: "Eiche", hex: "#C8A97E", role: "floor" },
      { name: "Schwarz", hex: "#2E2A26", role: "accent" },
      { name: "Greige", hex: "#B7A99A", role: "secondary" },
      { name: "Weiß", hex: "#F7F6F2", role: "primary" },
      { name: "Jute", hex: "#C9B189", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Abwaschbare Farbe, warmweiß", colorHex: "#F5F2EA" },
      { surface: "Garderobe", material: "Weiß mit Eichendetails" },
    ],
    lighting: [
      { name: "Deckenspots (3×)", kind: "ceiling", note: "Gleichmäßiges Licht im schmalen Gang", estPriceEur: 99 },
      { name: "LED-Band über Garderobe", kind: "led_strip", note: "Mit Bewegungsmelder", estPriceEur: 39 },
    ],
    concept:
      "Der schmale Gang bleibt hell und frei: flache Garderobenmöbel an der Westwand (nur ~35 cm tief), " +
      "ein großer Spiegel verdoppelt optisch die Breite. Ein Läufer in Jute führt als Wegführung durch die Wohnung.\n\n" +
      "Alles hat seinen Platz: Schuhbank mit Klappe, Haken auf zwei Höhen, Schlüsselschale.",
    tips: [
      "Spiegel gegenüber der Wohnzimmertür bringt Tageslicht in den Gang.",
      "Nichts an die Ostwand stellen — Laufweg und Türschwenk brauchen Platz.",
      "Bewegungsmelder-Licht macht abends die Hände frei.",
    ],
    furniture: [
      { kind: "wardrobe", label: "Garderobenschrank flach", w: 100, d: 38, h: 190, fx: 0.143, fy: 0.462, rot: 270, color: "#F2F0EB", price: 349, query: "Garderobenschrank flach 38 cm" },
      { kind: "mirror", label: "Wandspiegel groß", w: 60, d: 6, h: 160, fx: 0.029, fy: 0.654, rot: 270, color: "#C9BFAF", price: 129, query: "Wandspiegel 160 cm" },
      { kind: "sideboard", label: "Schuhbank mit Polster", w: 90, d: 35, h: 48, fx: 0.143, fy: 0.827, rot: 270, color: "#D9CDB9", price: 159, query: "Schuhbank 90 cm" },
      { kind: "rug", label: "Läufer Jute 80×300", w: 80, d: 320, h: 1, fx: 0.5, fy: 0.5, rot: 0, color: "#C9B189", price: 89, query: "Jute Läufer 80x300" },
      { kind: "plant", label: "Pflanze (lichtarm geeignet)", w: 30, d: 30, h: 90, fx: 0.907, fy: 0.06, rot: 0, color: "#4F6B45", price: 29, query: "Zamioculcas" },
    ],
  },
  {
    styleId: "japandi",
    title: "Japandi – Reduzierter Empfang",
    styleTags: ["Japandi", "Reduziert", "Holz"],
    wallColorHex: "#F4EFE6",
    floor: { material: "Eiche geölt", colorHex: "#C8A97E" },
    palette: [
      { name: "Warmweiß", hex: "#F4EFE6", role: "wall" },
      { name: "Eiche", hex: "#C8A97E", role: "floor" },
      { name: "Schwarzbraun", hex: "#2E2A26", role: "accent" },
      { name: "Greige", hex: "#B7A99A", role: "secondary" },
      { name: "Naturholz", hex: "#CBB58F", role: "primary" },
      { name: "Leinen", hex: "#E6DCCB", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Silikatfarbe warmweiß", colorHex: "#F4EFE6" },
      { surface: "Garderobe", material: "Hakenleiste Eiche massiv + Wandboard" },
    ],
    lighting: [
      { name: "Papier-Deckenleuchte", kind: "ceiling", estPriceEur: 69 },
      { name: "LED-Band unter Sitzbank", kind: "led_strip", note: "Schwebender Effekt", estPriceEur: 35 },
    ],
    concept:
      "Der Empfang folgt dem Wohnzimmer-Stil: eine massive Eichen-Hakenleiste statt sperriger Schränke, " +
      "darunter eine schwebende Sitzbank. Weniger Möbel, mehr Luft — der Gang wirkt sofort breiter.\n\n" +
      "Ein einzelnes großes Bild und eine Pflanze setzen die Akzente.",
    tips: [
      "Jacken, die nicht in Gebrauch sind, in den Schlafzimmerschrank räumen.",
      "Ein flacher Schuhschrank (18 cm) passt notfalls hinter die Tür.",
      "Bild mittig auf Augenhöhe gegenüber der Wohnzimmertür platzieren.",
    ],
    furniture: [
      { kind: "shelf", label: "Hakenleiste + Wandboard Eiche", w: 90, d: 20, h: 170, fx: 0.12, fy: 0.4, rot: 270, color: "#CBB58F", price: 139, query: "Garderobenleiste Eiche" },
      { kind: "sideboard", label: "Sitzbank Eiche schwebend", w: 90, d: 35, h: 45, fx: 0.143, fy: 0.75, rot: 270, color: "#C8A97E", price: 199, query: "Wandbank Eiche 90" },
      { kind: "mirror", label: "Spiegel rund, 80 cm", w: 80, d: 5, h: 80, fx: 0.03, fy: 0.55, rot: 270, color: "#2E2A26", price: 119, query: "Rundspiegel schwarz 80" },
      { kind: "rug", label: "Läufer Baumwolle", w: 70, d: 300, h: 1, fx: 0.5, fy: 0.5, rot: 0, color: "#E6DCCB", price: 69, query: "Läufer beige 70x300" },
      { kind: "plant", label: "Pflanze schmal", w: 30, d: 30, h: 100, fx: 0.907, fy: 0.06, rot: 0, color: "#4F6B45", price: 29, query: "Bogenhanf hoch" },
    ],
  },
];

const OFFICE_TEMPLATES: StyleTemplate[] = [
  {
    styleId: "focus",
    title: "Fokus – Ruhiges Arbeiten",
    styleTags: ["Home-Office", "Funktional", "Ruhig"],
    wallColorHex: "#F1EEE6",
    floor: { material: "Eiche / Teppichboden", colorHex: "#C8A97E" },
    palette: [
      { name: "Warmweiß", hex: "#F1EEE6", role: "wall" },
      { name: "Eiche", hex: "#C8A97E", role: "floor" },
      { name: "Salbei", hex: "#9AA88F", role: "accent" },
      { name: "Schwarz", hex: "#2E2A26", role: "secondary" },
      { name: "Weiß", hex: "#F7F6F2", role: "primary" },
      { name: "Filz", hex: "#B9B6AF", role: "textile" },
    ],
    materials: [
      { surface: "Wände", material: "Matte Farbe + Akustikpaneel Eiche hinter dem Schreibtisch" },
      { surface: "Schreibtisch", material: "Eiche, höhenverstellbar" },
    ],
    lighting: [
      { name: "Schreibtischleuchte", kind: "table", note: "4000 K, blendfrei", estPriceEur: 79 },
      { name: "Deckenleuchte indirekt", kind: "ceiling", estPriceEur: 99 },
    ],
    concept:
      "Ein aufgeräumter Arbeitsplatz mit Blick zur Tür: höhenverstellbarer Schreibtisch, ergonomischer Stuhl " +
      "und ein Akustikpaneel aus Eiche, das gleichzeitig Video-Call-Hintergrund ist.\n\n" +
      "Offenes Regal für Ordner und Bücher; Kabel verschwinden in einer Kabelwanne.",
    tips: [
      "Schreibtisch seitlich zum Fenster — kein Gegenlicht in Video-Calls.",
      "Eine Pflanze im Blickfeld senkt nachweislich Stress.",
      "Kabelwanne unter der Tischplatte montieren, bevor der Tisch an die Wand rückt.",
    ],
    furniture: [
      { kind: "desk", label: "Schreibtisch 140×70, höhenverstellbar", w: 140, d: 70, h: 75, fx: 0.5, fy: 0.15, rot: 0, color: "#C8A97E", price: 549, query: "Schreibtisch höhenverstellbar Eiche 140" },
      { kind: "chair", label: "Bürostuhl ergonomisch", w: 60, d: 60, h: 110, fx: 0.5, fy: 0.38, rot: 180, color: "#2E2A26", price: 299, query: "Bürostuhl ergonomisch" },
      { kind: "shelf", label: "Regal 80 cm", w: 80, d: 35, h: 190, fx: 0.9, fy: 0.5, rot: 90, color: "#F2F0EB", price: 149, query: "Bücherregal weiß 80" },
      { kind: "rug", label: "Teppich Filz", w: 160, d: 120, h: 1, fx: 0.5, fy: 0.45, rot: 0, color: "#B9B6AF", price: 119, query: "Teppich Filz grau" },
      { kind: "plant", label: "Pflanze", w: 40, d: 40, h: 120, fx: 0.1, fy: 0.85, rot: 0, color: "#5B7350", price: 35, query: "Zimmerpflanze Büro" },
      { kind: "floor_lamp", label: "Stehleuchte", w: 40, d: 40, h: 150, fx: 0.9, fy: 0.85, rot: 0, color: "#2E2A26", price: 99, query: "Stehleuchte Büro" },
    ],
  },
];

const GENERIC_TEMPLATES: StyleTemplate[] = [
  {
    styleId: "flexibel",
    title: "Flexibel & Hell",
    styleTags: ["Flexibel", "Hell"],
    wallColorHex: "#F4F1EA",
    floor: { material: "Eiche hell", colorHex: "#CDB68E" },
    palette: [
      { name: "Warmweiß", hex: "#F4F1EA", role: "wall" },
      { name: "Eiche", hex: "#CDB68E", role: "floor" },
      { name: "Salbei", hex: "#9AA88F", role: "accent" },
      { name: "Greige", hex: "#B7A99A", role: "secondary" },
      { name: "Weiß", hex: "#F7F6F2", role: "primary" },
      { name: "Baumwolle", hex: "#E9E4D8", role: "textile" },
    ],
    materials: [{ surface: "Wände", material: "Helle, matte Wandfarbe", colorHex: "#F4F1EA" }],
    lighting: [{ name: "Deckenleuchte", kind: "ceiling", estPriceEur: 79 }],
    concept:
      "Eine helle, neutrale Basis, die sich flexibel nutzen lässt: Regal, kleiner Tisch und eine Pflanze — " +
      "der Raum bleibt anpassbar, bis seine endgültige Nutzung feststeht.",
    tips: ["Neutrale Basis wählen, Akzente über Textilien setzen — so bleibt der Raum wandelbar."],
    furniture: [
      { kind: "shelf", label: "Regal 80 cm", w: 80, d: 35, h: 190, fx: 0.15, fy: 0.1, rot: 0, color: "#F2F0EB", price: 149, query: "Regal weiß 80 cm" },
      { kind: "dining_table", label: "Tisch 120×70", w: 120, d: 70, h: 75, fx: 0.55, fy: 0.5, rot: 0, color: "#CDB68E", price: 229, query: "Tisch Holz 120x70" },
      { kind: "chair", label: "Stuhl", w: 45, d: 50, h: 82, fx: 0.55, fy: 0.3, rot: 180, color: "#2E2A26", price: 79, query: "Stuhl Holz" },
      { kind: "rug", label: "Teppich", w: 180, d: 130, h: 1, fx: 0.55, fy: 0.55, rot: 0, color: "#E3DAC9", price: 149, query: "Teppich beige 180x130" },
      { kind: "plant", label: "Pflanze", w: 40, d: 40, h: 130, fx: 0.9, fy: 0.85, rot: 0, color: "#5B7350", price: 35, query: "Zimmerpflanze groß" },
    ],
  },
];

const TEMPLATES_BY_TYPE: Partial<Record<RoomType, StyleTemplate[]>> = {
  living: LIVING_TEMPLATES,
  bedroom: BEDROOM_TEMPLATES,
  kitchen: KITCHEN_TEMPLATES,
  bathroom: BATHROOM_TEMPLATES,
  wc: BATHROOM_TEMPLATES,
  hallway: HALLWAY_TEMPLATES,
  office: OFFICE_TEMPLATES,
  kids: BEDROOM_TEMPLATES,
  dining: KITCHEN_TEMPLATES,
};

export function templatesForRoomType(type: RoomType): StyleTemplate[] {
  return TEMPLATES_BY_TYPE[type] ?? GENERIC_TEMPLATES;
}

// ---------------------------------------------------------------------------
// Instanziierung
// ---------------------------------------------------------------------------

export function instantiateTemplate(
  template: StyleTemplate,
  room: RoomShape,
  options?: { feedback?: string; stylePrompt?: string },
): ProposalDoc {
  const bounds = polygonBounds([room.polygon]);
  const furniture: FurnitureItem[] = template.furniture.map((rel, index) => {
    const item: FurnitureItem = {
      id: `${room.id}-${template.styleId}-${index}-${rel.kind}`,
      kind: rel.kind,
      label: rel.label,
      wCm: rel.w,
      dCm: rel.d,
      hCm: rel.h,
      x: bounds.minX + rel.fx * bounds.width,
      y: bounds.minY + rel.fy * bounds.height,
      rotationDeg: rel.rot,
      colorHex: rel.color,
      materialHint: rel.material,
      estPriceEur: rel.price,
      searchQuery: rel.query,
    };
    return clampFurnitureIntoRoom(item, room);
  });

  const furnitureTotal = furniture.reduce((sum, f) => sum + f.estPriceEur, 0);
  const lightingTotal = template.lighting.reduce((sum, l) => sum + (l.estPriceEur ?? 0), 0);

  let concept = template.concept;
  let title = template.title;
  if (options?.stylePrompt) {
    concept += `\n\n**Dein Wunsch:** „${options.stylePrompt}" — die Materialauswahl und Farbakzente sind darauf abgestimmt.`;
  }
  if (options?.feedback) {
    title += " (überarbeitet)";
    concept += `\n\n**Überarbeitung:** Dein Feedback „${options.feedback}" ist eingeflossen — Materialien und Auswahl wurden entsprechend angepasst.`;
  }

  return {
    title,
    concept,
    style: template.styleTags,
    palette: template.palette,
    wallColorHex: template.wallColorHex,
    floor: template.floor,
    materials: template.materials,
    furniture,
    lighting: template.lighting,
    tips: template.tips,
    budget: {
      totalEur: furnitureTotal + lightingTotal,
      note: "Geschätzte Richtpreise (Mittelklasse). Leuchten enthalten.",
    },
  };
}

export function demoProposalsForRoom(
  room: RoomShape,
  count: number,
  options?: { stylePrompt?: string; feedback?: string; presets?: string[] },
): ProposalDoc[] {
  const templates = templatesForRoomType(room.type);
  // Wenn ein Preset gewählt wurde, passende Vorlage nach vorn sortieren
  const sorted = [...templates].sort((a, b) => {
    const aMatch = options?.presets?.some((p) => a.styleId.includes(p) || p.includes(a.styleId)) ? -1 : 0;
    const bMatch = options?.presets?.some((p) => b.styleId.includes(p) || p.includes(b.styleId)) ? -1 : 0;
    return aMatch - bMatch;
  });
  const result: ProposalDoc[] = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    const template = sorted[i % sorted.length];
    const doc = instantiateTemplate(template, room, options);
    if (i >= sorted.length) {
      doc.title += ` – Variante ${Math.floor(i / sorted.length) + 1}`;
    }
    result.push(doc);
  }
  return result;
}
