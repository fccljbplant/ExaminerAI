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

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UnifiedThemeToggle, UserMenu } from "@/modules/shell";

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
      {/* V3 CSS — injected once */}
      <V3Styles />

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
      </main>
    </div>
  );
}

// Reusable v3 components — exported for use inside page content
export function V3Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`v3-card ${className}`}>{children}</div>;
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

// CSS — all v3 styles injected once. Resolves through v2 semantic tokens
// so theme switching (light/dark/bed/classic/zinc/ocean/forest/sunset)
// actually affects v3 chrome.
function V3Styles() {
  if (typeof document !== "undefined") {
    const existing = document.getElementById("v3-css");
    if (!existing) {
      const s = document.createElement("style");
      s.id = "v3-css";
      s.textContent = V3_CSS_TEXT;
      document.head.appendChild(s);
    }
  }
  return null;
}

export const V3_CSS_TEXT = `
:root {
  --v3-radius: var(--radius-lg);
  --v3-sidebar-w: 250px;
  --v3-topbar-h: 64px;
}

.v3-app {
  min-height: 100vh;
  display: grid;
  grid-template-columns: var(--v3-sidebar-w) 1fr;
  font-family: var(--font-sans), Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
}

/* ---- Sidebar (dark navy — brand-independent; uses semantic surface tokens) ---- */
.v3-sidebar {
  background: var(--surface-raised);
  padding: var(--p-space-6) var(--p-space-3);
  color: var(--text-inverse);
  display: flex;
  flex-direction: column;
  position: fixed;
  width: var(--v3-sidebar-w);
  height: 100vh;
  overflow-y: auto;
  z-index: var(--p-z-sticky);
  /* Dark navy identity for the rail itself — independent of light/dark theme
     so the sidebar always reads as a navigation surface, not as content. */
  background-image: linear-gradient(180deg, color-mix(in oklch, var(--surface-raised) 92%, #000 8%), var(--surface-raised));
}
@media (color-scheme: light) {
  .v3-sidebar {
    /* Light theme: sidebar is a darker surface than --surface-raised for visual hierarchy. */
    background: var(--text);
    color: var(--bg);
  }
}
.v3-brand { display: flex; align-items: center; gap: var(--p-space-3); padding: var(--p-space-1) var(--p-space-3) var(--p-space-7); }
.v3-brand-icon {
  width: 38px; height: 38px;
  border-radius: var(--radius-md);
  background: var(--brand);
  color: var(--on-brand);
  display: grid; place-items: center;
  font-weight: 800;
}
.v3-brand h2 { font-size: var(--p-type-lg); color: inherit; margin: 0; }
.v3-brand small { color: var(--text-muted); font-size: var(--p-type-xs); }
.v3-nav-label {
  color: var(--text-muted);
  font-size: var(--p-type-xs);
  letter-spacing: 1.1px;
  font-weight: 700;
  padding: var(--p-space-5) var(--p-space-3) var(--p-space-2);
  text-transform: uppercase;
}
.v3-nav-item {
  width: 100%;
  background: transparent;
  color: var(--text-muted);
  text-align: left;
  padding: var(--p-space-3) var(--p-space-3);
  border-radius: var(--radius-md);
  margin: 2px 0;
  display: flex;
  align-items: center;
  gap: var(--p-space-3);
  transition: background var(--p-dur-fast) var(--ease-standard), color var(--p-dur-fast) var(--ease-standard);
  text-decoration: none;
  font-size: var(--p-type-md);
  cursor: pointer;
  min-height: 44px;
}
.v3-nav-item:hover, .v3-nav-item.active {
  background: color-mix(in oklch, var(--bg) 12%, transparent);
  color: var(--text-inverse);
}
.v3-nav-item.active {
  box-shadow: inset 3px 0 0 var(--brand);
}
.v3-nav-item:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.v3-nav-icon { width: 22px; text-align: center; flex-shrink: 0; }
.v3-sidebar-bottom { margin-top: auto; }

/* ---- Main ---- */
.v3-main { grid-column: 2; min-width: 0; }
.v3-topbar {
  height: var(--v3-topbar-h);
  background: color-mix(in oklch, var(--surface) 90%, transparent);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--p-space-7);
  position: sticky;
  top: 0;
  z-index: var(--p-z-sticky);
  backdrop-filter: blur(10px);
  gap: var(--p-space-5);
}
.v3-search {
  width: min(420px, 45vw);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--p-space-2) var(--p-space-3);
  color: var(--text-muted);
  font-size: var(--p-type-md);
  display: flex;
  align-items: center;
  gap: var(--p-space-2);
}
.v3-search-text { color: var(--text-muted); }
.v3-top-actions { display: flex; align-items: center; gap: var(--p-space-3); }
.v3-content { padding: var(--p-space-7); max-width: 1550px; margin: auto; }
.v3-content-fullbleed { padding: 0; max-width: none; margin: 0; }
.v3-menu-btn { display: none; background: transparent; border: 0; font-size: 22px; cursor: pointer; color: var(--text); min-width: 44px; min-height: 44px; }
.v3-menu-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.v3-overlay { display: none; }

/* ---- Components ---- */
.v3-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--p-space-7); gap: var(--p-space-5); flex-wrap: wrap; }
.v3-page-title h1 { font-size: var(--p-type-3xl); letter-spacing: -.5px; margin: 0; color: var(--text); }
.v3-page-title p { color: var(--text-muted); margin-top: var(--p-space-2); font-size: var(--p-type-md); }

.v3-btn {
  padding: var(--p-space-3) var(--p-space-4);
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 600;
  transition: transform var(--p-dur-fast) var(--ease-standard), background var(--p-dur-fast) var(--ease-standard);
  cursor: pointer;
  font-size: var(--p-type-md);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--p-space-2);
  min-height: 44px;
}
.v3-btn:hover { transform: translateY(-1px); background: var(--bg-subtle); }
.v3-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.v3-btn-primary { background: var(--brand); color: var(--on-brand); border-color: var(--brand); box-shadow: var(--shadow-elev-1); }
.v3-btn-primary:hover { background: var(--brand-hover); }
.v3-btn-success { background: var(--success); color: var(--success-on); border-color: var(--success); }

.v3-grid { display: grid; gap: var(--p-space-5); }
.v3-grid-4 { grid-template-columns: repeat(4, 1fr); }
.v3-grid-3 { grid-template-columns: repeat(3, 1fr); }
.v3-grid-2 { grid-template-columns: repeat(2, 1fr); }
.v3-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--v3-radius);
  padding: var(--p-space-5);
  box-shadow: var(--shadow-elev-1);
}
.v3-card h3 { font-size: var(--p-type-lg); margin: 0; color: var(--text); }
.v3-card p { color: var(--text-muted); font-size: var(--p-type-sm); margin-top: var(--p-space-2); }
.v3-stat-number { font-size: var(--p-type-3xl); font-weight: 750; margin-top: var(--p-space-4); color: var(--text); }
.v3-stat-label { color: var(--text-muted); font-size: var(--p-type-sm); margin-top: var(--p-space-1); }
.v3-progress {
  width: 100%; height: 8px;
  background: var(--bg-subtle);
  border-radius: 99px;
  overflow: hidden;
}
.v3-progress > span {
  height: 100%; display: block; border-radius: inherit;
  background: linear-gradient(90deg, var(--brand), var(--brand-active));
  transition: width var(--p-dur-med) var(--ease-standard);
}
.v3-section-title { display: flex; justify-content: space-between; align-items: center; margin: var(--p-space-7) 0 var(--p-space-4); }
.v3-section-title h2 { font-size: var(--p-type-xl); margin: 0; color: var(--text); }
.v3-section-link { color: var(--brand); font-size: var(--p-type-sm); font-weight: 600; cursor: pointer; text-decoration: none; }
.v3-section-link:hover { text-decoration: underline; }
.v3-section-link:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: var(--radius-xs); }

.v3-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 99px; font-size: var(--p-type-xs); font-weight: 700; }
.v3-badge-primary { background: var(--brand-subtle); color: var(--brand); }
.v3-badge-success { background: var(--success-subtle); color: var(--success-on); }
.v3-badge-warning { background: var(--warning-subtle); color: var(--warning-on); }

/* Continue learning hero card */
.v3-continue-card {
  background: radial-gradient(circle at 85% 15%, color-mix(in oklch, var(--brand) 30%, transparent), transparent 28%),
              linear-gradient(135deg, var(--text), var(--brand));
  color: var(--bg);
  padding: var(--p-space-7);
  min-height: 250px;
  position: relative;
  overflow: hidden;
  border: 0;
}
.v3-continue-card p { color: color-mix(in oklch, var(--bg) 75%, transparent); }
.v3-continue-card h2 { margin: var(--p-space-4) 0 var(--p-space-2); font-size: var(--p-type-2xl); color: var(--bg); }
.v3-continue-card .v3-progress { margin: var(--p-space-6) 0 var(--p-space-4); background: color-mix(in oklch, var(--bg) 20%, transparent); }
.v3-continue-card .v3-progress span { background: color-mix(in oklch, var(--bg) 85%, var(--brand) 15%); }
.v3-continue-card .v3-btn { background: var(--bg); color: var(--brand); border: 0; }

/* Course row */
.v3-course-row { display: flex; align-items: center; gap: var(--p-space-4); padding: var(--p-space-4) 0; border-bottom: 1px solid var(--border); }
.v3-course-row:last-child { border-bottom: 0; }
.v3-course-icon {
  width: 44px; height: 44px;
  border-radius: var(--radius-md);
  display: grid; place-items: center;
  background: var(--brand-subtle);
  color: var(--brand);
  flex-shrink: 0;
}
.v3-course-info { flex: 1; min-width: 0; }
.v3-course-info strong { display: block; font-size: var(--p-type-md); color: var(--text); }
.v3-course-info small { color: var(--text-muted); font-size: var(--p-type-sm); }

/* Today card */
.v3-today-card { min-height: 120px; }
.v3-today-icon {
  width: 40px; height: 40px;
  background: var(--brand-subtle);
  color: var(--brand);
  border-radius: var(--radius-md);
  display: grid; place-items: center;
  margin-bottom: var(--p-space-4);
}

/* Attention item */
.v3-attention-item { padding: var(--p-space-4) 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: var(--p-space-3); }
.v3-attention-item:last-child { border-bottom: 0; }

/* Table */
.v3-table-card { overflow-x: auto; padding: 0; }
.v3-table-card table { width: 100%; border-collapse: collapse; min-width: 650px; }
.v3-table-card th, .v3-table-card td { text-align: left; padding: var(--p-space-4) var(--p-space-5); border-bottom: 1px solid var(--border); font-size: var(--p-type-sm); color: var(--text); }
.v3-table-card th { color: var(--text-muted); font-size: var(--p-type-xs); text-transform: uppercase; letter-spacing: .5px; background: var(--bg-subtle); }

/* Class session card */
.v3-class-session {
  background: linear-gradient(135deg, var(--text), var(--brand));
  color: var(--bg);
  border: 0;
}
.v3-class-session p { color: color-mix(in oklch, var(--bg) 80%, var(--text) 20%); }
.v3-class-session h2, .v3-class-session h3 { color: var(--bg); }
.v3-class-session small { color: color-mix(in oklch, var(--bg) 70%, transparent); }
.v3-session-row { display: flex; align-items: center; justify-content: space-between; margin-top: var(--p-space-6); gap: var(--p-space-3); }

/* Courses catalog (full-bleed grid) */
.v3-catalog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--p-space-5); }
.v3-course-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--v3-radius);
  overflow: hidden;
  transition: transform var(--p-dur-fast) var(--ease-standard), box-shadow var(--p-dur-fast) var(--ease-standard), border-color var(--p-dur-fast) var(--ease-standard);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
}
.v3-course-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-elev-2); border-color: var(--border-strong); }
.v3-course-card:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.v3-course-thumb {
  aspect-ratio: 16/7;
  background: linear-gradient(135deg, var(--text), var(--brand));
  color: var(--bg);
  display: grid; place-items: center;
  font-size: 38px; font-weight: 700;
  position: relative;
}
.v3-course-thumb.green { background: linear-gradient(135deg, var(--success-on), var(--success)); }
.v3-course-thumb.amber { background: linear-gradient(135deg, var(--warning-on), var(--warning)); }
.v3-course-thumb.pink { background: linear-gradient(135deg, var(--danger-on), var(--danger)); }
.v3-course-thumb.blue { background: linear-gradient(135deg, var(--info-on), var(--info)); }
.v3-enrolled-pill {
  position: absolute; top: 12px; left: 12px;
  background: color-mix(in oklch, var(--bg) 92%, transparent);
  color: var(--brand);
  font-size: var(--p-type-xs);
  font-weight: 700;
  padding: 4px 9px;
  border-radius: 99px;
}
.v3-featured-pill {
  /* Featured tag uses warning token (amber) instead of brand. */
  color: var(--warning-on);
}
.v3-course-body { padding: var(--p-space-5); display: flex; flex-direction: column; gap: var(--p-space-2); flex: 1; }
.v3-course-body h3 { font-size: var(--p-type-lg); font-weight: 700; line-height: 1.35; color: var(--text); margin: 0; }
.v3-course-body .v3-course-sub { font-size: var(--p-type-sm); color: var(--text-muted); line-height: 1.5; flex: 1; }
.v3-course-meta { display: flex; gap: var(--p-space-2); flex-wrap: wrap; font-size: var(--p-type-xs); color: var(--text-muted); margin-top: auto; align-items: center; }
.v3-chip { background: var(--bg-subtle); border: 1px solid var(--border); padding: 3px 9px; border-radius: 99px; font-weight: 600; }

/* Filter row */
.v3-filter-row { display: flex; gap: var(--p-space-3); margin-bottom: var(--p-space-6); flex-wrap: wrap; align-items: center; }
.v3-input {
  height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 0 var(--p-space-4);
  font-size: var(--p-type-md);
  color: var(--text);
  min-width: 0;
}
.v3-input:focus { outline: 0; border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand) 18%, transparent); }
.v3-input.search { flex: 1; min-width: 220px; padding-left: 38px; }
.v3-search-wrap { position: relative; flex: 1; min-width: 220px; }
.v3-search-wrap > span { position: absolute; left: var(--p-space-4); top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: var(--p-type-md); pointer-events: none; }
.v3-chip-btn { padding: 8px 14px; border-radius: 99px; background: var(--surface); border: 1px solid var(--border); font-size: var(--p-type-sm); font-weight: 600; cursor: pointer; color: var(--text-muted); min-height: 36px; }
.v3-chip-btn.active { background: var(--brand); color: var(--on-brand); border-color: var(--brand); }
.v3-chip-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.v3-select { height: 44px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--surface); padding: 0 var(--p-space-3); font-size: var(--p-type-md); color: var(--text); }

/* Skeleton */
.v3-skeleton {
  background: linear-gradient(90deg, var(--bg-subtle) 25%, var(--border) 37%, var(--bg-subtle) 63%);
  background-size: 400% 100%;
  animation: v3-shimmer 1.4s ease infinite;
  border-radius: var(--v3-radius);
}
@keyframes v3-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
.v3-skeleton-card { height: 260px; }

/* Empty state */
.v3-empty { text-align: center; padding: var(--p-space-7) var(--p-space-5); border: 1px dashed var(--border); border-radius: var(--v3-radius); background: var(--surface); }
.v3-empty h3 { font-size: var(--p-type-lg); margin: 0 0 var(--p-space-2); color: var(--text); }
.v3-empty p { font-size: var(--p-type-sm); color: var(--text-muted); margin: 0; }

/* Classroom (3-column → responsive) */
.v3-classroom-grid {
  display: grid;
  grid-template-columns: 265px minmax(0, 1fr) 320px;
  height: calc(100vh - var(--v3-topbar-h));
  background: var(--bg-subtle);
}
.v3-classroom-grid > aside {
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: var(--p-space-6) var(--p-space-3);
  overflow-y: auto;
}
.v3-classroom-grid > main { min-width: 0; display: flex; flex-direction: column; background: var(--bg-subtle); }
.v3-classroom-grid > .v3-ai-panel {
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Classroom — left pane lesson items */
.v3-classroom-lesson {
  padding: var(--p-space-3) var(--p-space-3);
  border-radius: var(--radius-md);
  display: flex;
  gap: var(--p-space-3);
  align-items: center;
  color: var(--text-secondary);
  font-size: var(--p-type-sm);
  cursor: pointer;
  margin-bottom: 2px;
  min-height: 36px;
}
.v3-classroom-lesson:hover { background: var(--bg-subtle); }
.v3-classroom-lesson.active { background: var(--brand-subtle); color: var(--brand); font-weight: 700; }
.v3-lesson-status {
  width: 21px; height: 21px;
  border-radius: 50%;
  background: var(--bg-subtle);
  display: grid; place-items: center;
  font-size: var(--p-type-xs);
  flex-shrink: 0;
}
.v3-lesson-status.done { background: var(--success-subtle); color: var(--success-on); }
.v3-lesson-status.current { background: var(--brand); color: var(--on-brand); }
.v3-classroom-progress-box {
  margin: var(--p-space-5) var(--p-space-2);
  padding: var(--p-space-4);
  border-radius: var(--radius-lg);
  background: var(--bg-subtle);
}
.v3-classroom-progress-box strong {
  display: flex; justify-content: space-between;
  font-size: var(--p-type-sm); margin-bottom: var(--p-space-3);
  color: var(--text);
}

/* Classroom — center topbar */
.v3-class-topbar {
  height: 70px;
  padding: 0 var(--p-space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.v3-breadcrumb { font-size: var(--p-type-sm); color: var(--text-muted); }
.v3-breadcrumb strong { color: var(--text); }
.v3-live-indicator {
  display: flex;
  align-items: center;
  gap: var(--p-space-2);
  color: var(--danger);
  font-size: var(--p-type-xs);
  font-weight: 700;
}
.v3-live-dot { width: 7px; height: 7px; background: var(--danger); border-radius: 50%; }

/* Classroom — center learning area */
.v3-learning-area { padding: var(--p-space-7); overflow-y: auto; flex: 1; }
.v3-video-stage {
  min-height: 380px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, color-mix(in oklch, var(--brand) 25%, transparent), transparent 25%),
    linear-gradient(135deg, var(--text), var(--brand));
  color: var(--bg);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.v3-video-content { text-align: center; padding: var(--p-space-5); }
.v3-video-content h2 { margin-top: var(--p-space-5); font-size: var(--p-type-2xl); color: var(--bg); }
.v3-video-content p { color: color-mix(in oklch, var(--bg) 75%, transparent); margin-top: var(--p-space-2); }
.v3-play-button {
  width: 70px; height: 70px;
  border-radius: 50%;
  background: var(--bg);
  color: var(--brand);
  font-size: 22px;
  margin: 0 auto;
  display: grid; place-items: center;
  border: 0;
  cursor: pointer;
  transition: transform var(--p-dur-fast) var(--ease-standard);
}
.v3-play-button:hover { transform: scale(1.05); }
.v3-play-button:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
.v3-video-meta {
  position: absolute;
  left: var(--p-space-5);
  right: var(--p-space-5);
  bottom: var(--p-space-5);
  display: flex;
  align-items: center;
  gap: var(--p-space-4);
  color: var(--bg);
}
.v3-lesson-content { max-width: 850px; margin: var(--p-space-6) auto; }
.v3-lesson-content h1 { font-size: var(--p-type-3xl); margin-top: var(--p-space-3); color: var(--text); }
.v3-lesson-content > p {
  margin-top: var(--p-space-3);
  color: var(--text-muted);
  line-height: 1.7;
}
.v3-quick-actions { display: flex; gap: var(--p-space-3); flex-wrap: wrap; margin-top: var(--p-space-6); }
.v3-quick-action {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--p-space-3) var(--p-space-4);
  font-size: var(--p-type-sm);
  color: var(--text-secondary);
  min-height: 44px;
}
.v3-quick-action:hover { background: var(--bg-subtle); border-color: var(--border-strong); }
.v3-quick-action:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.v3-interactive-card {
  margin-top: var(--p-space-7);
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--p-space-5);
}
.v3-interactive-card h3 { font-size: var(--p-type-lg); margin-top: var(--p-space-4); color: var(--text); }
.v3-interactive-card > p {
  margin: var(--p-space-2) 0 var(--p-space-4);
  color: var(--text-muted);
  font-size: var(--p-type-sm);
}
.v3-answers { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--p-space-3); }
.v3-answer {
  padding: var(--p-space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  text-align: left;
  font-size: var(--p-type-sm);
  color: var(--text);
  min-height: 44px;
}
.v3-answer:hover { border-color: var(--brand); background: var(--brand-subtle); }
.v3-answer:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* Classroom — bottom bar */
.v3-class-bottom {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: var(--p-space-4) var(--p-space-6);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--p-space-3);
  flex-wrap: wrap;
}
.v3-bottom-tools { display: flex; gap: var(--p-space-2); flex-wrap: wrap; }

/* Classroom — AI panel */
.v3-ai-header { padding: var(--p-space-6); border-bottom: 1px solid var(--border); }
.v3-ai-title { display: flex; gap: var(--p-space-3); align-items: center; }
.v3-ai-logo {
  width: 36px; height: 36px;
  border-radius: var(--radius-md);
  background: var(--brand-subtle);
  color: var(--brand);
  display: grid; place-items: center;
}
.v3-ai-title h3 { font-size: var(--p-type-md); margin: 0; color: var(--text); }
.v3-ai-title small { color: var(--success-on); font-size: var(--p-type-xs); }
.v3-ai-context {
  margin-top: var(--p-space-5);
  padding: var(--p-space-3);
  background: var(--bg-subtle);
  border-radius: var(--radius-md);
  font-size: var(--p-type-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}
.v3-ai-messages { flex: 1; padding: var(--p-space-5); overflow-y: auto; }
.v3-ai-message {
  background: var(--bg-subtle);
  color: var(--text-secondary);
  padding: var(--p-space-3);
  border-radius: 4px var(--radius-lg) var(--radius-lg) var(--radius-lg);
  font-size: var(--p-type-sm);
  line-height: 1.55;
  margin-bottom: var(--p-space-4);
}
.v3-user-message {
  background: var(--brand);
  color: var(--on-brand);
  margin-left: 35px;
  border-radius: var(--radius-lg) 4px var(--radius-lg) var(--radius-lg);
}
.v3-suggestions { padding: 0 var(--p-space-5) var(--p-space-4); display: flex; gap: var(--p-space-2); flex-wrap: wrap; }
.v3-suggestion {
  padding: var(--p-space-2) var(--p-space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  font-size: var(--p-type-xs);
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 36px;
}
.v3-suggestion:hover { background: var(--bg-subtle); border-color: var(--border-strong); }
.v3-suggestion:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.v3-ai-input { border-top: 1px solid var(--border); padding: var(--p-space-4); }
.v3-input-box {
  display: flex;
  align-items: center;
  gap: var(--p-space-2);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  padding: var(--p-space-2);
  border-radius: var(--radius-md);
}
.v3-input-box input {
  border: 0;
  outline: none;
  background: transparent;
  flex: 1;
  padding: var(--p-space-2);
  min-width: 0;
  font-size: var(--p-type-sm);
  color: var(--text);
}
.v3-input-box input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: var(--radius-xs); }
.v3-send {
  width: 34px; height: 34px;
  border-radius: var(--radius-md);
  background: var(--brand);
  color: var(--on-brand);
  border: 0;
  cursor: pointer;
  font-size: var(--p-type-md);
}
.v3-send:hover { background: var(--brand-hover); }
.v3-send:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* Responsive */
@media (max-width: 1200px) {
  .v3-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .v3-catalog-grid { grid-template-columns: repeat(2, 1fr); }
  .v3-classroom-grid { grid-template-columns: 220px minmax(0, 1fr); }
  .v3-ai-panel { display: none; }
}
@media (max-width: 850px) {
  .v3-app { grid-template-columns: 1fr; }
  .v3-sidebar { display: none; }
  .v3-sidebar.open { display: flex; position: fixed; z-index: var(--p-z-drawer); }
  .v3-overlay { display: block; position: fixed; inset: 0; background: var(--scrim); z-index: var(--p-z-raised); }
  .v3-main { grid-column: 1; }
  .v3-content { padding: var(--p-space-5); }
  .v3-topbar { padding: 0 var(--p-space-5); gap: var(--p-space-3); }
  .v3-search { display: none; }
  .v3-menu-btn { display: block; }
  .v3-grid-2, .v3-grid-3, .v3-grid-4, .v3-catalog-grid { grid-template-columns: 1fr; }
  /* Classroom: stack into a single column on mobile. The 3 panes are
     reachable via the bottom toolbar / in-page tabs (future enhancement);
     for now the center column takes precedence so the lesson always fits. */
  .v3-classroom-grid {
    grid-template-columns: 1fr;
    height: auto;
  }
  .v3-classroom-grid > aside,
  .v3-classroom-grid > .v3-ai-panel { display: none; }
}
`;
