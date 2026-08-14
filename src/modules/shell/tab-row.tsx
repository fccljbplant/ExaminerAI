"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveActiveItem, type NavItem } from "./types";

/**
 * modules/shell — TabRow (md, 768–1023)
 * Secondary navigation under the app bar: horizontally scrollable
 * underline tabs. Active underline uses the --tab-active token.
 */

export function TabRow({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname();
  // Single active tab: longest matching prefix wins.
  const activeId = resolveActiveItem(pathname, items)?.id;
  return (
    <div
      data-slot="tab-row"
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-nav-border bg-nav-bg px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex h-11 min-w-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors",
              active
                ? "border-tab-active font-medium text-fg"
                : "border-transparent text-fg-secondary hover:text-fg"
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            <span className="whitespace-nowrap">{item.label}</span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold tabular-nums text-on-brand">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
