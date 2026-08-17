import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Notification system — DB-backed in-app notifications surfaced through
 * the bell icon in AppShell.
 *
 * Design notes:
 *   - We do NOT depend on nodemailer / Resend / SendGrid. Notifications
 *     are persisted as rows in the `Notification` table.
 *   - An optional `EMAIL_WEBHOOK_URL` env var can be wired in later to
 *     POST these notifications to an external email provider without
 *     touching this module's API.
 *   - Every `send*` helper is best-effort: failures are logged but never
 *     throw — they MUST NOT break the calling flow (e.g. enrollment).
 */

export type NotificationType =
  | "enrollment"
  | "course_completed"
  | "credential_earned"
  | "message_received"
  | "milestone_earned"
  // B2B enterprise ops (2026-08-17): org announcements, compliance
  // expiry nudges and payment-failure dunning all persist Notification
  // rows; Notification.type is a free String column so the union here
  // is the only place that needs to know about the new values.
  | "announcement"
  | "training_due"
  | "payment_failed";

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Optional deep link — where the bell click should navigate. */
  link?: string;
}

/** Create a notification row. Best-effort — never throws. */
export async function sendNotification(input: SendNotificationInput): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
      },
    });

    // Fire-and-forget webhook for external email delivery. We never block
    // the caller on this; failures are only logged.
    void maybeDispatchEmailWebhook(input).catch((err) => {
      logger.warn("Notification email webhook failed", {
        userId: input.userId,
        type: input.type,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  } catch (err) {
    logger.error("Failed to persist notification", {
      userId: input.userId,
      type: input.type,
      title: input.title,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Send an enrollment confirmation notification (course just enrolled). */
export async function sendEnrollmentConfirmation(
  userId: string,
  courseName: string,
  courseId: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "enrollment",
    title: `Enrolled in ${courseName}`,
    body: `You're in! Start with Week 1, Day 1 of ${courseName}. Your AI tutor and capstone guide are ready when you are.`,
    link: `/app?course=${courseId}`,
  });
}

/** Send a course-completion notification. */
export async function sendCourseCompletion(
  userId: string,
  courseName: string,
  score: number
): Promise<void> {
  await sendNotification({
    userId,
    type: "course_completed",
    title: `Completed ${courseName}`,
    body: `You finished ${courseName} with a final score of ${score}%. ${
      score >= 75 ? "Your credential is being prepared." : "Keep pushing — review the material and retake when ready."
    }`,
    link: `/app`,
  });
}

/** Send a credential-earned notification with the verify URL. */
export async function sendCredentialEarned(
  userId: string,
  courseName: string,
  credentialId: string
): Promise<void> {
  const verifyUrl = `/verify/${credentialId}`;
  await sendNotification({
    userId,
    type: "credential_earned",
    title: `Credential earned — ${courseName}`,
    body: `Your verified digital credential for ${courseName} is ready. Share the verify link with employers: ${verifyUrl}`,
    link: verifyUrl,
  });
}

/** Send a milestone-earned notification. */
export async function sendMilestoneEarned(
  userId: string,
  milestoneTitle: string,
  courseId?: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "milestone_earned",
    title: `Milestone reached — ${milestoneTitle}`,
    body: `You unlocked a new milestone: ${milestoneTitle}. Keep the momentum going.`,
    link: courseId ? `/app?course=${courseId}` : `/app`,
  });
}

/** Send a message-received notification (from an instructor / mentor). */
export async function sendMessageReceived(
  userId: string,
  fromName: string,
  preview: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "message_received",
    title: `New message from ${fromName}`,
    body: preview.length > 180 ? preview.slice(0, 177) + "..." : preview,
    link: `/app?view=messages`,
  });
}

// ============================================================
// Optional webhook dispatch — only fires if EMAIL_WEBHOOK_URL is set.
// The webhook payload is the full SendNotificationInput + user lookup.
// ============================================================

async function maybeDispatchEmailWebhook(input: SendNotificationInput): Promise<void> {
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  if (!webhookUrl) return; // not configured — notifications stay in-app only

  // Look up the user's email (best-effort — never throws on missing webhook).
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true },
  });
  if (!user) return;

  // Never dispatch external email for demo accounts (@demo.ai) — their
  // addresses are fake and the webhook would send real mail to nowhere.
  if (user.email.toLowerCase().endsWith("@demo.ai")) return;

  const payload = {
    to: user.email,
    recipientName: user.name,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
