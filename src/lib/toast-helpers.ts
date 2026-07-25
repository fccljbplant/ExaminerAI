"use client";

/**
 * toast-helpers — simple wrappers around the toast() function for common patterns.
 *
 * Usage:
 *   import { showError, showSuccess } from "@/lib/toast-helpers";
 *   showError("Failed to save");                    // red error toast
 *   showSuccess("Saved!");                           // green success toast
 *   showError(e instanceof Error ? e.message : "Failed");
 */

import { toast } from "@/hooks/use-toast";

export function showError(message: string): void {
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
}

export function showSuccess(message: string): void {
  toast({
    title: "Success",
    description: message,
  });
}

export function showInfo(message: string): void {
  toast({
    description: message,
  });
}
