// DemoProvider: liefert ohne API-Key realistische, deterministische Ergebnisse
// mit simulierten Verarbeitungsschritten, sodass die gesamte App bedienbar ist.

import type { AiProvider, AnalysisRequest, AnalysisResponse, DesignRequest, ProgressFn } from "@/lib/ai/types";
import type { ProposalDoc } from "@/lib/types";
import { DEMO_ANALYSIS_SUMMARY, demoFloorPlan, demoProposalsForRoom } from "@/lib/demo/fixtures";

const STEP_DELAY_MS = 900;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DemoProvider implements AiProvider {
  readonly name = "demo" as const;

  async analyzeApartment(req: AnalysisRequest, onProgress: ProgressFn): Promise<AnalysisResponse> {
    const frameNote =
      req.frames.length > 0
        ? `${req.frames.length} Frames werden gesichtet …`
        : "Demo-Rundgang wird geladen …";
    const steps: Array<[number, string, string]> = [
      [10, "analyzing_rooms", frameNote],
      [30, "analyzing_rooms", "Räume werden erkannt (Gang, Bad, Wohnzimmer, Küche, Schlafzimmer) …"],
      [55, "estimating_geometry", "Maße werden geschätzt (Referenz: Türhöhe ≈ 200 cm) …"],
      [75, "estimating_geometry", "Türen, Fenster und Durchgänge werden verortet …"],
      [90, "assembling", "Grundriss wird zusammengesetzt …"],
    ];
    for (const [progress, step, text] of steps) {
      await onProgress(progress, step, text);
      await delay(STEP_DELAY_MS);
    }
    return { floorPlan: demoFloorPlan(), summary: DEMO_ANALYSIS_SUMMARY };
  }

  async generateDesigns(req: DesignRequest, onProgress: ProgressFn): Promise<ProposalDoc[]> {
    const room = req.doc.rooms.find((r) => r.id === req.roomKey);
    if (!room) {
      throw new Error(`Raum "${req.roomKey}" nicht im Grundriss gefunden.`);
    }
    const steps: Array<[number, string, string]> = [
      [15, "designing", `Raumanalyse für „${room.name}" …`],
      [40, "designing", "Stilrichtungen und Farbpaletten werden entworfen …"],
      [70, "designing", "Möbel werden ausgewählt und platziert …"],
      [90, "designing", "Budget und Lichtplan werden kalkuliert …"],
    ];
    for (const [progress, step, text] of steps) {
      await onProgress(progress, step, text);
      await delay(STEP_DELAY_MS);
    }
    return demoProposalsForRoom(room, req.count, {
      stylePrompt: req.feedback ? undefined : req.stylePrompt || undefined,
      feedback: req.feedback,
      presets: req.presets,
    });
  }
}
