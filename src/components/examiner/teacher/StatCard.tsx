"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function StatCard({ label, value, sub, icon, accent }: { label: string; value: number; sub?: string; icon: React.ReactNode; accent: "emerald" | "cyan" | "amber" | "violet" | "red"; }) {
  const accents = {
    emerald: "from-primary/15 to-primary/5 text-primary border-primary/30",
    cyan: "from-secondary/20 to-secondary/5 text-secondary-foreground border-secondary-foreground/30",
    amber: "from-primary/15 to-primary/5 text-primary border-primary/30",
    violet: "from-primary/15 to-primary/5 text-primary border-primary/30",
    // Phase 3.1: red accent for the "Needs Attention" card
    red: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400 border-red-500/30",
  };
  return (
    <Card className={`bg-gradient-to-br ${accents[accent]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground/80">{label}</span>
          <span className="opacity-70">{icon}</span>
        </div>
        <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
        {sub && <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
