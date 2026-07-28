import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/** GET /api/admin/instructor-behavior — returns instructor AI Assistant sessions +
 *  behavioral signal summaries for the admin/principal dashboard.
 *
 *  Returns:
 *    - sessions: recent ChatSession rows where chatbotType="teacher_tutor"
 *      (one row per AI Assistant turn), with the instructor's name/email/role.
 *    - summary: per-instructor aggregate (session count, last active, avg length,
 *      dominant language, engagement tier).
 *
 *  Admin-only (principal + administrator). Developer is excluded — instructor
 *  behavioral data is pastoral, not technical.
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch recent teacher_tutor sessions (last 100, most recent first)
  const sessions = await db.chatSession.findMany({
    where: { chatbotType: "teacher_tutor" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          batchId: true,
        },
      },
    },
  });

  // Build per-instructor summary
  const byTeacher = new Map<string, {
    instructorId: string;
    name: string;
    email: string;
    role: string;
    sessionCount: number;
    lastActive: Date | null;
    totalMessages: number;
    avgSessionLength: number;
  }>();

  for (const s of sessions) {
    const existing = byTeacher.get(s.userId) ?? {
      instructorId: s.userId,
      name: s.user.name,
      email: s.user.email,
      role: s.user.role,
      sessionCount: 0,
      lastActive: null as Date | null,
      totalMessages: 0,
      avgSessionLength: 0,
    };
    existing.sessionCount++;
    if (!existing.lastActive || s.createdAt > existing.lastActive) {
      existing.lastActive = s.createdAt;
    }
    // Parse conversation to count messages
    try {
      const convo = JSON.parse(s.conversation || "[]");
      existing.totalMessages += Array.isArray(convo) ? convo.length : 0;
    } catch {/* ignore parse errors */}
    byTeacher.set(s.userId, existing);
  }

  // Finalize averages
  const summary = Array.from(byTeacher.values()).map(t => ({
    ...t,
    avgSessionLength: t.sessionCount > 0 ? Math.round(t.totalMessages / t.sessionCount) : 0,
  }));

  // Shape sessions for the client (truncate conversation to keep payload small)
  const shapedSessions = sessions.map(s => {
    let conversation: Array<{ role: string; content: string; timestamp?: string }> = [];
    try {
      conversation = JSON.parse(s.conversation || "[]");
    } catch {/* ignore */}
    return {
      id: s.id,
      instructorId: s.userId,
      teacherName: s.user.name,
      teacherEmail: s.user.email,
      teacherRole: s.user.role,
      topic: s.topic,
      status: s.status,
      createdAt: s.createdAt,
      messageCount: conversation.length,
      // Include only the first 2 + last 2 messages to keep payload small
      preview: conversation.length <= 4
        ? conversation
        : [...conversation.slice(0, 2), ...conversation.slice(-2)],
      behavioralSignals: s.behavioralSignals ? JSON.parse(s.behavioralSignals) : null,
      psychAnalysis: s.psychAnalysis,
    };
  });

  return NextResponse.json({
    sessions: shapedSessions,
    summary,
    totalSessions: sessions.length,
    uniqueTeachers: byTeacher.size,
  });
}
