import type { ReactNode } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { UnifiedThemeToggle } from "@/modules/shell";
import { cn } from "@/lib/utils";

/**
 * modules/auth — AuthLayout (REDESIGN-P2 §module catalog: auth)
 *
 * Shared chrome for login / register / reset routes: single content
 * column on xs, generous safe padding, mode toggle in the corner.
 * Marketing panels belong to the public site (P7), not here.
 */

export function AuthLayout({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-on-brand">
            <GraduationCap className="h-4.5 w-4.5" aria-hidden />
          </span>
          TraineesAI
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/courses"
            className="hidden rounded-lg px-2 text-sm text-fg-secondary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus min-h-11 items-center sm:inline-flex"
          >
            Browse courses
          </Link>
          <UnifiedThemeToggle />
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-[calc(2rem_+_env(safe-area-inset-bottom))] pt-6",
          className
        )}
      >
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="text-sm text-fg-secondary">{description}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
