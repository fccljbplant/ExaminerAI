import { ReactNode } from "react";

export function SkeletonPanel({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={"animate-pulse rounded-xl border border-border bg-card p-5 " + className} aria-busy="true">
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-muted/70" style={{ width: (90 - i * 12) + "%" }} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "🌱", title, hint, action }: { icon?: string; title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-2xl">{icon}</p>
      <p className="mt-2 text-sm font-bold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm font-bold text-destructive">Something went wrong</p>
      <p className="mt-1 text-xs text-destructive/70">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-lg border border-destructive/40 px-4 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 transition">
          Retry
        </button>
      )}
    </div>
  );
}
