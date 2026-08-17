// ClaudeProvider: echte KI-Analyse über die Anthropic-API.
// Videoframes -> strukturierte Raumerkennung (Vision) -> Auto-Layout;
// Designvorschläge als strukturierte JSON-Ausgabe (ein API-Call pro Vorschlag).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AiProvider, AnalysisRequest, AnalysisResponse, DesignRequest, ProgressFn } from "@/lib/ai/types";
import { analysisSchema, proposalSchema, type ProposalOutput } from "@/lib/ai/schemas";
import {
  ANALYSIS_SYSTEM_PROMPT,
  DESIGN_SYSTEM_PROMPT,
  buildAnalysisUserText,
  buildDesignUserText,
} from "@/lib/ai/prompts";
import { layoutFloorPlan, type EstimatedRoom } from "@/lib/geometry/layout";
import type { FurnitureItem, ProposalDoc, RoomType } from "@/lib/types";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5";

const MAX_FRAMES = 32;

export class ClaudeProvider implements AiProvider {
  readonly name = "claude" as const;
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string = DEFAULT_CLAUDE_MODEL,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async analyzeApartment(req: AnalysisRequest, onProgress: ProgressFn): Promise<AnalysisResponse> {
    if (req.frames.length === 0) {
      throw new Error(
        "Keine Videoframes vorhanden. Bitte zuerst einen Rundgang aufnehmen oder ein Video hochladen.",
      );
    }
    const frames = req.frames.slice(0, MAX_FRAMES);
    await onProgress(10, "analyzing_rooms", `${frames.length} Frames werden an Claude gesendet …`);

    const content: Anthropic.ContentBlockParam[] = [];
    frames.forEach((frame, index) => {
      content.push({
        type: "text",
        text: `Frame ${index + 1}/${frames.length} — t=${Math.round(frame.timestampMs / 1000)}s:`,
      });
      content.push({
        type: "image",
        source: { type: "base64", media_type: frame.mediaType, data: frame.base64 },
      });
    });
    content.push({ type: "text", text: buildAnalysisUserText(req.roomTags, req.userHints) });

    await onProgress(25, "analyzing_rooms", "Claude erkennt Räume und schätzt Maße …");
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(analysisSchema) },
    });
    const analysis = response.parsed_output;
    if (!analysis) {
      throw new Error("Die KI-Antwort konnte nicht ausgewertet werden. Bitte erneut versuchen.");
    }

    await onProgress(75, "assembling", "Grundriss wird aus der Analyse zusammengesetzt …");
    const estimatedRooms: EstimatedRoom[] = analysis.rooms.map((room) => ({
      key: sanitizeKey(room.key),
      name: room.name,
      type: room.type as RoomType,
      widthCm: clampNumber(room.widthCm, 80, 1500, 300),
      depthCm: clampNumber(room.depthCm, 80, 1500, 300),
      ceilingHeightCm: clampNumber(room.ceilingHeightCm, 200, 400, 250),
      confidence: clampNumber(room.confidence, 0, 1, 0.5),
      windowCount: Math.max(0, Math.round(room.windowCount)),
      connections: room.connections.map((c) => ({ roomKey: sanitizeKey(c.roomKey), kind: c.kind })),
    }));

    const floorPlan = layoutFloorPlan(estimatedRooms, {
      confidence: average(estimatedRooms.map((r) => r.confidence)),
      note: `Maßstab: ${analysis.scaleReference}. Maße sind KI-Schätzungen — bitte im Editor prüfen.`,
    });

    return { floorPlan, summary: analysis.summary };
  }

  async generateDesigns(req: DesignRequest, onProgress: ProgressFn): Promise<ProposalDoc[]> {
    const room = req.doc.rooms.find((r) => r.id === req.roomKey);
    if (!room) {
      throw new Error(`Raum "${req.roomKey}" nicht im Grundriss gefunden.`);
    }

    const proposals: ProposalDoc[] = [];
    const existingTitles: string[] = [];
    const count = req.feedback ? 1 : Math.max(1, req.count);

    for (let i = 0; i < count; i++) {
      const progressBase = 10 + (80 * i) / count;
      await onProgress(
        Math.round(progressBase),
        "designing",
        count === 1
          ? `Claude entwirft „${room.name}" …`
          : `Claude entwirft Vorschlag ${i + 1} von ${count} für „${room.name}" …`,
      );

      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 16000,
        system: DESIGN_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildDesignUserText({
              doc: req.doc,
              room,
              stylePrompt: req.stylePrompt,
              presets: req.presets,
              budgetEur: req.budgetEur,
              globalStyle: req.globalStyle,
              variantIndex: i,
              existingTitles,
              previousProposalJson: req.previous ? JSON.stringify(req.previous) : undefined,
              feedback: req.feedback,
            }),
          },
        ],
        output_config: { format: zodOutputFormat(proposalSchema) },
      });
      const output = response.parsed_output;
      if (!output) {
        throw new Error("Die KI-Antwort konnte nicht ausgewertet werden. Bitte erneut versuchen.");
      }
      const proposal = toProposalDoc(output, room.id, i);
      proposals.push(proposal);
      existingTitles.push(proposal.title);
    }

    return proposals;
  }
}

function toProposalDoc(output: ProposalOutput, roomId: string, variant: number): ProposalDoc {
  const furniture: FurnitureItem[] = output.furniture.map((item, index) => ({
    id: `${roomId}-v${variant}-${index}-${item.kind}`,
    kind: item.kind,
    label: item.label,
    wCm: item.wCm,
    dCm: item.dCm,
    hCm: item.hCm,
    x: item.x,
    y: item.y,
    rotationDeg: ((Math.round(item.rotationDeg / 90) * 90) % 360 + 360) % 360,
    colorHex: normalizeHex(item.colorHex),
    materialHint: item.materialHint ?? undefined,
    estPriceEur: Math.max(0, item.estPriceEur),
    searchQuery: item.searchQuery,
  }));
  const furnitureTotal = furniture.reduce((sum, f) => sum + f.estPriceEur, 0);
  const lightingTotal = output.lighting.reduce((sum, l) => sum + (l.estPriceEur ?? 0), 0);

  return {
    title: output.title,
    concept: output.concept,
    style: output.style,
    palette: output.palette.map((c) => ({ ...c, hex: normalizeHex(c.hex) })),
    wallColorHex: normalizeHex(output.wallColorHex),
    floor: { material: output.floorMaterial, colorHex: normalizeHex(output.floorColorHex) },
    materials: output.materials.map((m) => ({
      surface: m.surface,
      material: m.material,
      colorHex: m.colorHex ? normalizeHex(m.colorHex) : undefined,
      note: m.note ?? undefined,
    })),
    furniture,
    lighting: output.lighting.map((l) => ({
      name: l.name,
      kind: l.kind,
      note: l.note ?? undefined,
      estPriceEur: l.estPriceEur ?? undefined,
    })),
    tips: output.tips,
    budget: { totalEur: furnitureTotal + lightingTotal, note: output.budgetNote },
  };
}

function sanitizeKey(key: string): string {
  const cleaned = key
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9_-]/g, "-");
  return cleaned || "raum";
}

function normalizeHex(hex: string): string {
  const match = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toUpperCase()}` : "#CCCCCC";
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0.5;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
