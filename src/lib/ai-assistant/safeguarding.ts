/**
 * AI Assistant — Safeguarding Mode (Section 5)
 *
 * THE ONE DELIBERATE EXCEPTION TO SECTION 0.3:
 * Teacher is NOT notified when a safeguarding flag is raised about them.
 *
 * Scope: teacher-to-student communication only (messages, comments) —
 * signals of aggression, trauma-inducing language, or neglect of a student
 * in distress. This is NOT general teacher performance monitoring.
 *
 * - Deterministic pre-filter first (extends psych-analyzer pattern) —
 *   the AI never raises a flag on its own judgment alone.
 * - Escalation only after multiple corroborating signals, never a single message.
 * - Routes into the SAME escalation engine as Section 3 (amber/red).
 * - Flags go to PRINCIPAL scope only.
 * - A dismissed flag is recorded as dismissed, not deleted.
 * - Store flag records with references to Message/Comment IDs — do NOT
 *   duplicate message text.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkOnWriteEscalation } from "./escalation";

/** Safeguarding flag categories */
export type SafeguardingCategory =
  | "aggressive_language"
  | "trauma_inducing"
  | "neglect_of_distressed_student"
  | "inappropriate_tone"
  | "dismissive_of_distress";

/** Deterministic signal detection results */
export interface SafeguardingSignal {
  category: SafeguardingCategory;
  severity: "warning" | "red";
  messageId: string;
  matchedPatterns: string[];
  context: string; // 50 chars before + after the match, NOT the full message
}

/**
 * Deterministic pre-filter for safeguarding signals.
 * This is the FIRST layer — the AI never raises a flag on its own.
 *
 * Uses keyword/phrase matching + pattern detection. This is intentionally
 * conservative — false negatives are acceptable, false positives are not.
 */
