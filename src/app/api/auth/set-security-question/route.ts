import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword, comparePassword } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/set-security-question
 *
 * Logged-in user sets or updates their security question + answer.
 * Body: { question, answer, currentPassword? }
 *
 * Requires currentPassword for verification if updating an existing question.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = (body.question ?? "").trim();
  const answer = (body.answer ?? "").trim().toLowerCase();
  const currentPassword = body.currentPassword ?? "";

  if (!question || !answer) {
    return NextResponse.json(
      { error: "Question and answer are required" },
      { status: 400 }
    );
  }
  if (answer.length < 2) {
    return NextResponse.json(
      { error: "Answer must be at least 2 characters" },
      { status: 400 }
    );
  }

  // If updating existing question, verify current password
  if (user.securityQuestion) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password required to update security question" },
        { status: 400 }
      );
    }
    const match = await comparePassword(currentPassword, user.passwordHash);
    if (!match) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
  }

  const answerHash = await hashPassword(answer);
  try {
    await db.user.update({
      where: { id: user.id },
      data: { securityQuestion: question, securityAnswer: answerHash },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to save security question. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Security question saved." });
}
