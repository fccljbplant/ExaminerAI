"use client";
// src/components/examiner/admin/MaintenancePanel.tsx
// Extracted from SystemPanel's "maintenance" sub-tab.
// Contains: AI token cache stats + clear-cache action.
// Now a top-level admin tab (was buried 2 levels deep in System → maintenance).

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  estimatedTokensSaved: number;
}

export function MaintenancePanel() {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshStats = async () => {
    setLoading(true);
    try {
      const stats = await api.get<CacheStats>("/api/admin/cache");
      setCacheStats(stats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load cache stats");
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      await api.del("/api/admin/cache");
      setCacheStats(null);
      toast.success("AI token cache cleared.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear cache");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" /> AI Token Cache
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Response cache for cacheable AI calls (daily motivation, project summary).
            Clearing it forces fresh AI responses on the next call.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={refreshStats} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh stats
          </Button>

          {cacheStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded border border-border p-2">
                <p className="text-muted-foreground text-[10px]">Entries</p>
                <p className="font-bold text-foreground tabular-nums">{cacheStats.size}</p>
              </div>
              <div className="rounded border border-border p-2">
                <p className="text-muted-foreground text-[10px]">Hit Rate</p>
                <p className="font-bold text-growth-sage tabular-nums">{cacheStats.hitRate}%</p>
              </div>
              <div className="rounded border border-border p-2">
                <p className="text-muted-foreground text-[10px]">Hits / Misses</p>
                <p className="font-bold text-foreground tabular-nums">{cacheStats.hits} / {cacheStats.misses}</p>
              </div>
              <div className="rounded border border-border p-2">
                <p className="text-muted-foreground text-[10px]">Tokens Saved</p>
                <p className="font-bold text-primary tabular-nums">{cacheStats.estimatedTokensSaved}</p>
              </div>
            </div>
          )}

          <Button
            onClick={clearCache}
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            Clear cache
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
