"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  CalendarCheck,
  X,
  Sparkles,
  Bell,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DailyTaskItem {
  id: string;
  description: string;
  status: string;
  isMilestone?: boolean;
  estimatedMinutes?: number | null;
}
interface DailyTasksResponse {
  currentWeek: number;
  todayDay: number;
  todayDayLabel: string;
  todayTopic: string;
  weekPhase: string;
  hasCheckedInToday: boolean;
  hasPracticedToday: boolean;
  curriculumCompleted: boolean;
  curriculumCompletedCount: number;
  todayPracticeCount: number;
  projectTasks: DailyTaskItem[];
  todayProjectTasksTotal: number;
  todayProjectTasksCompleted: number;
  weeklyTasksTotal: number;
  weeklyTasksCompleted: number;
  pendingCount: number;
  allDone: boolean;
}

interface DailyTaskReminderProps {
  /** Called when user clicks "Mark as done" / "Go to check-in" — lets the
   *  parent dashboard refresh its data too. */
  onChanged?: () => void;
  /** Called when user wants to navigate to the project plan / check-in / practice. */
  onNavigate?: (mode: "gantt" | "checkin" | "question") => void;
}

/** Auto-popup interval — every 10 minutes when there are pending tasks. */
const POPUP_INTERVAL_MS = 10 * 60 * 1000;
/** Polling interval for re-fetching task state. */
const POLL_INTERVAL_MS = 2 * 60 * 1000;

/**
 * DailyTaskReminder — a floating popup that reminds the student of today's
 * pending tasks. Auto-opens every ~3 minutes when there are pending items,
 * shows a green "all done!" state when complete, and includes a small
 * floating badge in the corner showing the pending count.
 */
