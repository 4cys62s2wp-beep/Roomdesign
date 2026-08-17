// Schnittstelle für fotorealistische Bild-Renders (bewusst noch NICHT
// implementiert — der Nutzer möchte keine zusätzlichen Bild-KI-Kosten).
// Ein Anbieter (z. B. Google Gemini oder OpenAI gpt-image-1) kann später
// angesteckt werden, indem diese Schnittstelle implementiert und in der
// Factory registriert wird. Die UI zeigt bis dahin die 3D-Vorschau.

import type { ProposalDoc, RoomShape } from "@/lib/types";

export interface RenderRequest {
  room: RoomShape;
  proposal: ProposalDoc;
  /** Optionales Foto des leeren Raums als Ausgangsbasis (base64 JPEG). */
  basePhotoBase64?: string;
  /** Blickwinkel-Beschreibung, z. B. "von der Tür aus". */
  viewpoint?: string;
}

export interface RenderResult {
  imageBase64: string;
  mediaType: "image/png" | "image/jpeg";
}

export interface ImageRenderProvider {
  readonly name: string;
  renderRoom(req: RenderRequest): Promise<RenderResult>;
}

/** Aktuell ist kein Bild-Render-Anbieter konfiguriert. */
export function getImageRenderProvider(): ImageRenderProvider | null {
  return null;
}
