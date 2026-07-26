import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";

/** GET /api/daily-motivation — returns a single AI-generated motivational
 *  statement that renews once per day (UTC midnight). The SAME statement is
 *  shown to every student on a given day.
 *
 *  Caching strategy:
 *  - The statement is cached in the Setting table with key
 *    `daily_motivation_YYYY-MM-DD`.
 *  - First student to hit the endpoint each day triggers the AI call; all
 *    subsequent students that day get the cached value.
 *  - Falls back to a static encouraging statement if AI is unavailable.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Today's date key in UTC (so everyone sees the same statement regardless
  // of their timezone — renews at UTC midnight)
  const todayKey = `daily_motivation_${new Date().toISOString().slice(0, 10)}`;

  // Check cache first
  const cached = await db.setting.findUnique({ where: { key: todayKey } }).catch(() => null);
  if (cached?.value) {
    return NextResponse.json({ statement: cached.value, date: todayKey, cached: true });
  }

  // Generate a fresh statement via AI
  let statement = "";
  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = user.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(user.id, "daily-motivation", isDemo);
    if (blocked) return NextResponse.json({ error: blocked.body.error }, { status: blocked.status });

    const result = await callAI([
      {
        role: "user",
        content: `Generate ONE short motivational statement for a beginner web development bootcamp student. The statement must be:
- A SINGLE line (one sentence)
- Short (max 15 words)
- Simple and easy to understand (beginner-friendly, no jargon)
- Encouraging and uplifting
- Generic enough to apply to any student on any day
- NOT about a specific technology (no "WordPress", "React", etc.)
- Plain text only (no emojis, no markdown, no quotes)

Examples of good statements:
"Every expert was once a beginner who refused to give up."
"Small steps every day lead to big results."
"Your future self will thank you for the effort you put in today."

Return ONLY the statement text — nothing else, no explanation, no quotes around it.`,
      },
    ], {
      temperature: 0.8,
      maxTokens: TOKEN_BUDGET.CONNECTION_TEST + 20,
      feature: "daily-motivation",
      // H12 fix: pass userId for per-user rate limiting + usage attribution
      userId: user.id,
      // Token cache: the input is identical for every student on the same day.
      // If multiple serverless instances miss the DB cache simultaneously,
      // the in-memory cache prevents duplicate AI calls within the same instance.
      cacheable: true,
      cacheTtlMs: 6 * 60 * 60 * 1000, // 6 hours — covers a school day
    });

    statement = (result.text || "").trim().replace(/^["']|["']$/g, "").trim();
    if (!statement || statement.length > 120) {
      // Too long or empty — use fallback
      statement = "";
    }
  } catch {
    // AI unavailable — use fallback
    statement = "";
  }

  // Fallback statements (rotating based on day of year so they vary)
  if (!statement) {
    const fallbacks = [
      "Every expert was once a beginner who refused to give up.",
      "Small steps every day lead to big results.",
      "Your future self will thank you for the effort you put in today.",
      "Progress, not perfection — keep moving forward.",
      "The only way to learn is by doing. You're doing great.",
      "Consistency beats intensity. Show up today.",
      "Every line of code you write makes you better than yesterday.",
    ];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    statement = fallbacks[dayOfYear % fallbacks.length];
  }

  // Cache for the rest of the day (non-blocking — if it fails, next request
  // will just regenerate)
  try {
    await db.setting.upsert({
      where: { key: todayKey },
      update: { value: statement },
      create: { key: todayKey, value: statement },
    });
  } catch {
    // Non-blocking
  }

  return NextResponse.json({ statement, date: todayKey, cached: false });
}
