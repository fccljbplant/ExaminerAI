import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — PageHeader v2 (REDESIGN-P2 §1.4, §5 density law)
 *
 * 56px on mobile / 64px on md+ — replaces the 96px legacy header.
 * Anatomy: [back] breadcrumbs / title + subtitle ......... [actions]
 * Named *V2 until cutover deletes the legacy PageHeader.tsx.
 */

export interface PageBreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderV2Props {
  title: string;
  subtitle?: string;
  /** Shown above the title as a compact trail (max 2 on xs). */
  breadcrumbs?: PageBreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeaderV2({
  title,
  subtitle,
  breadcrumbs,
  backHref,
  backLabel = "Back",
  actions,
  className,
}: PageHeaderV2Props) {
  return (
    <header
      data-slot="page-header-v2"
      className={cn("flex min-h-14 items-center gap-3 md:min-h-16", className)}
    >
      {backHref && (
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-fg"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-0.5 flex items-center gap-0.5 text-xs text-fg-muted">
            {breadcrumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-0.5">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
                {crumb.href ? (
                  <Link href={crumb.href} className="truncate hover:text-fg">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-lg font-semibold leading-tight text-fg md:text-xl">{title}</h1>
        {subtitle && <p className="truncate text-xs text-fg-muted md:text-sm">{subtitle}</p>}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
