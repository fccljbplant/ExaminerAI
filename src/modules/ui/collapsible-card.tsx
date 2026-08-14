"use client";

/**
 * CollapsibleCard — a Card with a built-in show/hide toggle.
 *
 * Every dashboard card that displays data should use this so the user has
 * consistent control over what's expanded vs collapsed across the app.
 *
 * Features:
 * - Click the header to toggle expand/collapse
 * - Chevron icon rotates to indicate state
 * - Optional `defaultOpen` prop (default: true)
 * - Optional `badge` prop (shown next to the title — e.g., "3 pending")
 * - Optional `action` prop (a ReactNode rendered on the right — e.g., a Refresh button)
 * - Persists expand/collapse state to localStorage so the user's preference
 *   is remembered across page reloads
 * - Accessible: header is a <button>, aria-expanded reflects state
 *
 * Usage:
 *   <CollapsibleCard title="Today's Tasks" badge="3 pending" action={<RefreshButton />}>
 *     <TaskList />
 *   </CollapsibleCard>
 */

import { useState, useEffect, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Badge } from "@/modules/ui/badge";
import { Button } from "@/modules/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleCardProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Unique key for localStorage persistence. If omitted, state is session-only. */
  storageKey?: string;
  className?: string;
}

export function CollapsibleCard({
  title,
  description,
  icon: Icon,
  badge,
  badgeVariant = "secondary",
  action,
  children,
  defaultOpen = true,
  storageKey,
  className,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Load persisted state on mount
  useEffect(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`collapsible-card:${storageKey}`);
        if (saved !== null) {
          setIsOpen(saved === "true");
        }
      } catch {
        // localStorage unavailable (SSR / privacy mode) — ignore
      }
    }
  }, [storageKey]);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (storageKey) {
      try {
        localStorage.setItem(`collapsible-card:${storageKey}`, String(next));
      } catch {
        // ignore
      }
    }
  };

  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={toggle}
            className="flex items-center gap-2 text-left flex-1 min-w-0 group"
            aria-expanded={isOpen}
            aria-controls={`collapsible-content-${storageKey || title}`}
          >
            {Icon && (
              <Icon className="h-4 w-4 text-primary flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2 group-hover:text-primary transition-colors">
                <span className="truncate">{title}</span>
                {badge && (
                  <Badge variant={badgeVariant} className="text-[9px] flex-shrink-0">
                    {badge}
                  </Badge>
                )}
              </CardTitle>
              {description && (
                <CardDescription className="text-xs text-muted-foreground truncate">
                  {description}
                </CardDescription>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                isOpen ? "rotate-180" : "rotate-0",
                "group-hover:text-foreground"
              )}
            />
          </button>
          {action && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {action}
            </div>
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent
          id={`collapsible-content-${storageKey || title}`}
          className="pt-0 transition-all duration-200"
        >
          {children}
        </CardContent>
      )}
    </Card>
  );
}

/** Convenience wrapper for a refresh button action. */
export function CardRefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      onClick={onClick}
      disabled={loading}
      title="Refresh"
      aria-label="Refresh"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
    </Button>
  );
}

// Re-import RefreshCw here to avoid a separate import block at the top
import { RefreshCw } from "lucide-react";
