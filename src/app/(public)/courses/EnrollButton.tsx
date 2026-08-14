"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/modules/ui/button";
import { Loader2, LogIn, ArrowRight, CheckCircle2, GraduationCap, Eye } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

/**
 * EnrollButton — client component rendered on the public course detail page.
 *
 * It calls `/api/auth/me` on mount to determine the visitor's auth state, then
 * renders the appropriate CTA:
 *
 *   - Not logged in         → "Sign in to Enroll" (links to /app)
 *   - Logged in as student  → "Enroll Now" — POSTs to /api/marketplace/enroll
 *   - Already enrolled      → "Continue Learning" (links to /app)
 *   - Instructor / admin    → "View as Instructor" (links to /app)
 *
 * After a successful enroll, the button swaps to a success state with a
 * "Continue Learning →" link so the student can jump straight into the course.
 */

type AuthState = "loading" | "anon" | "student" | "student-enrolled" | "staff";

interface MeResponse {
  user: {
    id: string;
    role: string;
    email: string;
  } | null;
}

interface EnrollmentsResponse {
  enrollments: Array<{ courseId: string; role: string }>;
}

export default function EnrollButton({ courseId }: { courseId: string }) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justEnrolled, setJustEnrolled] = useState(false);

  // Fetch the current user + their enrollments in parallel to determine
  // whether to render "Sign in", "Enroll Now", or "Continue Learning".
  const checkAuth = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>("/api/auth/me");
      if (!me.user) {
        setAuthState("anon");
        return;
      }
      const role = me.user.role;
      // Staff roles (instructor, coordinator, counselor, principal,
      // administrator, demo) get a "View as Instructor" CTA — they manage
      // enrollments through the admin panel, not via self-enroll.
      const staff = [
        "instructor",
        "coordinator",
        "counselor",
        "principal",
        "administrator",
        "demo",
        "admin",
        "teacher",
        "teaching_assistant",
      ];
      if (staff.includes(role)) {
        setAuthState("staff");
        return;
      }
      // Student — check if already enrolled in this course.
      try {
        const en = await api.get<EnrollmentsResponse>("/api/enrollments");
        const enrolled = (en.enrollments || []).some(
          (e) => e.courseId === courseId && e.role === "student"
        );
        setAuthState(enrolled ? "student-enrolled" : "student");
      } catch {
        // If the enrollments lookup fails, still let them try to enroll.
        setAuthState("student");
      }
    } catch {
      // /api/auth/me returns 200 with {user: null} when logged out, but be
      // defensive: any failure means treat as anonymous.
      setAuthState("anon");
    }
  }, [courseId]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const enroll = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/marketplace/enroll`, { courseId });
      setJustEnrolled(true);
      setAuthState("student-enrolled");
    } catch (e) {
      if (e instanceof ApiError) {
        // 409 = already enrolled — surface as a soft success.
        if (e.status === 409) {
          setJustEnrolled(true);
          setAuthState("student-enrolled");
          return;
        }
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Failed to enroll");
      }
    } finally {
      setBusy(false);
    }
  }, [courseId]);

  // ---- Render branches -----------------------------------------------------

  if (authState === "loading") {
    return (
      <Button size="lg" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (justEnrolled || authState === "student-enrolled") {
    return (
      <div className="flex flex-col gap-2">
        <Button asChild size="lg" className="bg-brand text-on-brand hover:bg-brand/90">
          <Link href="/app">
            <CheckCircle2 className="h-4 w-4" />
            {justEnrolled ? "Enrolled! Continue Learning" : "Continue Learning"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  if (authState === "anon") {
    return (
      <Button asChild size="lg">
        <Link href="/app">
          <LogIn className="h-4 w-4" />
          Sign in to Enroll
        </Link>
      </Button>
    );
  }

  if (authState === "staff") {
    return (
      <Button asChild size="lg" variant="outline">
        <Link href="/app">
          <GraduationCap className="h-4 w-4" />
          View as Instructor
        </Link>
      </Button>
    );
  }

  // authState === "student"
  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" onClick={enroll} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Enroll Now
        {!busy && <ArrowRight className="h-4 w-4" />}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-1 text-xs text-fg-muted">
        <Eye className="h-3 w-3" />
        <span>You&apos;ll get instant access to all lessons + the capstone project.</span>
      </div>
    </div>
  );
}
