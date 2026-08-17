// Prompts für den ClaudeProvider. Nutzersichtbare Textfelder werden auf
// Deutsch angefordert; die Instruktionen selbst sind englisch formuliert.

import type { FloorPlanDoc, RoomShape } from "@/lib/types";
import type { RoomTag } from "@/lib/types";
import { roomAreaM2 } from "@/lib/geometry/floorplan";

export const ANALYSIS_SYSTEM_PROMPT = `You are an expert architect and interior surveyor. You analyze frames from a smartphone walkthrough video of an EMPTY apartment and reconstruct its floor plan.

Approach:
1. Identify distinct rooms across the frames (frames are in chronological walking order; timestamps are given). Use lighting, flooring, windows, and door frames to tell rooms apart.
2. Estimate dimensions using reference objects: interior door height ≈ 200 cm, door width ≈ 80-90 cm, ceiling height typically 240-270 cm, standard tiles 30-60 cm, window sills ≈ 85-95 cm. State which reference you used.
3. Determine the topology: which rooms connect to which, via a door or an open passage.
4. Count visible windows per room.
5. Be honest about uncertainty: set confidence between 0.3 (rough guess) and 0.9 (very confident). Depth along the walking direction is usually harder to estimate than width.

Rules:
- Model each room as a rectangle (widthCm x depthCm). The user will refine the exact shape later in an editor.
- Room keys must be short lowercase identifiers without spaces or umlauts (e.g. "gang", "wohnzimmer").
- Every room except isolated ones must appear in at least one connection. Connections must be symmetric in meaning but should be listed only once (on either room).
- All user-visible text (names, summary) must be in German.`;

export function buildAnalysisUserText(roomTags: RoomTag[], userHints?: string): string {
  const parts: string[] = [
    "Analyze the following walkthrough frames of an empty apartment and return the structured result.",
  ];
  if (roomTags.length > 0) {
    parts.push(
      "The user tagged rooms while recording (timestamp in ms => room label):\n" +
        roomTags.map((tag) => `- ${tag.timestampMs} ms => ${tag.label}`).join("\n"),
    );
  }
  if (userHints?.trim()) {
    parts.push(`Additional hints from the user (German): ${userHints.trim()}`);
  }
  return parts.join("\n\n");
}

export const DESIGN_SYSTEM_PROMPT = `You are an award-winning interior designer creating a furnishing proposal for ONE room of an apartment. You receive the room geometry in absolute apartment coordinates (unit: cm, x to the right, y downward) including door and window positions.

Hard requirements for furniture placement:
- Coordinates (x, y) are the CENTER of each furniture footprint in apartment coordinates and MUST lie inside the room polygon.
- Furniture must not overlap each other (except rugs, which may lie under furniture) and must not block door openings or passages (keep ≈ 80 cm clearance in front of doors).
- rotationDeg is clockwise; 0 means the width (wCm) runs along the x-axis. The "front" of a piece faces +y in its local frame. Use only 0, 90, 180, 270.
- Use realistic furniture dimensions and realistic mid-range prices in EUR.
- Respect the room type: bathrooms need sanitary objects, kitchens a kitchen block, etc.
- Windows must stay usable; do not place tall furniture in front of them. Radiators are usually below windows.

Content requirements:
- All user-visible text in German.
- The concept text should be vivid but practical (2-3 short paragraphs, Markdown).
- The palette must contain exactly one color with role "wall" and one with role "floor", plus 3-4 more.
- Include a lighting plan (ceiling/floor/wall/LED) and 3-4 practical tips.
- Prices: realistic mid-range estimates; searchQuery should be a German shopping search phrase.`;

export function buildDesignUserText(input: {
  doc: FloorPlanDoc;
  room: RoomShape;
  stylePrompt: string;
  presets: string[];
  budgetEur: number | null;
  globalStyle?: string | null;
  variantIndex: number;
  existingTitles: string[];
  previousProposalJson?: string;
  feedback?: string;
}): string {
  const { doc, room } = input;
  const openings = doc.openings
    .filter((o) => {
      const other = o.roomB === room.id;
      return o.wall.roomId === room.id || other;
    })
    .map((o) => ({
      kind: o.kind,
      wall: o.wall,
      roomB: o.roomB ?? null,
      offsetCm: o.offsetCm,
      widthCm: o.widthCm,
      heightCm: o.heightCm,
      sillCm: o.sillCm ?? null,
    }));

  const parts: string[] = [
    `Room to design: "${room.name}" (type: ${room.type}), area ≈ ${roomAreaM2(room).toFixed(1)} m², ceiling height ${room.ceilingHeightCm} cm.`,
    `Room polygon (apartment coordinates, cm, clockwise): ${JSON.stringify(room.polygon)}`,
    `Openings touching this room (offsets measured along the owning room's edge): ${JSON.stringify(openings)}`,
    `Other rooms in the apartment (context): ${doc.rooms
      .filter((r) => r.id !== room.id)
      .map((r) => `${r.name} (${r.type})`)
      .join(", ") || "none"}`,
  ];

  if (input.stylePrompt.trim()) {
    parts.push(`User's style wishes (German): ${input.stylePrompt.trim()}`);
  }
  if (input.presets.length > 0) {
    parts.push(`Selected style presets: ${input.presets.join(", ")}`);
  }
  if (input.budgetEur) {
    parts.push(`Budget for this room: about ${input.budgetEur} EUR total. Stay within roughly this budget.`);
  }
  if (input.globalStyle?.trim()) {
    parts.push(`Overall apartment style (keep proposals coherent with it): ${input.globalStyle.trim()}`);
  }
  if (input.previousProposalJson && input.feedback) {
    parts.push(
      `This is a REVISION. Previous proposal: ${input.previousProposalJson}`,
      `User feedback to incorporate (German): "${input.feedback}". Keep what worked, change what the feedback asks for, and mention in the concept how the feedback was addressed.`,
    );
  } else {
    parts.push(
      `This is proposal variant #${input.variantIndex + 1}.` +
        (input.existingTitles.length > 0
          ? ` It must differ clearly in direction from these existing proposals: ${input.existingTitles.join("; ")}.`
          : ""),
    );
  }
  parts.push("Create one complete furnishing proposal for this room.");
  return parts.join("\n\n");
}
