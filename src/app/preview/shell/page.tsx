import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShellPreview } from "./shell-preview";

/**
 * /preview/shell — dev-only dummy page for the adaptive shell
 * (REDESIGN-P5 W0 exit criteria: shell renders at all 4 breakpoints).
 * Returns 404 in production builds.
 */

export const metadata: Metadata = {
  title: "Shell preview (dev)",
  robots: { index: false, follow: false },
};

export default function ShellPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ShellPreview />;
}
