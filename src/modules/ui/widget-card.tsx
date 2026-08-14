"use client";
// src/components/shared/widget-card.tsx — Star Admin-style widget panel.
// The standard container for dashboard widgets: title bar + optional
// dropdown menu + padded body. Built on .surface-card so every widget
// stays theme-token driven (presets + light/dark work automatically).

import { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/dropdown-menu";

export interface WidgetMenuItem {
  label: string;
  onSelect: () => void;
}

interface WidgetCardProps {
  /** Panel heading (rendered with .widget-title). */
  title: string;
  /** One-line context under the heading. */
  subtitle?: string;
  /** "..." dropdown menu items (Star Admin pattern). */
  menu?: WidgetMenuItem[];
  /** Arbitrary right-side actions — use instead of `menu` for buttons/links. */
  actions?: ReactNode;
  children: ReactNode;
  /** Extra classes on the outer card. */
  className?: string;
  /** Extra classes on the body wrapper. */
  bodyClassName?: string;
  /** Edge-to-edge body (for tables/lists that manage their own padding). */
  flush?: boolean;
}

/**
 * Standard widget panel for dashboards. One primary heading, an optional
 * "..." menu, and a consistent padded body.
 */
export function WidgetCard({
  title,
  subtitle,
  menu,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: WidgetCardProps) {
  return (
    <section className={cn("surface-card", className)}>
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="widget-title truncate">{title}</h3>
          {subtitle && <p className="widget-subtitle truncate">{subtitle}</p>}
        </div>
        {actions}
        {!actions && menu && menu.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${title} widget actions`}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menu.map((item) => (
                <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className={cn(!flush && "px-4 pb-4 pt-3", flush && "pt-3", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
