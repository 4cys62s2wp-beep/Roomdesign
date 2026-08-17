// Provider-Abstraktion: DemoProvider (ohne API-Key) und ClaudeProvider
// implementieren dieselbe Schnittstelle. Die Jobs-Schicht kennt nur diese Typen.

import type { FloorPlanDoc, ProposalDoc, RoomTag } from "@/lib/types";

export interface FrameInput {
  /** JPEG, base64-kodiert (ohne data:-Präfix). */
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  timestampMs: number;
}

export interface AnalysisRequest {
  frames: FrameInput[];
  roomTags: RoomTag[];
  /** Freitext des Nutzers, z. B. bekannte Maße oder Raumbeschreibung. */
  userHints?: string;
}

export interface AnalysisResponse {
  floorPlan: FloorPlanDoc;
  /** Markdown, deutsch – Zusammenfassung der Analyse für den Nutzer. */
  summary: string;
}

export interface DesignRequest {
  doc: FloorPlanDoc;
  roomKey: string;
  stylePrompt: string;
  presets: string[];
  budgetEur: number | null;
  globalStyle?: string | null;
  count: number;
  /** Bei Refine: der bisherige Vorschlag + Feedback. */
  previous?: ProposalDoc;
  feedback?: string;
}

export type ProgressFn = (progress: number, step: string, statusText: string) => Promise<void> | void;

export interface AiProvider {
  readonly name: "demo" | "claude";
  analyzeApartment(req: AnalysisRequest, onProgress: ProgressFn): Promise<AnalysisResponse>;
  generateDesigns(req: DesignRequest, onProgress: ProgressFn): Promise<ProposalDoc[]>;
}
