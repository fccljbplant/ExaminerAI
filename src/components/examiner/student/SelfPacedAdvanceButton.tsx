"use client";

/**
 * SelfPacedAdvanceButton — shows when a student can advance to the next day.
 *
 * Fetches the self-paced status from /api/self-paced. If canAdvanceDay is true,
 * shows a button to advance. Also shows anti-cheat flags if any exist.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/modules/ui/button";
import { Card, CardContent } from "@/modules/ui/card";
import { Badge } from "@/modules/ui/badge";
import { Loader2, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { showError, showSuccess } from "@/lib/toast-helpers";

interface SelfPacedStatus {
  currentWeek: number;
  currentDay: number;
  selfPacedEnabled: boolean;
  todayTasksTotal: number;
  todayTasksCompleted: number;
  canAdvanceDay: boolean;
  canTakeWeeklyTestEarly: boolean;
  weekTasksTotal: number;
  weekTasksCompleted: number;
  daysAheadOfSchedule: number;
  antiCheatFlags: string[];
}

export function SelfPacedAdvanceButton() {
  const [status, setStatus] = useState<SelfPacedStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get<{ status: SelfPacedStatus }>("/api/self-paced");
      setStatus(res.status);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const advance = async () => {
    setAdvancing(true);
    try {
      const res = await api.post<{ ok: boolean; week: number; day: number; message: string }>("/api/self-paced");
      showSuccess(res.message);
      setStatus(null);
      load();
      // Reload the page to refresh daily tasks
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to advance");
    } finally { setAdvancing(false); }
  };

  if (loading) return null;
  if (!status || !status.selfPacedEnabled) return null;

  // Show the advance button when today's tasks are done
  if (!status.canAdvanceDay) {
    // Show progress if tasks remain
    if (status.todayTasksTotal > 0 && status.todayTasksCompleted < status.todayTasksTotal) {
      return (
        <Card className="border-border bg-muted/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Today's progress: {status.todayTasksCompleted}/{status.todayTasksTotal} tasks complete.
              Complete all tasks to advance to Day {status.currentDay + 1 > 5 ? 1 : status.currentDay + 1}.
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  return (
    <Card className="border-growth-sage bg-growth-sage-soft">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-growth-sage" />
            <span className="text-sm font-medium text-foreground">
              All Day {status.currentDay} tasks complete!
            </span>
          </div>
          <Button
            onClick={advance}
            disabled={advancing}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {advancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3 w-3" />}
            Advance to {status.currentDay >= 5 ? `Week ${status.currentWeek + 1}, Day 1` : `Day ${status.currentDay + 1}`}
          </Button>
        </div>

        {/* Anti-cheat flags (informational — don't block advancement) */}
        {status.antiCheatFlags.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-growth-amber-soft border border-growth-amber">
            <AlertTriangle className="w-3.5 h-3.5 text-growth-amber flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-medium text-growth-amber-foreground dark:text-growth-amber">Review flags (your instructor may be notified):</p>
              <ul className="text-[10px] text-muted-foreground">
                {status.antiCheatFlags.map((flag, i) => <li key={i}>• {flag}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* Early weekly test notice */}
        {status.canTakeWeeklyTestEarly && (
          <div className="flex items-center gap-2 text-xs text-growth-sage-foreground">
            <Badge variant="outline" className="text-[9px] bg-growth-sage-soft border-growth-sage">
              Weekly test unlocked!
            </Badge>
            All Week {status.currentWeek} tasks complete — you can take the weekly test now.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
