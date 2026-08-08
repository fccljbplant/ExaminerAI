"use client";
// src/components/shared/dashboard-shell.tsx
// The standard layout wrapper for every role dashboard.
//
// RULES (enforced by design, documented in docs/UI-STANDARDS.md):
//   - Every dashboard mounts a DashboardHeader at the top (sticky, 96px).
//   - Content lives in a max-w-7xl column with consistent vertical rhythm.
//   - Loading + error states use the states kit (no bespoke spinners).
//
// This wrapper keeps every dashboard visually consistent so a learner
// moving to a mentor role (or an admin switching hats) sees the same
// spine, the same spacing, the same empty/loading/error treatment.

import { ReactNode } from "react";
import PageHeader, { type Crumb } from "@/components/ui/PageHeader";
import { SkeletonPanel, ErrorState } from "@/components/ui/states";

export interface DashboardHeaderProps {
  crumbs?: Crumb[];
  title: string;
  subtitle?: string;
  chips?: ReactNode;
  progress?: number;
  actions?: ReactNode;
}

/** The standard 96px sticky dashboard header. Wraps PageHeader so every
 *  dashboard gets breadcrumbs + chips + actions for free. */
export function DashboardHeader(props: DashboardHeaderProps) {
  return <PageHeader {...props} />;
}

interface DashboardShellProps {
  header?: ReactNode;
  children: ReactNode;
  /** Optional className for the inner content column. */
  className?: string;
  /** When true, removes the max-w-7xl constraint (full-bleed). */
  fullWidth?: boolean;
}

/** The standard dashboard layout: sticky header + content column. */
export function DashboardShell({
  header,
  children,
  className = "",
  fullWidth = false,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen">
      {header}
      <div
        className={
          (fullWidth ? "mx-auto px-4 sm:px-6" : "mx-auto max-w-7xl px-4 sm:px-6") +
          " py-6 " +
          className
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Standard loading state for any dashboard. */
export function DashboardLoading({ lines = 4 }: { lines?: number }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
      <SkeletonPanel lines={1} className="h-16" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonPanel key={i} lines={2} className="h-24" />
        ))}
      </div>
      <SkeletonPanel lines={lines} />
    </div>
  );
}

/** Standard error state for any dashboard. */
export function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      <ErrorState message={message} onRetry={onRetry} />
    </div>
  );
}
