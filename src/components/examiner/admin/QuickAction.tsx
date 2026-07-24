"use client";



export function QuickAction({ label, desc, icon: Icon, onClick }: { label: string; desc: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}
