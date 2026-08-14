"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Compass,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Award,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { Button } from "@/modules/ui/button";
import { Card, CardContent } from "@/modules/ui/card";

/**
 * OnboardingGuide — a step-by-step card that helps new students ramp up.
 *
 * Renders as a single Card above TodayView's "Do this next" panel — not
 * a popup. Auto-hides once all steps are complete OR after the student
 * dismisses it (remembered in localStorage).
 *
 * Completion signals:
 *   1. Browse Courses   — localStorage flag set when the student visits /courses
 *   2. Enroll           — has at least one CourseEnrollment (server)
 *   3. First Lesson     — has at least one DailyLog (server)
 *   4. First Test       — has at least one completed test (server)
 *   5. Earn Credential  — has at least one Certificate (server)
 *
 * Server checks are batched into one GET /api/onboarding/status call to
 * keep the load minimal.
 */

const STORAGE_DISMISS_KEY = "traineesai:onboarding-dismissed";
const STORAGE_VISITED_KEY = "traineesai:visited-courses";

interface OnboardingStatus {
  hasEnrollment: boolean;
  hasDailyLog: boolean;
  hasCompletedTest: boolean;
  hasCredential: boolean;
}

interface Step {
  key: string;
  title: string;
  description: string;
  href: string;
  /** When true, the step shows a checkmark and links are dimmed. */
  completed: boolean;
  /** Navigate to this view inside the app shell (overrides href). */
  appView?: string;
}

const EXTERNAL_HREF = "/courses";

export default function OnboardingGuide({
  onNavigate,
}: {
  onNavigate?: (view: string) => void;
}) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visitedCourses, setVisitedCourses] = useState(false);

  // Load localStorage flags on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(STORAGE_DISMISS_KEY) === "1");
    setVisitedCourses(localStorage.getItem(STORAGE_VISITED_KEY) === "1");
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<OnboardingStatus>("/api/onboarding/status");
      setStatus(res);
    } catch {
      // Non-critical — silent fail. Card stays hidden until next attempt.
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Re-check when the user navigates back to the Today view (in case they
  // enrolled or completed a test in another tab).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_VISITED_KEY && e.newValue === "1") {
        setVisitedCourses(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_DISMISS_KEY, "1");
    }
    setDismissed(true);
  }, []);

  // Build the step list now that we have status.
  const steps: Step[] = [
    {
      key: "browse",
      title: "Browse Courses",
      description: "Explore the marketplace of professional training programs.",
      href: EXTERNAL_HREF,
      completed: visitedCourses,
    },
    {
      key: "enroll",
      title: "Enroll in a Course",
      description: "Pick a course and join — your AI tutor + capstone unlock instantly.",
      href: EXTERNAL_HREF,
      completed: status?.hasEnrollment ?? false,
    },
    {
      key: "lesson",
      title: "Start Your First Lesson",
      description: "Open the daily study view and post a check-in to begin your streak.",
      href: "/app",
      completed: status?.hasDailyLog ?? false,
      appView: "checkin",
    },
    {
      key: "test",
      title: "Take Your First Test",
      description: "Try a daily or weekly Socratic test — AI grades your answers.",
      href: "/app",
      completed: status?.hasCompletedTest ?? false,
      appView: "checkin",
    },
    {
      key: "credential",
      title: "Earn Your Credential",
      description: "Finish the course with a score ≥ 75% to unlock a verifiable credential.",
      href: "/app",
      completed: status?.hasCredential ?? false,
      appView: "credentials",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  // Hide if dismissed, all complete, or still loading initial status.
  // (We keep the card visible while loading only if the student is new —
  //  see "isNewStudent" check below. We don't want to flash the card for
  //  established students who already have all steps done.)
  if (dismissed || allComplete) return null;

  // While loading: hide. Avoids a flash for established students.
  if (status === null && !visitedCourses) return null;
  if (status === null) {
    // Visited courses but status hasn't loaded yet — show skeleton-ish card.
    // Render nothing until status loads; this is fast (<500ms).
    return null;
  }

  // Once status loads, if the student already has an enrollment + a daily log
  // + a completed test + a credential, the allComplete branch above handles it.
  // For everyone else, show the guide.

  const progressPct = Math.round((completedCount / steps.length) * 100);

  const handleStepClick = (step: Step) => {
    if (step.completed) return;
    if (step.appView && onNavigate) {
      onNavigate(step.appView);
    } else if (step.href && typeof window !== "undefined") {
      // Use assign instead of directly modifying location.href to satisfy
      // the react-hooks/immutability lint rule.
      window.location.assign(step.href);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">
                  Welcome to TraineesAI
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {completedCount}/{steps.length} done
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Finish these steps to get the most out of your training.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
            aria-label="Dismiss onboarding guide"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <ol className="space-y-1.5">
          {steps.map((step, idx) => {
            const Icon =
              step.key === "browse" ? BookOpen
              : step.key === "enroll" ? GraduationCap
              : step.key === "lesson" ? BookOpen
              : step.key === "test" ? ClipboardList
              : step.key === "credential" ? Award
              : Sparkles;
            return (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={() => handleStepClick(step)}
                  disabled={step.completed}
                  className={cn(
                    "group w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                    step.completed
                      ? "cursor-default opacity-70"
                      : "hover:bg-accent/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      step.completed
                        ? "bg-growth-sage-soft text-growth-sage dark:text-growth-sage"
                        : "bg-muted text-muted-foreground border border-border"
                    )}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md",
                      step.completed
                        ? "bg-growth-sage-soft text-growth-sage dark:text-growth-sage"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={cn(
                        "block text-xs font-medium leading-tight",
                        step.completed
                          ? "text-muted-foreground line-through decoration-muted-foreground/30"
                          : "text-foreground"
                      )}
                    >
                      {step.title}
                    </span>
                    <span className="block text-[10.5px] text-muted-foreground/80 mt-0.5 line-clamp-1">
                      {step.description}
                    </span>
                  </span>
                  {!step.completed && (
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        {allComplete && (
          <p className="mt-3 text-center text-[11px] font-medium text-growth-sage dark:text-growth-sage">
            <Sparkles className="inline h-3 w-3 mr-1" />
            You&apos;re all set — happy learning!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mark that the student has visited /courses. Call from the public
 * marketplace page (client-side) so the OnboardingGuide step 1 lights up.
 */
export function markVisitedCourses(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(STORAGE_VISITED_KEY) === "1") return;
  localStorage.setItem(STORAGE_VISITED_KEY, "1");
  // Dispatch a storage-like event so the onboarding card in another tab
  // (or the same tab if it's mounted) can react.
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_VISITED_KEY, newValue: "1" }));
}

/** Reset the dismissed + visited flags — used in dev / for testing. */
export function resetOnboardingState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_DISMISS_KEY);
  localStorage.removeItem(STORAGE_VISITED_KEY);
}

// Re-export Circle for callers that want to render an empty step icon.
export { Circle };
