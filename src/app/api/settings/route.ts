import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { getSetting, resolveApiKey, setSetting, SETTING_KEYS } from "@/lib/ai";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/ai/claude";

export async function GET() {
  return withErrorHandling(async () => {
    const apiKey = await resolveApiKey();
    const model = (await getSetting(SETTING_KEYS.claudeModel)) || DEFAULT_CLAUDE_MODEL;
    const forceDemo = (await getSetting(SETTING_KEYS.forceDemoMode)) === "true";
    const keyFromEnv = Boolean(process.env.ANTHROPIC_API_KEY);
    return NextResponse.json({
      hasApiKey: Boolean(apiKey),
      apiKeyMasked: apiKey ? `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}` : null,
      keyFromEnv,
      model,
      forceDemo,
      activeProvider: forceDemo || !apiKey ? "demo" : "claude",
    });
  });
}

export async function PUT(request: NextRequest) {
  return withErrorHandling(async () => {
    const body = (await request.json()) as {
      apiKey?: string | null;
      model?: string | null;
      forceDemo?: boolean;
    };
    if (body.apiKey !== undefined) {
      await setSetting(SETTING_KEYS.anthropicApiKey, body.apiKey?.trim() || null);
    }
    if (body.model !== undefined) {
      await setSetting(SETTING_KEYS.claudeModel, body.model?.trim() || null);
    }
    if (body.forceDemo !== undefined) {
      await setSetting(SETTING_KEYS.forceDemoMode, body.forceDemo ? "true" : null);
    }
    return NextResponse.json({ ok: true });
  });
}
