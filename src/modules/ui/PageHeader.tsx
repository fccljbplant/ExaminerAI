"use client";
import { ReactNode } from "react";

export interface Crumb { label: string; href?: string }

interface PageHeaderProps {
  crumbs?: Crumb[];
  title: string;
  subtitle?: string;
  chips?: ReactNode;
  progress?: number;
  actions?: ReactNode;
}

export default function PageHeader(props: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3">
        {props.crumbs && props.crumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-label="Breadcrumb">
            {props.crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>›</span>}
                {crumb.href
                  ? <a href={crumb.href} className="hover:text-foreground transition">{crumb.label}</a>
                  : <span className="text-foreground/70">{crumb.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-foreground" title={props.title}>{props.title}</h1>
            {props.subtitle && <p className="truncate text-[11px] text-muted-foreground">{props.subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">{props.chips}{props.actions}</div>
        </div>
        {typeof props.progress === "number" && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={props.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: Math.max(0, Math.min(100, props.progress)) + "%" }} />
          </div>
        )}
      </div>
    </div>
  );
}
