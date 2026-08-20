"use client";

// src/modules/ui-v3/v3-shell.tsx — Dark sidebar + topbar shell for v3 UI.
// The entire character of the new interface: fixed dark sidebar (250px),
// sticky topbar with search, purple primary color.
//
// Usage from layouts:
//   <V3Shell navGroups={NAV} userName={...} userInitials={...} topbarExtra={<UIToggle/>}>
//     {children}
//   </V3Shell>

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  /** Optional content rendered in the topbar (right side, before avatar). Used for UIToggle. */
  topbarExtra?: ReactNode;
  /** When true, the content area renders full-bleed (no padding, no max-width).
   *  Used by the classroom view which is a 3-column full-viewport layout. */
  fullBleed?: boolean;
  roleSwitcher?: { current: string; options: { value: string; label: string }[]; onChange: (v: string) => void };
}

export function V3Shell({ children, navGroups, userName, userInitials, topbarExtra, fullBleed, roleSwitcher }: V3ShellProps) {
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

        <nav className="v3-nav">
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
                    <span className="v3-nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="v3-sidebar-bottom">
          <Link href="/learner/help" className="v3-nav-item">
            <span className="v3-nav-icon">?</span> Help & Support
          </Link>

          {roleSwitcher && (
            <div className="v3-role-switcher">
              <label>Preview role</label>
              <select
                value={roleSwitcher.current}
                onChange={(e) => roleSwitcher.onChange(e.target.value)}
              >
                {roleSwitcher.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileNavOpen && <div className="v3-overlay" onClick={() => setMobileNavOpen(false)} />}

      {/* Main */}
      <main className="v3-main">
        <header className="v3-topbar">
          <button className="v3-menu-btn" onClick={() => setMobileNavOpen(!mobileNavOpen)}>☰</button>
          <div className="v3-search">🔍 &nbsp; Search courses, lessons, assessments...</div>
          <div className="v3-top-actions">
            {topbarExtra}
            <button className="v3-icon-button" aria-label="Notifications">🔔</button>
            <button className="v3-icon-button" aria-label="Theme">☀</button>
            <div className="v3-avatar">{userInitials}</div>
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
  return (
    <div className="v3-progress">
      <span style={{ width: `${value}%` }} />
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

export function V3SectionTitle({ title, link }: { title: string; link?: string }) {
  return (
    <div className="v3-section-title">
      <h2>{title}</h2>
      {link && <a>{link}</a>}
    </div>
  );
}

// CSS — all v3 styles injected once
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

// Exported so other v3 modules (courses.tsx, etc.) can re-use the same CSS injection
export const V3_CSS_TEXT = `
:root {
  --v3-bg: #f6f7fb;
  --v3-surface: #ffffff;
  --v3-surface-soft: #f8fafc;
  --v3-border: #e7eaf0;
  --v3-text: #182230;
  --v3-muted: #718096;
  --v3-primary: #5b5ce2;
  --v3-primary-soft: #eeeeff;
  --v3-success: #18a874;
  --v3-warning: #e89b28;
  --v3-danger: #e04f5f;
  --v3-sidebar: #101323;
  --v3-sidebar-text: #9da5bd;
  --v3-radius: 16px;
  --v3-shadow: 0 10px 35px rgba(23, 30, 55, .07);
}
.v3-app {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 250px 1fr;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--v3-bg);
  color: var(--v3-text);
}
.v3-sidebar {
  background: var(--v3-sidebar);
  padding: 24px 14px;
  color: white;
  display: flex;
  flex-direction: column;
  position: fixed;
  width: 250px;
  height: 100vh;
  overflow-y: auto;
  z-index: 50;
}
.v3-brand { display: flex; align-items: center; gap: 11px; padding: 6px 10px 30px; }
.v3-brand-icon { width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #7778ff, #5b5ce2); display: grid; place-items: center; font-weight: 800; color: white; }
.v3-brand h2 { font-size: 16px; color: white; }
.v3-brand small { color: var(--v3-sidebar-text); font-size: 11px; }
.v3-nav-label { color: #68708b; font-size: 10px; letter-spacing: 1.1px; font-weight: 700; padding: 18px 12px 8px; }
.v3-nav-item { width: 100%; background: transparent; color: var(--v3-sidebar-text); text-align: left; padding: 11px 12px; border-radius: 10px; margin: 2px 0; display: flex; align-items: center; gap: 11px; transition: .2s ease; text-decoration: none; font-size: 14px; cursor: pointer; }
.v3-nav-item:hover, .v3-nav-item.active { background: rgba(255,255,255,.08); color: white; }
.v3-nav-item.active { box-shadow: inset 3px 0 0 #7c7dff; }
.v3-nav-icon { width: 22px; text-align: center; }
.v3-sidebar-bottom { margin-top: auto; }
.v3-role-switcher { margin: 20px 6px 0; padding: 14px; border-radius: 14px; background: rgba(255,255,255,.06); }
.v3-role-switcher label { color: #838ba5; display: block; font-size: 10px; text-transform: uppercase; margin-bottom: 7px; }
.v3-role-switcher select { width: 100%; background: #1b2036; color: white; border: 1px solid #303750; padding: 9px; border-radius: 9px; font-size: 13px; }
.v3-main { grid-column: 2; min-width: 0; }
.v3-topbar { height: 72px; background: rgba(255,255,255,.9); border-bottom: 1px solid var(--v3-border); display: flex; align-items: center; justify-content: space-between; padding: 0 34px; position: sticky; top: 0; z-index: 10; backdrop-filter: blur(10px); gap: 18px; }
.v3-search { width: min(420px, 45vw); background: var(--v3-surface-soft); border: 1px solid var(--v3-border); border-radius: 10px; padding: 10px 14px; color: var(--v3-muted); font-size: 14px; }
.v3-top-actions { display: flex; align-items: center; gap: 12px; }
.v3-icon-button { width: 40px; height: 40px; border-radius: 10px; background: var(--v3-surface-soft); border: 1px solid var(--v3-border); cursor: pointer; font-size: 16px; }
.v3-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #ffbd91, #9d6bff); color: white; display: grid; place-items: center; font-size: 13px; font-weight: 700; }
.v3-content { padding: 32px; max-width: 1550px; margin: auto; }
.v3-content-fullbleed { padding: 0; max-width: none; margin: 0; }
.v3-menu-btn { display: none; background: transparent; border: 0; font-size: 22px; cursor: pointer; }
.v3-overlay { display: none; }

/* Components */
.v3-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; gap: 20px; }
.v3-page-title h1 { font-size: 28px; letter-spacing: -.7px; margin: 0; }
.v3-page-title p { color: var(--v3-muted); margin-top: 7px; font-size: 14px; }
.v3-btn { padding: 11px 16px; border-radius: 10px; background: var(--v3-surface); border: 1px solid var(--v3-border); color: var(--v3-text); font-weight: 600; transition: .2s; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.v3-btn:hover { transform: translateY(-1px); }
.v3-btn-primary { background: var(--v3-primary); color: white; border-color: var(--v3-primary); box-shadow: 0 8px 20px rgba(91,92,226,.18); }
.v3-btn-success { background: var(--v3-success); color: white; border-color: var(--v3-success); }
.v3-grid { display: grid; gap: 20px; }
.v3-grid-4 { grid-template-columns: repeat(4, 1fr); }
.v3-grid-3 { grid-template-columns: repeat(3, 1fr); }
.v3-grid-2 { grid-template-columns: repeat(2, 1fr); }
.v3-card { background: var(--v3-surface); border: 1px solid var(--v3-border); border-radius: var(--v3-radius); padding: 20px; box-shadow: 0 3px 12px rgba(20,30,60,.025); }
.v3-card h3 { font-size: 15px; }
.v3-card p { color: var(--v3-muted); font-size: 13px; margin-top: 6px; }
.v3-stat-number { font-size: 28px; font-weight: 750; margin-top: 16px; }
.v3-stat-label { color: var(--v3-muted); font-size: 12px; margin-top: 5px; }
.v3-progress { width: 100%; height: 8px; background: #edf0f5; border-radius: 99px; overflow: hidden; }
.v3-progress > span { height: 100%; display: block; border-radius: inherit; background: linear-gradient(90deg, var(--v3-primary), #8585ff); }
.v3-section-title { display: flex; justify-content: space-between; align-items: center; margin: 32px 0 16px; }
.v3-section-title h2 { font-size: 18px; }
.v3-section-title a { color: var(--v3-primary); font-size: 13px; font-weight: 600; cursor: pointer; }
.v3-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 99px; font-size: 11px; font-weight: 700; }
.v3-badge-primary { background: var(--v3-primary-soft); color: var(--v3-primary); }
.v3-badge-success { background: #e9faf3; color: var(--v3-success); }
.v3-badge-warning { background: #fff5e5; color: var(--v3-warning); }

/* Continue learning hero card */
.v3-continue-card { background: radial-gradient(circle at 85% 15%, rgba(126,127,255,.2), transparent 28%), linear-gradient(135deg, #252752, #393b8e); color: white; padding: 30px; min-height: 250px; position: relative; overflow: hidden; }
.v3-continue-card p { color: #bfc2ec; }
.v3-continue-card h2 { margin: 16px 0 8px; font-size: 26px; }
.v3-continue-card .v3-progress { margin: 24px 0 18px; background: rgba(255,255,255,.16); }
.v3-continue-card .v3-progress span { background: #b7b8ff; }
.v3-continue-card .v3-btn { background: white; color: #30328b; border: 0; }

/* Course row */
.v3-course-row { display: flex; align-items: center; gap: 14px; padding: 15px 0; border-bottom: 1px solid var(--v3-border); }
.v3-course-row:last-child { border-bottom: 0; }
.v3-course-icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: #f0efff; color: var(--v3-primary); }
.v3-course-info { flex: 1; }
.v3-course-info strong { display: block; font-size: 14px; }
.v3-course-info small { color: var(--v3-muted); }

/* Today card */
.v3-today-card { min-height: 120px; }
.v3-today-icon { width: 40px; height: 40px; background: var(--v3-primary-soft); color: var(--v3-primary); border-radius: 12px; display: grid; place-items: center; margin-bottom: 14px; }

/* Attention item */
.v3-attention-item { padding: 14px 0; border-bottom: 1px solid var(--v3-border); display: flex; justify-content: space-between; align-items: center; }
.v3-attention-item:last-child { border-bottom: 0; }

/* Table */
.v3-table-card { overflow-x: auto; padding: 0; }
.v3-table-card table { width: 100%; border-collapse: collapse; min-width: 650px; }
.v3-table-card th, .v3-table-card td { text-align: left; padding: 16px 20px; border-bottom: 1px solid var(--v3-border); font-size: 13px; }
.v3-table-card th { color: var(--v3-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; background: #fafbfc; }

/* Class session card */
.v3-class-session { background: linear-gradient(135deg, #23264e, #474ab0); color: white; }
.v3-class-session p { color: #c5c8f5; }
.v3-session-row { display: flex; align-items: center; justify-content: space-between; margin-top: 22px; }

/* Courses catalog (full-bleed grid) */
.v3-catalog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.v3-course-card { background: var(--v3-surface); border: 1px solid var(--v3-border); border-radius: var(--v3-radius); overflow: hidden; transition: .2s; text-decoration: none; color: inherit; display: flex; flex-direction: column; }
.v3-course-card:hover { transform: translateY(-2px); box-shadow: 0 14px 35px rgba(20,30,60,.08); border-color: #d9dcff; }
.v3-course-thumb { aspect-ratio: 16/7; background: linear-gradient(135deg, #252752, #5b5ce2); color: white; display: grid; place-items: center; font-size: 38px; font-weight: 700; position: relative; }
.v3-course-thumb.green { background: linear-gradient(135deg, #15412c, #18a874); }
.v3-course-thumb.amber { background: linear-gradient(135deg, #5c3e16, #e89b28); }
.v3-course-thumb.pink { background: linear-gradient(135deg, #5b1d4f, #d36cb3); }
.v3-course-thumb.blue { background: linear-gradient(135deg, #142a4e, #4a7dff); }
.v3-enrolled-pill { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,.92); color: var(--v3-primary); font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 99px; }
.v3-course-body { padding: 18px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.v3-course-body h3 { font-size: 15px; font-weight: 700; line-height: 1.35; color: var(--v3-text); }
.v3-course-body .v3-course-sub { font-size: 12px; color: var(--v3-muted); line-height: 1.5; flex: 1; }
.v3-course-meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px; color: var(--v3-muted); margin-top: auto; }
.v3-chip { background: var(--v3-surface-soft); border: 1px solid var(--v3-border); padding: 3px 9px; border-radius: 99px; font-weight: 600; }

/* Filter row */
.v3-filter-row { display: flex; gap: 10px; margin-bottom: 22px; flex-wrap: wrap; align-items: center; }
.v3-input { height: 42px; border-radius: 10px; border: 1px solid var(--v3-border); background: var(--v3-surface); padding: 0 14px; font-size: 14px; color: var(--v3-text); min-width: 0; }
.v3-input:focus { outline: 0; border-color: var(--v3-primary); box-shadow: 0 0 0 3px rgba(91,92,226,.12); }
.v3-input.search { flex: 1; min-width: 220px; padding-left: 38px; position: relative; }
.v3-search-wrap { position: relative; flex: 1; min-width: 220px; }
.v3-search-wrap > span { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--v3-muted); font-size: 14px; pointer-events: none; }
.v3-chip-btn { padding: 8px 14px; border-radius: 99px; background: var(--v3-surface); border: 1px solid var(--v3-border); font-size: 12px; font-weight: 600; cursor: pointer; color: var(--v3-muted); }
.v3-chip-btn.active { background: var(--v3-primary); color: white; border-color: var(--v3-primary); }
.v3-select { height: 42px; border-radius: 10px; border: 1px solid var(--v3-border); background: var(--v3-surface); padding: 0 12px; font-size: 14px; color: var(--v3-text); }

/* Skeleton */
.v3-skeleton { background: linear-gradient(90deg, #f0f1f6 25%, #e7e9f1 37%, #f0f1f6 63%); background-size: 400% 100%; animation: v3-shimmer 1.4s ease infinite; border-radius: var(--v3-radius); }
@keyframes v3-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
.v3-skeleton-card { height: 260px; }

/* Empty state */
.v3-empty { text-align: center; padding: 60px 20px; border: 1px dashed var(--v3-border); border-radius: var(--v3-radius); background: var(--v3-surface); }
.v3-empty h3 { font-size: 16px; margin-bottom: 6px; }
.v3-empty p { font-size: 13px; color: var(--v3-muted); }

/* Responsive */
@media (max-width: 1200px) {
  .v3-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .v3-catalog-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 850px) {
  .v3-app { grid-template-columns: 1fr; }
  .v3-sidebar { display: none; }
  .v3-sidebar.open { display: flex; position: fixed; z-index: 100; }
  .v3-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 40; }
  .v3-main { grid-column: 1; }
  .v3-content { padding: 20px; }
  .v3-topbar { padding: 0 18px; gap: 10px; }
  .v3-search { display: none; }
  .v3-menu-btn { display: block; }
  .v3-grid-2, .v3-grid-3, .v3-grid-4, .v3-catalog-grid { grid-template-columns: 1fr; }
}
`;
