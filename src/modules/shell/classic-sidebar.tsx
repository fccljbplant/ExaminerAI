"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveActiveItem, type NavItem, type ShellBrand } from "./types";

/**
 * modules/shell — ClassicSidebar (W14: Star Admin 2 Pro vertical theme)
 *
 * The classic desktop chrome: a fixed 220px left rail (Star Admin
 * vertical-default-light) with the brand on top and the portal nav
 * stacked below. Only rendered when the theme engine resolves
 * `classic` mode AND the viewport is lg/xl — mobile keeps the app
 * bar + bottom nav so the old UI stays fully intact everywhere else.
 */

export function ClassicSidebar({
  nav,
  brand,
  className,
}: {
  nav: NavItem[];
  brand?: ShellBrand;
  className?: string;
}) {
  const pathname = usePathname();
  const activeId = resolveActiveItem(pathname, nav)?.id;

  return (
    <aside
      data-slot="classic-sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-[var(--p-z-sticky)] flex w-[220px] flex-col border-r border-line bg-surface",
        className
      )}
      aria-label="Primary sidebar"
    >
      {/* brand */}
      <div className="flex h-16 flex-shrink-0 items-center gap-2 border-b border-line px-5">
        {brand?.logo && <span className="flex h-8 items-center">{brand.logo}</span>}
        <Link
          href={brand?.href ?? "/"}
          className="min-w-0 truncate text-base font-bold tracking-tight text-fg"
        >
          {brand?.name ?? "TraineesAI"}
        </Link>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    "[-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                    active
                      ? "bg-brand-subtle text-brand"
                      : "text-fg-secondary hover:bg-bg-subtle hover:text-fg"
                  )}
                >
                  {Icon && <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />}
                  <span className="truncate">{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="ml-auto rounded-full bg-brand px-1.5 text-[10px] font-semibold tabular-nums text-on-brand">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* footer strip — keeps the rail visually anchored */}
      <div className="flex-shrink-0 border-t border-line px-5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">
          TraineesAI · Classic
        </p>
      </div>
    </aside>
  );
}
