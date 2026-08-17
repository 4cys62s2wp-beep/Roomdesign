// Zod-Schemas für die strukturierte Claude-Ausgabe.
// Hinweis: Numerische Constraints (min/max) werden von der Structured-Outputs-API
// nicht unterstützt – Plausibilisierung passiert nachgelagert in Code.

import { z } from "zod";

export const roomTypeSchema = z.enum([
  "hallway",
  "living",
  "kitchen",
  "bedroom",
  "bathroom",
  "wc",
  "office",
  "kids",
  "dining",
  "storage",
  "balcony",
  "other",
]);

export const analysisSchema = z.object({
  rooms: z.array(
    z.object({
      key: z.string().describe("Kurzer, eindeutiger Bezeichner, z. B. 'gang' oder 'wohnzimmer'"),
      name: z.string().describe("Deutscher Anzeigename des Raums"),
      type: roomTypeSchema,
      widthCm: z.number().describe("Geschätzte Breite in cm"),
      depthCm: z.number().describe("Geschätzte Tiefe in cm"),
      ceilingHeightCm: z.number().describe("Geschätzte Deckenhöhe in cm, Standard 250"),
      confidence: z.number().describe("Konfidenz der Maßschätzung, 0 bis 1"),
      windowCount: z.number().describe("Anzahl sichtbarer Fenster"),
      connections: z.array(
        z.object({
          roomKey: z.string().describe("key des verbundenen Raums"),
          kind: z.enum(["door", "passage"]),
        }),
      ),
    }),
  ),
  scaleReference: z
    .string()
    .describe("Welche Referenz für den Maßstab genutzt wurde, z. B. 'Türhöhe ca. 200 cm'"),
  summary: z
    .string()
    .describe(
      "Zusammenfassung der Analyse auf Deutsch, Markdown, 2-3 Absätze: erkannte Räume, Topologie, Hinweise zur Verlässlichkeit der Maße",
    ),
});

export type AnalysisOutput = z.infer<typeof analysisSchema>;

export const furnitureKindSchema = z.enum([
  "bed",
  "nightstand",
  "sofa",
  "armchair",
  "coffee_table",
  "dining_table",
  "chair",
  "wardrobe",
  "sideboard",
  "shelf",
  "desk",
  "tv_board",
  "kitchen_block",
  "fridge",
  "bathtub",
  "shower",
  "toilet",
  "sink",
  "washing_machine",
  "rug",
  "floor_lamp",
  "plant",
  "mirror",
  "other",
]);

export const proposalSchema = z.object({
  title: z.string().describe("Prägnanter deutscher Titel des Vorschlags"),
  concept: z.string().describe("Designkonzept auf Deutsch, Markdown, 2-3 Absätze"),
  style: z.array(z.string()).describe("Stil-Schlagworte, deutsch"),
  wallColorHex: z.string().describe("Wandfarbe als Hex, z. B. #F4EFE6"),
  floorMaterial: z.string().describe("Bodenbelag, z. B. 'Eiche geölt'"),
  floorColorHex: z.string(),
  palette: z.array(
    z.object({
      name: z.string(),
      hex: z.string(),
      role: z.enum(["wall", "floor", "primary", "secondary", "accent", "textile"]),
    }),
  ),
  materials: z.array(
    z.object({
      surface: z.string(),
      material: z.string(),
      colorHex: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
  furniture: z.array(
    z.object({
      kind: furnitureKindSchema,
      label: z.string().describe("Deutscher Name des Möbelstücks inkl. Größe"),
      wCm: z.number().describe("Breite in cm"),
      dCm: z.number().describe("Tiefe in cm"),
      hCm: z.number().describe("Höhe in cm"),
      x: z.number().describe("Mittelpunkt X in Wohnungskoordinaten (cm)"),
      y: z.number().describe("Mittelpunkt Y in Wohnungskoordinaten (cm)"),
      rotationDeg: z.number().describe("Drehung im Uhrzeigersinn: 0, 90, 180 oder 270"),
      colorHex: z.string(),
      materialHint: z.string().nullable(),
      estPriceEur: z.number().describe("Geschätzter Preis in Euro, Mittelklasse"),
      searchQuery: z.string().describe("Suchbegriff für Möbelsuche, deutsch"),
    }),
  ),
  lighting: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["ceiling", "floor", "wall", "table", "led_strip"]),
      note: z.string().nullable(),
      estPriceEur: z.number().nullable(),
    }),
  ),
  tips: z.array(z.string()).describe("3-4 praktische Einrichtungstipps, deutsch"),
  budgetNote: z.string().describe("Kurzer Hinweis zur Preisschätzung"),
});

export type ProposalOutput = z.infer<typeof proposalSchema>;
