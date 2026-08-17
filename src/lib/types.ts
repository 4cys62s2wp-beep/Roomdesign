// Zentrale Domänen-Typen. Alle Koordinaten und Maße in Zentimetern (cm),
// Koordinatensystem wie SVG: x nach rechts, y nach unten. Im 3D-Viewer wird
// y auf die Z-Achse abgebildet.

export type Vec2 = [number, number];

export type RoomType =
  | "hallway"
  | "living"
  | "kitchen"
  | "bedroom"
  | "bathroom"
  | "wc"
  | "office"
  | "kids"
  | "dining"
  | "storage"
  | "balcony"
  | "other";

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  hallway: "Flur / Gang",
  living: "Wohnzimmer",
  kitchen: "Küche",
  bedroom: "Schlafzimmer",
  bathroom: "Badezimmer",
  wc: "Gäste-WC",
  office: "Arbeitszimmer",
  kids: "Kinderzimmer",
  dining: "Esszimmer",
  storage: "Abstellraum",
  balcony: "Balkon / Terrasse",
  other: "Sonstiger Raum",
};

export interface RoomShape {
  id: string;
  name: string;
  type: RoomType;
  /** Eckpunkte des Raums, im Uhrzeigersinn. Kante i verläuft von Punkt i zu Punkt i+1. */
  polygon: Vec2[];
  ceilingHeightCm: number;
  /** 0..1 – wie sicher die (KI-)Maßschätzung ist. 1 = vom Nutzer bestätigt. */
  confidence: number;
}

export type OpeningKind = "door" | "window" | "passage";

export interface Opening {
  id: string;
  kind: OpeningKind;
  /** Wandkante, an der die Öffnung sitzt. */
  wall: { roomId: string; edgeIndex: number };
  /** ID des verbundenen Raums; null/undefined = Außenwand. */
  roomB?: string | null;
  /** Abstand vom Kantenanfang bis zum Beginn der Öffnung (cm, entlang der Kante). */
  offsetCm: number;
  widthCm: number;
  heightCm: number;
  /** Brüstungshöhe bei Fenstern (cm über Boden). */
  sillCm?: number;
}

export interface FloorPlanDoc {
  unit: "cm";
  rooms: RoomShape[];
  openings: Opening[];
  meta: {
    source: "ai" | "manual" | "demo";
    confidence: number;
    note?: string;
  };
}

// ---------------------------------------------------------------------------
// Design-Vorschläge
// ---------------------------------------------------------------------------

export type FurnitureKind =
  | "bed"
  | "nightstand"
  | "sofa"
  | "armchair"
  | "coffee_table"
  | "dining_table"
  | "chair"
  | "wardrobe"
  | "sideboard"
  | "shelf"
  | "desk"
  | "tv_board"
  | "kitchen_block"
  | "fridge"
  | "bathtub"
  | "shower"
  | "toilet"
  | "sink"
  | "washing_machine"
  | "rug"
  | "floor_lamp"
  | "plant"
  | "mirror"
  | "other";

export const FURNITURE_KIND_LABELS: Record<FurnitureKind, string> = {
  bed: "Bett",
  nightstand: "Nachttisch",
  sofa: "Sofa",
  armchair: "Sessel",
  coffee_table: "Couchtisch",
  dining_table: "Esstisch",
  chair: "Stuhl",
  wardrobe: "Kleiderschrank",
  sideboard: "Sideboard / Kommode",
  shelf: "Regal",
  desk: "Schreibtisch",
  tv_board: "TV-Board",
  kitchen_block: "Küchenzeile",
  fridge: "Kühlschrank",
  bathtub: "Badewanne",
  shower: "Dusche",
  toilet: "WC",
  sink: "Waschbecken",
  washing_machine: "Waschmaschine",
  rug: "Teppich",
  floor_lamp: "Stehleuchte",
  plant: "Pflanze",
  mirror: "Spiegel",
  other: "Möbelstück",
};

