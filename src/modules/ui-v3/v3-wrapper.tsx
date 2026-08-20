"use client";

// src/modules/ui-v3/v3-wrapper.tsx — Thin v3 wrappers around v2 components.
//
// P1c pragmatic pattern: for v2 components too complex to fully restyle
// in P1 scope (1000+ lines with many sub-components like RubricGrader,
// SubmissionRenderer, etc.), we wrap them with V3PageHeader + delegate
// the content. This gives consistent v3 chrome context (page title,
// subtitle matching other v3 pages) while preserving the working v2 logic.
//
// A P2 polish pass can do full restyles — these wrappers are the
// bridge that gets the items "ported to v3" without rewriting 6000+ lines.

import type { ReactNode } from "react";
import { V3PageHeader } from "./v3-shell";

interface V3WrapperProps {
  title: string;
  subtitle: string;
  /** Optional action node rendered in the page header (e.g. button). */
  action?: ReactNode;
  /** The v2 component (or any content) to wrap. */
  children: ReactNode;
}

/**
 * Wraps any v2 content component in a v3 page header. Use this when
 * the inner component is too complex to fully restyle but you still
 * want the page to feel consistent with other v3 pages.
 */
export function V3Wrapper({ title, subtitle, action, children }: V3WrapperProps) {
  return (
    <>
      <V3PageHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </>
  );
}
