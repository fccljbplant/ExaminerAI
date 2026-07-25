/**
 * audit-log — Phase RBAC+AUDIT Phase 4.
 * Universal append-only audit log. Best-effort, never throws/blocks.
 * NEVER store sensitive crisis content in beforeJson/afterJson.
 */

import { db } from "./db";
import { logger } from "./logger";
import type { NextRequest } from "next/server";

export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

export interface AuditTarget {
  type: string;
  id: string;
}

export interface LogAuditParams {
  actor: AuditActor;
  action: string;
  target?: AuditTarget | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  req?: NextRequest | null;
}

export const AuditAction = {
  ROLE_ASSIGNED: "role_assigned",
  USER_APPROVED: "user_approved",
  USER_BLOCKED: "user_blocked",
  USER_DELETED: "user_deleted",
  USER_CREATED: "user_created",
  ACCESS_GRANT_CREATED: "access_grant_created",
  ACCESS_GRANT_REVOKED: "access_grant_revoked",
  GRADE_CHANGED: "grade_changed",
  RETAKE_ALLOWED: "retake_allowed",
  TEST_UNLOCKED: "test_unlocked",
  COURSE_CONTENT_EDITED: "course_content_edited",
  COURSE_CREATED: "course_created",
  COURSE_DELETED: "course_deleted",
  ESCALATION_CONFIG_CHANGED: "escalation_config_changed",
  FEATURE_FLAG_TOGGLED: "feature_flag_toggled",
  CRISIS_FLAG_VIEWED: "crisis_flag_viewed",
  WELLBEING_ALERT_VIEWED: "wellbeing_alert_viewed",
} as const;

export async function logAudit(params: LogAuditParams): Promise<void> {
  const { actor, action, target, before, after, metadata, req } = params;
  let ipAddress: string | null = null;
  if (req) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) ipAddress = xff.split(",")[0]?.trim() || null;
    else ipAddress = req.headers.get("x-real-ip");
  }
  try {
    await db.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action,
        targetType: target?.type ?? "system",
        targetId: target?.id ?? "system",
        beforeJson: before ? JSON.stringify(before) : null,
        afterJson: after ? JSON.stringify(after) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress,
      },
    });
  } catch (err) {
    logger.error("Audit log write failed", {
      action, actorId: actor.id, targetType: target?.type, targetId: target?.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function logAuditAsync(params: LogAuditParams): void {
  void logAudit(params);
}
