import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkUserAILimit, isDemoAIBlocked, isDemoAIEnabled } from "@/lib/ai-rate-limits";

/**
 * GET /api/ai/limits — returns the current user's AI usage + limits for today.
 *
 * Used by the UI to show "X/150 tutor messages used today" and warn before
 * the user hits the limit.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isDemoUser = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
  const demoBlocked = await isDemoAIBlocked(isDemoUser);
  const demoAIEnabled = await isDemoAIEnabled();

  // Students see test + tutor limits. Staff see assistant limits. Demo sees all.
  const categories: Array<"test" | "tutor" | "assistant"> = ["test", "tutor", "assistant"];

  const limits = await Promise.all(
    categories.map(async (cat) => {
      const r = await checkUserAILimit(user.id, cat);
      return {
        category: cat,
        used: r.used,
        limit: r.limit,
        remaining: r.remaining,
        resetAt: r.resetAt.toISOString(),
      };
    })
  );

  return NextResponse.json({
    limits,
    demoBlocked,
    demoAIEnabled,
    isDemoUser,
  });
}
