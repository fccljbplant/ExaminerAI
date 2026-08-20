"use client";

// src/modules/ui-v3/v3-shell.tsx — Dark sidebar + topbar shell for v3 UI.
// Wired to the v2 theme engine (UnifiedThemeToggle) and v2 user chrome
// (UserMenu) instead of reinventing them.
//
// Usage from layouts:
//   <V3Shell navGroups={NAV} userName={...} userInitials={...}
//            profileHref="/learner/profile" helpHref="/learner/help"
//            settingsHref="/learner/profile">
//     {children}
//   </V3Shell>

import type { ReactNode, CSSProperties } from "react";
import type { HTMLAttributes } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UnifiedThemeToggle, UserMenu } from "@/modules/shell";
import "./v3-shell.css";

export interface V3NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

export interface V3NavGroup {
  label: string;
  items: V3NavItem[];
}

interface V3ShellProps {
  children: ReactNode;
  navGroups: V3NavGroup[];
  userName: string;
  userInitials: string;
  /** Role-correct profile route (e.g. "/learner/profile", "/instructor"). */
  profileHref: string;
  /** Role-correct profile label (e.g. "Profile" for learner, "Dashboard" for instructor). */
  profileLabel?: string;
  /** Role-correct help route (e.g. "/learner/help", "/instructor/help"). */
  helpHref: string;
  /** Role-correct settings route. When omitted, "Settings" is hidden in the user menu. */
  settingsHref?: string;
  /** When true, the content area renders full-bleed (no padding, no max-width).
   *  Used by the classroom view which is a 3-column full-viewport layout. */
  fullBleed?: boolean;
}

export function V3Shell({
  children,
  navGroups,
  userName,
  userInitials: _userInitials,
  profileHref,
  profileLabel,
  helpHref,
  settingsHref,
  fullBleed,
}: V3ShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="v3-app">
      {/* Sidebar */}
      <aside className={`v3-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="v3-brand">
          <div className="v3-brand-icon">E</div>
          <div>
            <h2>Examiner AI</h2>
            <small>Learning Platform</small>
          </div>
        </div>

        <nav className="v3-nav" aria-label="Primary">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="v3-nav-label">{group.label}</div>
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`v3-nav-item ${active ? "active" : ""}`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <span className="v3-nav-icon" aria-hidden>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="v3-sidebar-bottom">
          <Link href={helpHref} className="v3-nav-item">
            <span className="v3-nav-icon" aria-hidden>?</span> Help &amp; Support
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="v3-overlay"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}

      {/* Main */}
      <main className="v3-main">
        <header className="v3-topbar">
          <button
            type="button"
            className="v3-menu-btn"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileNavOpen}
            aria-controls="v3-sidebar"
          >
            ☰
          </button>
          <div className="v3-search" role="search">
            <span aria-hidden>🔍</span>
            <span className="v3-search-text">Search courses, lessons, assessments…</span>
          </div>
          <div className="v3-top-actions">
            {/* v2 theme switcher (8 themes) — fully functional, plugged in here */}
            <UnifiedThemeToggle />
            {/* v2 user menu (avatar → dropdown: profile, help, settings, theme, sign out) */}
            <UserMenu
              userName={userName}
              profileHref={profileHref}
              profileLabel={profileLabel}
              helpHref={helpHref}
              settingsHref={settingsHref}
            />
          </div>
        </header>

        <div className={fullBleed ? "v3-content-fullbleed" : "v3-content"}>
          {children}
        </div>

        {/* Mobile bottom nav — shows top 5 items at <850px (where the
            sidebar is hidden). Drawer (☰) is still available for the
            full nav; this gives one-tap access to the most-used items
            without opening the drawer. Audit §C.1. */}
        {!fullBleed && (
          <MobileBottomNav navGroups={navGroups} pathname={pathname} />
        )}
      </main>
    </div>
  );
}

/* ---------- Mobile bottom nav (visible only at <850px) ---------- */

function MobileBottomNav({
  navGroups,
  pathname,
}: {
  navGroups: V3NavGroup[];
  pathname: string;
}) {
  // Take top 5 items across all groups (priority by group order).
  const allItems = navGroups.flatMap((g) => g.items);
  const items = allItems.slice(0, 5);

  return (
    <nav className="v3-bottom-nav" aria-label="Mobile primary">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`v3-bottom-nav-item ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="v3-bottom-nav-icon" aria-hidden>{item.icon}</span>
            <span className="v3-bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Reusable v3 components — exported for use inside page content
export function V3Card({ children, className = "", style, role }: { children: ReactNode; className?: string; style?: CSSProperties; role?: HTMLAttributes<HTMLDivElement>["role"] }) {
  return <div className={`v3-card ${className}`} style={style} role={role}>{children}</div>;
}

export function V3StatCard({ title, value, label }: { title: string; value: string; label: string }) {
  return (
    <div className="v3-card">
      <h3>{title}</h3>
      <div className="v3-stat-number">{value}</div>
      <div className="v3-stat-label">{label}</div>
    </div>
  );
}

export function V3Badge({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "success" | "warning" }) {
  return <span className={`v3-badge v3-badge-${variant}`}>{children}</span>;
}

export function V3Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="v3-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function V3PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="v3-page-header">
      <div className="v3-page-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function V3SectionTitle({ title, linkHref, linkLabel }: { title: string; linkHref?: string; linkLabel?: string }) {
  return (
    <div className="v3-section-title">
      <h2>{title}</h2>
      {linkHref && linkLabel && (
        <Link href={linkHref} className="v3-section-link">{linkLabel}</Link>
      )}
    </div>
  );
}