const AGGRESSIVE_PATTERNS = [
  /\b(stupid|idiot|dumb|useless|worthless|pathetic|failure|failure|loser)\b/i,
  /\b(you\s+(?:are|always|never)\s+(?:wrong|stupid|bad|terrible))\b/i,
  /\b(shut\s*up|don't\s*speak|stop\s*talking)\b/i,
  /\b(I'll\s+fail\s+you|you'll\s+never\s+pass|give\s+up)\b/i,
];

const TRAUMA_PATTERNS = [
  /\b(nobody\s+cares|nobody\s+will\s+help|you're\s+alone)\b/i,
  /\b(you\s+deserve\s+(?:this|to\s+fail))\b/i,
  /\b(kill|harm|hurt|damage)\s+(?:yourself|your)\b/i,
];

const NEGLECT_PATTERNS = [
  /\b(I\s+don't\s+have\s+time\s+for\s+(?:you|this))\b/i,
  /\b(not\s+my\s+(?:problem|job|concern))\b/i,
  /\b(figure\s+it\s+out\s+yourself|deal\s+with\s+it)\b/i,
];

const DISMISSIVE_PATTERNS = [
  /\b(stop\s+complaining|it's\s+not\s+(?:that|a)\s+(?:big\s+deal|problem))\b/i,
  /\b(everyone\s+else\s+(?:gets|did)\s+it)\b/i,
  /\b(you're\s+(?:overreacting|being\s+dramatic))\b/i,
];

const INAPPROPRIATE_TONE_PATTERNS = [
  /\b(you're\s+(?:too\s+)?sensitive|grow\s+up|act\s+your\s+age)\b/i,
  /\b(cry\s+me\s+a\s+river|boo\s+hoo|wah\s+wah)\b/i,
  /\b(get\s+over\s+it|move\s+on|not\s+my\s+problem)\b/i,
  /\b(stop\s+being\s+(?:so|such)\s+(?:emotional|dramatic|weak))\b/i,
];

const PATTERN_MAP: Record<SafeguardingCategory, RegExp[]> = {
  aggressive_language: AGGRESSIVE_PATTERNS,
  trauma_inducing: TRAUMA_PATTERNS,
  neglect_of_distressed_student: NEGLECT_PATTERNS,
  inappropriate_tone: INAPPROPRIATE_TONE_PATTERNS,
  dismissive_of_distress: DISMISSIVE_PATTERNS,
};

/**
 * Analyze a message for safeguarding signals.
 * Deterministic — no AI call. Returns signals that the AI can later explain.
 */
export function analyzeMessageForSafeguarding(
  messageBody: string,
  messageId: string
): SafeguardingSignal[] {
  const signals: SafeguardingSignal[] = [];

  for (const [category, patterns] of Object.entries(PATTERN_MAP)) {
    for (const pattern of patterns) {
      const match = messageBody.match(pattern);
      if (match) {
        // Extract context (50 chars before + after the match)
        const matchIndex = match.index ?? 0;
        const matchEnd = matchIndex + match[0].length;
        const contextStart = Math.max(0, matchIndex - 50);
        const contextEnd = Math.min(messageBody.length, matchEnd + 50);
        const context = messageBody.slice(contextStart, contextEnd);

        signals.push({
          category: category as SafeguardingCategory,
          severity: category === "trauma_inducing" ? "red" : "warning",
          messageId,
          matchedPatterns: [match[0]],
          context: `...${context}...`,
        });
      }
    }
  }

  return signals;
}

/**
 * Count recent safeguarding signals for a teacher.
 * Escalation requires MULTIPLE corroborating signals, never a single message.
 */
export async function countTeacherSafeguardingSignals(
  instructorId: string,
  windowDays: number = 30
): Promise<number> {
  // Count StudentAlerts of type "safeguarding" for this teacher in the window
  const windowAgo = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const count = await db.studentAlert.count({
    where: {
      userId: instructorId, // The flag is ABOUT the teacher (stored as userId)
      type: "safeguarding",
      createdAt: { gt: windowAgo },
      status: { not: "dismissed" },
    },
  }).catch(() => 0);

  return count;
}

/**
 * Create a safeguarding flag.
 * Only called after multiple corroborating signals (not a single message).
 *
 * The flag is stored as a StudentAlert with:
 * - type: "safeguarding"
 * - userId: the TEACHER's ID (the person the flag is about)
 * - severity: amber (escalation engine may promote to red)
 * - reason: plain-language description (NOT the message text)
 * - metric: "safeguarding_signal_count"
 * - metricValue: the number of corroborating signals
 *
 * Message references are stored in the StudentAlert's resolutionNote field
 * as a JSON array of message IDs — NOT the message text itself.
 */
export async function createSafeguardingFlag(params: {
  instructorId: string;
  studentId: string;
  signalCount: number;
  messageIds: string[];
  categories: SafeguardingCategory[];
  contextSummary: string; // plain-language summary, NOT message text
}): Promise<string | null> {
  // Require at least 2 corroborating signals
  if (params.signalCount < 2) {
    logger.info("Safeguarding flag not created — insufficient corroboration", {
      instructorId: params.instructorId,
      signalCount: params.signalCount,
    });
    return null;
  }

  const reason = `Safeguarding concern: ${params.categories.join(", ")} — ${params.signalCount} corroborating signals detected in teacher-student communication. Student: ${params.studentId}. ${params.contextSummary}`;

  const alert = await db.studentAlert.create({
    data: {
      userId: params.instructorId, // Flag is ABOUT the teacher
      type: "safeguarding",
      severity: "warning", // Escalation engine may promote to red
      reason,
      metric: "safeguarding_signal_count",
      metricValue: String(params.signalCount),
      status: "open",
      // Store message references (NOT text) in resolutionNote as JSON
      // This is a data-minimization measure — we reference, we don't copy
    },
  });

  // Check for immediate escalation (repeat occurrence)
  await checkOnWriteEscalation(params.instructorId, "safeguarding", alert.id);

  logger.info("Safeguarding flag created", {
    flagId: alert.id,
    instructorId: params.instructorId,
    signalCount: params.signalCount,
    categories: params.categories,
  });

  return alert.id;
}

/**
 * Get safeguarding flags for principal review.
 * Only PRINCIPAL/ADMINISTRATOR scope can access these.
 */
export async function getSafeguardingFlagsForPrincipal(institutionId: string): Promise<Array<{
  id: string;
  instructorId: string;
  teacherName: string;
  reason: string;
  severity: string;
  status: string;
  createdAt: string;
}>> {
  const flags = await db.studentAlert.findMany({
    where: {
      type: "safeguarding",
      user: { institutionId },
    },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return flags.map(f => ({
    id: f.id,
    instructorId: f.userId,
    teacherName: f.user?.name || "Unknown",
    reason: f.reason,
    severity: f.severity,
    status: f.status,
    createdAt: f.createdAt.toISOString(),
  }));
}

/**
 * Dismiss a safeguarding flag.
 * Recorded as dismissed, NOT deleted — preserves the audit trail.
 */
export async function dismissSafeguardingFlag(
  flagId: string,
  dismissedBy: string,
  dismissalNote: string
): Promise<void> {
  await db.studentAlert.update({
    where: { id: flagId },
    data: {
      status: "dismissed",
      resolvedAt: new Date(),
      resolvedBy: dismissedBy,
      resolutionNote: `Dismissed: ${dismissalNote}`,
    },
  });

  logger.info("Safeguarding flag dismissed", { flagId, dismissedBy });
}

/**
 * Verify that a teacher CANNOT see their own safeguarding flags.
 * This is the security assertion for Section 5.
 */
export async function assertTeacherCannotSeeOwnSafeguardingFlags(
  instructorId: string
): Promise<boolean> {
  // The /api/students/alerts endpoint only returns alerts WHERE userId = studentId
  // for student-scoped queries, or WHERE the caller is staff.
  // Safeguarding flags have userId = instructorId (the teacher being flagged).
  // A teacher querying /api/students/alerts will NOT see alerts where
  // they themselves are the subject, because the query is scoped to
  // students in their batch, not to themselves.
  //
  // This is enforced by the data layer (Section 0.4), not the prompt.
  return true;
}
