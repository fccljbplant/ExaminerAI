import { hasRole, PLATFORM_ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { setAIKey, isAIConfigured, hasAI } from "@/lib/ai-provider";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** GET /api/settings/ai-key — returns whether AI is configured.
 *  Supports both Z.ai (primary) and DeepSeek (fallback). */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, PLATFORM_ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const zaiEnvSet = !!process.env.ZAI_API_KEY;
  const dsEnvSet = !!process.env.DEEPSEEK_API_KEY;
  const dbConfigured = await isAIConfigured();

  return NextResponse.json({
    provider: zaiEnvSet ? "zai" : dsEnvSet ? "deepseek" : dbConfigured ? "database" : "none",
    configured: dbConfigured || zaiEnvSet || dsEnvSet,
    source: zaiEnvSet ? "env (ZAI_API_KEY)" : dsEnvSet ? "env (DEEPSEEK_API_KEY)" : dbConfigured ? "database" : "none",
    zaiEnvSet,
    dsEnvSet,
    dbKeySet: dbConfigured && !zaiEnvSet && !dsEnvSet,
  });
}

/** POST /api/settings/ai-key — save the AI API key to the DB.
 *  Body: { apiKey: string, provider?: "zai" | "deepseek" }
 *  Default provider is "zai" (Z.ai). */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing settings"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, PLATFORM_ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const apiKey = (body.apiKey as string | undefined)?.trim();
  const provider = (body.provider as "zai" | "deepseek") || "zai";

  const envVarName = provider === "zai" ? "ZAI_API_KEY" : "DEEPSEEK_API_KEY";
  if (process.env[envVarName]) {
    return NextResponse.json({
      ok: false,
      error: `${envVarName} is set as an environment variable, which takes precedence. To use a different key, unset the env var on Vercel.`,
      envVarSet: true,
    }, { status: 409 });
  }

  try {
    await setAIKey(apiKey || null, provider);
    return NextResponse.json({
      ok: true,
      configured: !!apiKey,
      message: apiKey ? `${provider === "zai" ? "Z.ai" : "DeepSeek"} API key saved to database.` : "API key cleared.",
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save key",
    }, { status: 500 });
  }
}

/** DELETE /api/settings/ai-key — clear the DB-stored key.
 *  Query: ?provider=zai|deepseek (default: zai) */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing settings"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, PLATFORM_ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const provider = (new URL(req.url).searchParams.get("provider") as "zai" | "deepseek") || "zai";

  try {
    await setAIKey(null, provider);
    return NextResponse.json({ ok: true, message: `${provider === "zai" ? "Z.ai" : "DeepSeek"} API key cleared.` });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Failed to clear key",
    }, { status: 500 });
  }
}
