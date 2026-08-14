import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — PermissionDenied (REDESIGN-P2 §1.4)
 *
 * The fourth mandatory data state (loading / empty / error / denied).
 * Rendered by route guards and inline where a section is role-gated.
 * Never blame the user; tell them who can help.
 */

export interface PermissionDeniedProps {
  title?: string;
  message?: string;
  /** e.g. "Instructor" — shown as a requirement chip when provided. */
  requiredRole?: string;
  action?: ReactNode;
  className?: string;
}

export function PermissionDenied({
  title = "You don't have access to this area",
  message = "Your current role can't view this. Ask your organization admin if you think this is a mistake.",
  requiredRole,
  action,
  className,
}: PermissionDeniedProps) {
  return (
    <div
      data-slot="permission-denied"
      role="status"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-fg-muted">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="text-sm text-fg-secondary">{message}</p>
      </div>
      {requiredRole && (
        <p className="rounded-full bg-bg-subtle px-3 py-1 text-xs font-medium text-fg-secondary">
          Requires: {requiredRole}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
