import Link from "next/link";
import { GraduationCap, ShieldCheck } from "lucide-react";

/**
 * modules/site — SiteFooter (2026-08-15 storefront chrome pass)
 *
 * The public site had NO footer. One footer now closes every storefront
 * page with real internal links only (no fake/dead destinations) and a
 * token-only theme so it follows Light / Dark / Bed / Classic.
 */

const LEARN_LINKS = [
  { href: "/courses", label: "All Courses" },
  { href: "/paths", label: "Learning Paths" },
  { href: "/for-learners", label: "For Learners" },
  { href: "/pricing", label: "Pricing" },
] as const;

const COMPANY_LINKS = [
  { href: "/for-business", label: "For Business" },
  { href: "/register", label: "Create an account" },
] as const;

const RESOURCE_LINKS = [
  { href: "/support", label: "Help Center" },
  { href: "/support", label: "Contact Support" },
  { href: "/verify", label: "Verify a certificate" },
  { href: "/login", label: "Sign In" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        {/* Brand */}
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-fg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-on-brand">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </span>
            TraineesAI
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-fg-muted">
            AI teaches. AI tests. Human mentors. We share the training burden — your experts keep
            their time, your trainees keep their humans.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
            Verified skill credentials on every certificate
          </p>
        </div>

        {/* Learn */}
        <nav aria-label="Learn">
          <h2 className="text-sm font-semibold text-fg">Learn</h2>
          <ul className="mt-3 space-y-1">
            {LEARN_LINKS.map((l) => (
              <li key={l.href + l.label}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-9 items-center rounded-md text-sm text-fg-muted transition-colors hover:text-fg"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Company */}
        <nav aria-label="Company">
          <h2 className="text-sm font-semibold text-fg">Company</h2>
          <ul className="mt-3 space-y-1">
            {COMPANY_LINKS.map((l) => (
              <li key={l.href + l.label}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-9 items-center rounded-md text-sm text-fg-muted transition-colors hover:text-fg"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Resources */}
        <nav aria-label="Resources">
          <h2 className="text-sm font-semibold text-fg">Resources</h2>
          <ul className="mt-3 space-y-1">
            {RESOURCE_LINKS.map((l) => (
              <li key={l.href + l.label}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-9 items-center rounded-md text-sm text-fg-muted transition-colors hover:text-fg"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 Inzet Enterprises · TraineesAI. All rights reserved.</p>
          <p>AI-driven training · Project-based learning · Verified credentials</p>
        </div>
      </div>
    </footer>
  );
}
