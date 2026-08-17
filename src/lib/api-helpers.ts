import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Einheitliches Fehler-Handling für Route-Handler. */
export async function withErrorHandling<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error("[api]", error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return jsonError(message, 500);
  }
}
