// Provider-Factory: Claude, sobald ein API-Key vorhanden ist (Umgebungsvariable
// oder Einstellungen), sonst Demo-Modus. Der Demo-Modus kann in den
// Einstellungen auch erzwungen werden.

import { db } from "@/lib/db";
import type { AiProvider } from "@/lib/ai/types";
import { ClaudeProvider, DEFAULT_CLAUDE_MODEL } from "@/lib/ai/claude";
import { DemoProvider } from "@/lib/ai/demo";

export const SETTING_KEYS = {
  anthropicApiKey: "anthropicApiKey",
  claudeModel: "claudeModel",
  forceDemoMode: "forceDemoMode",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  if (value === null || value === "") {
    await db.setting.deleteMany({ where: { key } });
    return;
  }
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function resolveApiKey(): Promise<string | null> {
  return process.env.ANTHROPIC_API_KEY || (await getSetting(SETTING_KEYS.anthropicApiKey));
}

export async function getProvider(): Promise<AiProvider> {
  const forceDemo = (await getSetting(SETTING_KEYS.forceDemoMode)) === "true";
  if (forceDemo) return new DemoProvider();

  const apiKey = await resolveApiKey();
  if (!apiKey) return new DemoProvider();

  const model =
    process.env.ROOMDESIGN_CLAUDE_MODEL ||
    (await getSetting(SETTING_KEYS.claudeModel)) ||
    DEFAULT_CLAUDE_MODEL;
  return new ClaudeProvider(apiKey, model);
}

/** Welcher Provider gerade aktiv ist — ohne ihn zu instanziieren. */
export async function activeProviderName(): Promise<"demo" | "claude"> {
  const forceDemo = (await getSetting(SETTING_KEYS.forceDemoMode)) === "true";
  if (forceDemo) return "demo";
  return (await resolveApiKey()) ? "claude" : "demo";
}
