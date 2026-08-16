import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/shell — AppFooter (2026-08-15)
 *
 * The in-app footer every portal page closes with — the logged-in
 * counterpart of the public site footer. Slim by design: brand line,
 * three useful links, copyright. Token-only so it follows every theme
 * mode, and it clears the fixed bottom nav on phones.
 */

const FOOTER_LINKS = [
  { href: "/courses", label: "Browse courses" },
  { href: "/support", label: "Help center" },
  { href: "/verify", label: "Verify a certificate" },
] as const;

export function AppFooter({
  classic,
  withBottomNav,
}: {
  /** classic mode shifts content right of the fixed sidebar */
  classic?: boolean;
  /** xs reserves clearance for the fixed bottom nav */
  withBottomNav?: boolean;
}) {
  return (
    <footer className="border-t border-nav-border bg-bg">
      <div
        className={cn(
          "mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6 lg:px-8",
          classic && "lg:max-w-none lg:pl-[244px] lg:pr-8",
          withBottomNav && "pb-[calc(3.5rem_+_env(safe-area-inset-bottom)_+_1.5rem)]",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-on-brand">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-xs text-fg-muted">
              <span className="font-semibold text-fg">TraineesAI</span> · AI teaches. AI tests.
              Human mentors.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="min-h-9 text-xs text-fg-muted transition-colors hover:text-fg inline-flex items-center"
              >
                {l.label}
              </Link>
            ))}
            <span className="text-xs text-fg-muted/70">
              © 2026 Inzet Enterprises · TraineesAI
            </span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