export interface FurnitureItem {
  id: string;
  kind: FurnitureKind;
  label: string;
  /** Grundfläche: Breite (entlang der eigenen X-Achse) und Tiefe. */
  wCm: number;
  dCm: number;
  hCm: number;
  /** Mittelpunkt der Grundfläche in Wohnungskoordinaten (cm). */
  x: number;
  y: number;
  /** Drehung im Uhrzeigersinn in Grad (0 = Breite entlang der X-Achse). */
  rotationDeg: number;
  colorHex: string;
  materialHint?: string;
  estPriceEur: number;
  /** Suchbegriff für die Möbelsuche, z. B. "Sideboard Eiche 160 cm". */
  searchQuery?: string;
}

export interface PaletteColor {
  name: string;
  hex: string;
  role: "wall" | "floor" | "primary" | "secondary" | "accent" | "textile";
}

export interface MaterialSpec {
  surface: string;
  material: string;
  colorHex?: string;
  note?: string;
}

export interface LightingSpec {
  name: string;
  kind: "ceiling" | "floor" | "wall" | "table" | "led_strip";
  note?: string;
  x?: number;
  y?: number;
  estPriceEur?: number;
}

export interface ProposalDoc {
  title: string;
  /** Designkonzept als Markdown, deutsch. */
  concept: string;
  style: string[];
  palette: PaletteColor[];
  wallColorHex: string;
  floor: { material: string; colorHex: string };
  materials: MaterialSpec[];
  furniture: FurnitureItem[];
  lighting: LightingSpec[];
  tips: string[];
  budget: { totalEur: number; note?: string };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type JobType = "analysis" | "design";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface AnalysisJobPayload {
  videoId?: string;
  userHints?: string;
}

export interface AnalysisJobResult {
  floorPlanId: string;
  summary: string;
}

export interface DesignJobPayload {
  roomDbId: string;
  stylePrompt: string;
  presets: string[];
  budgetEur: number | null;
  count: number;
  refineOfProposalId?: string;
  feedback?: string;
}

export interface DesignJobResult {
  proposalIds: string[];
}

export interface RoomTag {
  timestampMs: number;
  label: string;
}

// ---------------------------------------------------------------------------
// Stil-Presets
// ---------------------------------------------------------------------------

export interface StylePreset {
  id: string;
  label: string;
  description: string;
  keywords: string[];
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "japandi",
    label: "Japandi",
    description: "Japanische Ruhe trifft skandinavische Wärme: helle Hölzer, Erdtöne, wenig, aber hochwertig.",
    keywords: ["hell", "holz", "reduziert", "naturmaterialien"],
  },
  {
    id: "scandi",
    label: "Skandinavisch",
    description: "Hell, freundlich, gemütlich: weiße Wände, Holz, Textilien, viel Licht.",
    keywords: ["hell", "gemütlich", "holz", "hygge"],
  },
  {
    id: "minimal",
    label: "Minimalistisch",
    description: "Klare Linien, wenige Möbel, monochrome Palette, viel Freiraum.",
    keywords: ["reduziert", "monochrom", "klar"],
  },
  {
    id: "industrial",
    label: "Industrial",
    description: "Rohe Materialien: Metall, Beton, dunkles Holz, Leder, markante Leuchten.",
    keywords: ["metall", "beton", "loft", "dunkel"],
  },
  {
    id: "boho",
    label: "Boho",
    description: "Verspielt und warm: Rattan, Makramee, Pflanzen, Muster und Texturen.",
    keywords: ["rattan", "pflanzen", "muster", "warm"],
  },
  {
    id: "midcentury",
    label: "Mid-Century",
    description: "50er/60er-Klassiker: organische Formen, Teakholz, Senfgelb und Petrol.",
    keywords: ["retro", "teak", "organisch"],
  },
  {
    id: "landhaus",
    label: "Landhaus",
    description: "Gemütlich-rustikal: helle Naturtöne, Vintage-Akzente, weiche Stoffe.",
    keywords: ["rustikal", "gemütlich", "vintage"],
  },
  {
    id: "modern_luxe",
    label: "Modern Luxe",
    description: "Elegant und hochwertig: Samt, Messing, Marmor, tiefe Farbtöne.",
    keywords: ["elegant", "messing", "marmor", "samt"],
  },
];
