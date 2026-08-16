"use client";

import type { ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./drawer";
import { cn } from "@/lib/utils";

/**
 * modules/ui — BottomSheet (REDESIGN-P2 §1.4)
 *
 * Mobile-default surface for filters, secondary flows and confirmations
 * (dialogs are desktop-only). Built on the vaul Drawer primitive with a
 * grab handle, safe-area bottom padding and a scrollable body.
 */

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Sticky footer slot (primary action lives here). */
  footer?: ReactNode;
  /** vaul snap points, e.g. ["240px", 0.85] — must end at 1 or max height. */
  snapPoints?: (number | string)[];
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  snapPoints,
  className,
}: BottomSheetProps) {
  const content = (
    <DrawerContent
      className={cn(
        "max-h-[85dvh] rounded-t-2xl border-t border-line bg-surface-overlay",
        className
      )}
    >
      <DrawerHeader className="border-b border-line">
        <DrawerTitle className="text-base font-semibold text-fg">{title}</DrawerTitle>
        {description && (
          <DrawerDescription className="text-fg-muted">{description}</DrawerDescription>
        )}
      </DrawerHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {footer && (
        <div className="border-t border-line p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </DrawerContent>
  );

  // vaul types snapPoints as a required (non-optional) prop, so branch
  // instead of passing undefined.
  if (snapPoints) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} snapPoints={snapPoints}>
        {content}
      </Drawer>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>{content}</Drawer>
  );
}