export function DailyTaskReminder({ onChanged, onNavigate }: DailyTaskReminderProps) {
  const [data, setData] = useState<DailyTasksResponse | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  // Persist lastPopupShown + dismissedUntil in localStorage so they survive
  // page reloads (otherwise every reload re-opens the popup immediately).
  // Initialize lastPopupShown to Date.now() so the popup doesn't auto-open
  // on the very first mount — it waits POPUP_INTERVAL_MS (10 min) first.
  const [lastPopupShown, setLastPopupShown] = useState<number>(() => {
    if (typeof window === "undefined") return Date.now();
    const stored = window.localStorage.getItem("dailyTaskReminder.lastPopupShown");
    return stored ? Number(stored) : Date.now();
  });
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = window.localStorage.getItem("dailyTaskReminder.dismissedUntil");
    return stored ? Number(stored) : 0;
  });
  const [markDoneError, setMarkDoneError] = useState("");

  // Persist dismissedUntil + lastPopupShown across reloads
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dailyTaskReminder.dismissedUntil", String(dismissedUntil));
  }, [dismissedUntil]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dailyTaskReminder.lastPopupShown", String(lastPopupShown));
  }, [lastPopupShown]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get<DailyTasksResponse>("/api/daily-tasks");
      setData(res);
    } catch {
      // silent fail — the popup is non-critical
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchTasks();
    const id = setInterval(fetchTasks, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchTasks]);

  // Auto-open popup when:
  // - There are pending tasks
  // - The popup isn't already open
  // - User hasn't dismissed within the last 5 minutes
  // - It's been at least POPUP_INTERVAL_MS since the last auto-popup
  useEffect(() => {
    if (!data) return;
    if (data.allDone) return; // don't bother the user when everything's done
    if (data.pendingCount === 0) return;
    if (popupOpen) return;

    const now = Date.now();
    if (now < dismissedUntil) return; // user dismissed recently
    if (now - lastPopupShown < POPUP_INTERVAL_MS) return; // not time yet

    setPopupOpen(true);
    setLastPopupShown(now);
  }, [data, popupOpen, dismissedUntil, lastPopupShown]);

  // Refresh when window regains focus
  useEffect(() => {
    const onFocus = () => fetchTasks();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchTasks]);

  const handleDismiss = () => {
    setPopupOpen(false);
    // Don't auto-open again for 15 minutes
    setDismissedUntil(Date.now() + 15 * 60 * 1000);
  };

  const handleMarkTaskDone = async (taskId: string) => {
    setMarkDoneError("");
    try {
      // Use the typed api helper — gets 8s timeout, typed errors, JSON unwrapping.
      await api.patch("/api/tasks", { id: taskId, status: "completed" });
      await fetchTasks();
      onChanged?.();
    } catch (e) {
      setMarkDoneError(e instanceof Error ? e.message : "Failed to mark task done — please retry");
    }
  };

  // Don't render until we have data
  if (!data) return null;

  const isAllDone = data.allDone;
  const pendingCount = data.pendingCount;

  return (
    <>
      {/* Floating badge — always visible in bottom-right corner.
          Stacked ABOVE the Ask My Teacher FAB (which sits at bottom-6 right-6
          from AppShell) to avoid overlap. bottom-20 = 5rem = 80px clears the
          Ask My Teacher button (which is ~48px tall + 24px bottom = 72px). */}
      <button
        onClick={() => setPopupOpen(true)}
        className={`fixed bottom-20 right-6 z-50 flex items-center gap-2 rounded-full shadow-lg transition-all hover:scale-105 ${
          isAllDone
            ? "bg-emerald-500 text-white pr-4 pl-3 py-2"
            : pendingCount > 0
            ? "bg-amber-500 text-white pr-4 pl-3 py-2 animate-pulse"
            : "bg-muted-foreground/80 text-white pr-4 pl-3 py-2"
        }`}
        title={
          isAllDone
            ? "All today's tasks done — great work!"
            : pendingCount > 0
            ? `${pendingCount} pending task${pendingCount === 1 ? "" : "s"} for today — click to view`
            : "Daily tasks"
        }
      >
        {isAllDone ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        <span className="text-xs font-bold">
          {isAllDone ? "All done" : pendingCount > 0 ? `${pendingCount} pending` : "Today"}
        </span>
        {!isAllDone && pendingCount > 0 && (
          <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-amber-600 text-[10px] font-bold">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Popup dialog */}
      {popupOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 animate-fade-in-up">
          <div
            className={`relative w-full max-w-md rounded-2xl shadow-2xl border-2 ${
              isAllDone
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500"
                : "bg-background border-amber-500"
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isAllDone ? "border-emerald-500/30" : "border-amber-500/30"}`}>
              <div className="flex items-center gap-2">
                {isAllDone ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white">
                    <Bell className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className={`text-sm font-bold ${isAllDone ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                    {isAllDone ? "All done for today! 🎉" : "Today's Pending Tasks"}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Week {data.currentWeek} · {data.todayDayLabel} (Day {data.todayDay}) · {data.weekPhase}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {isAllDone ? (
                /* GREEN STATE — all done */
                <div className="text-center py-6 space-y-3">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">
                      You crushed it today!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All {data.todayProjectTasksTotal} project task{data.todayProjectTasksTotal === 1 ? "" : "s"} done, daily check-in complete, and {data.todayPracticeCount} practice question{data.todayPracticeCount === 1 ? "" : "s"} answered.
                    </p>
                  </div>
                  <div className="rounded-md bg-emerald-100 dark:bg-emerald-900/30 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                    <p className="font-medium">Week progress: {data.weeklyTasksCompleted}/{data.weeklyTasksTotal} tasks done</p>
                    <Progress
                      value={data.weeklyTasksTotal > 0 ? (data.weeklyTasksCompleted / data.weeklyTasksTotal) * 100 : 0}
                      className="h-1.5 mt-2"
                    />
                  </div>
                  <Button onClick={handleDismiss} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    Keep Building
                  </Button>
                </div>
              ) : (
                /* PENDING STATE — show what's left */
                <>
                  {/* Today's Learning Topic — at the very top */}
                  {data.todayTopic && (
                    <div className="rounded-md bg-primary/10 border border-primary/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" /> Today&apos;s Curriculum
                        </p>
                        {data.curriculumCompleted ? (
                          <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Done
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30 bg-amber-500/10">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-foreground font-medium leading-snug">
                        {data.todayTopic}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {!data.curriculumCompleted && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => {
                              onNavigate?.("checkin");
                              setPopupOpen(false);
                            }}
                          >
                            <CalendarCheck className="h-3 w-3" /> Mark complete
                          </Button>
                        )}
                        {!data.hasPracticedToday && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => {
                              onNavigate?.("question");
                              setPopupOpen(false);
                            }}
                          >
                            <HelpCircle className="h-3 w-3" /> Practice this topic
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mark-done error toast (if the API call failed) */}
                  {markDoneError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
                      {markDoneError}
                    </div>
                  )}

                  {/* Project tasks for today */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        Today&apos;s Project Tasks
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {data.todayProjectTasksCompleted}/{data.todayProjectTasksTotal} done
                      </Badge>
                    </div>
                    {data.todayProjectTasksTotal === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 px-3 rounded bg-muted">
                        No specific tasks scheduled for today&apos;s day. Add some in the Project Plan.
                      </p>
                    ) : data.projectTasks.length === 0 ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 py-2 px-3 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> All today&apos;s project tasks are done!
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {data.projectTasks.map((task) => (
                          <li
                            key={task.id}
                            className="flex items-start gap-2 rounded-md bg-muted p-2 text-sm"
                          >
                            <Circle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground text-xs leading-snug">{task.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[9px] capitalize">{task.status}</Badge>
                                <button
                                  onClick={() => handleMarkTaskDone(task.id)}
                                  className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                >
                                  Mark done →
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {data.todayProjectTasksTotal > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 text-[11px] h-7"
                        onClick={() => {
                          onNavigate?.("gantt");
                          setPopupOpen(false);
                        }}
                      >
                        Open Project Plan →
                      </Button>
                    )}
                  </div>

                  {/* Daily practice question reminder */}
                  <div className={`rounded-md p-3 border ${
                    data.hasPracticedToday
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30"
                      : "bg-amber-50 dark:bg-amber-950/30 border-amber-500/30"
                  }`}>
                    <div className="flex items-start gap-2">
                      {data.hasPracticedToday ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <HelpCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={`text-xs font-medium ${data.hasPracticedToday ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                          {data.hasPracticedToday
                            ? `Daily practice done (${data.todayPracticeCount} question${data.todayPracticeCount === 1 ? "" : "s"} today)`
                            : "Daily practice question pending"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {data.hasPracticedToday
                            ? "Great — you've practiced today's concept."
                            : data.todayTopic
                            ? `Today's topic: ${data.todayTopic}. Answer one practice question to lock in your understanding.`
                            : "Answer one practice question to keep your streak going."}
                        </p>
                        {!data.hasPracticedToday && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-[11px] border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                            onClick={() => {
                              onNavigate?.("question");
                              setPopupOpen(false);
                            }}
                          >
                            <HelpCircle className="h-3 w-3" /> Practice Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Daily check-in reminder */}
                  <div className={`rounded-md p-3 border ${
                    data.hasCheckedInToday
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30"
                      : "bg-amber-50 dark:bg-amber-950/30 border-amber-500/30"
                  }`}>
                    <div className="flex items-start gap-2">
                      {data.hasCheckedInToday ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <CalendarCheck className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={`text-xs font-medium ${data.hasCheckedInToday ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                          {data.hasCheckedInToday ? "Daily check-in done" : "Daily check-in pending"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {data.hasCheckedInToday
                            ? "Great — you've logged your progress today."
                            : "Log what you did today to keep your streak alive."}
                        </p>
                        {!data.hasCheckedInToday && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-[11px] border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                            onClick={() => {
                              onNavigate?.("checkin");
                              setPopupOpen(false);
                            }}
                          >
                            <CalendarCheck className="h-3 w-3" /> Check In Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Week progress mini-summary */}
                  <div className="rounded-md bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground mb-1">Week {data.currentWeek} overall</p>
                    <Progress
                      value={data.weeklyTasksTotal > 0 ? (data.weeklyTasksCompleted / data.weeklyTasksTotal) * 100 : 0}
                      className="h-1.5"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {data.weeklyTasksCompleted} of {data.weeklyTasksTotal} tasks done this week
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-muted-foreground"
                onClick={() => { fetchTasks(); }}
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={handleDismiss}
              >
                {isAllDone ? "Close" : "Remind me in 15 min"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

