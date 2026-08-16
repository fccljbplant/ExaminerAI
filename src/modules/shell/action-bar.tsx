import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * modules/shell — ActionBar (brief §forms)
 *
 * Sticky bottom action bar for form pages. On xs it sticks ABOVE the
 * fixed BottomNav (56px + safe inset) so primary actions are never
 * covered; at md+ it stays pinned to the viewport bottom of the
 * content column. Pages render their primary action last (right-most).
 */

export function ActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="action-bar"
      className={cn(
        "sticky bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-[var(--p-z-raised)] flex items-center justify-end gap-2 border-t border-line bg-surface p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] md:bottom-0 md:pb-3",
        className
      )}
    >
      {children}
    </div>
  );
}
