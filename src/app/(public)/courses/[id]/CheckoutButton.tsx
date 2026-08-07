"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Loader2, LogIn, ArrowRight, CheckCircle2, GraduationCap, CreditCard,
  ShieldCheck, Sparkles, Award, X, AlertCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

/**
 * CheckoutButton — B2C checkout flow on the public course detail page.
 *
 * Extends the basic EnrollButton flow with a price-aware CTA:
 *
 *   - Free course    → "Enroll Free" — direct POST /api/marketplace/enroll
 *   - Paid course    → "Enroll for $X" — opens a checkout dialog
 *     - Dialog shows: course name, price, what's included
 *     - "Proceed to Payment" → for now, still calls /api/marketplace/enroll
 *       (Stripe integration is a TODO — the dialog shows a "coming soon"
 *        notice, but we still enroll the student so they can start learning).
 *     - "Maybe Later" → cancel
 *   - Already enrolled → "Enrolled! Continue Learning →"
 *   - Anonymous       → "Sign in to Enroll" (links to /app)
 *   - Staff           → "View as Instructor" (links to /app)
 *
 * Auth-state logic mirrors EnrollButton so this can serve as a drop-in
 * replacement for the simple CTA.
 */

type AuthState = "loading" | "anon" | "student" | "student-enrolled" | "staff";

interface MeResponse {
  user: { id: string; role: string; email: string } | null;
}
interface EnrollmentsResponse {
  enrollments: Array<{ courseId: string; role: string }>;
}

export default function CheckoutButton({
  courseId,
  courseName,
  price,
  currency,
}: {
  courseId: string;
  courseName: string;
  price: number;
  currency: string;
}) {
  const isFree = price === 0;
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justEnrolled, setJustEnrolled] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>("/api/auth/me");
      if (!me.user) {
        setAuthState("anon");
        return;
      }
      const role = me.user.role;
      const staff = [
        "instructor", "coordinator", "counselor", "principal",
        "administrator", "demo", "admin", "teacher", "teaching_assistant",
      ];
      if (staff.includes(role)) {
        setAuthState("staff");
        return;
      }
      try {
        const en = await api.get<EnrollmentsResponse>("/api/enrollments");
        const enrolled = (en.enrollments || []).some(
          (e) => e.courseId === courseId && e.role === "student"
        );
        setAuthState(enrolled ? "student-enrolled" : "student");
      } catch {
        setAuthState("student");
      }
    } catch {
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
      setCheckoutOpen(false);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409) {
          // Already enrolled — treat as soft success.
          setJustEnrolled(true);
          setAuthState("student-enrolled");
          setCheckoutOpen(false);
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

  // ---- Render branches --------------------------------------------------

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
        <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
  const priceLabel = isFree
    ? "Free"
    : `${currency} ${price.toFixed(2)}`;

  return (
    <div className="flex flex-col gap-2">
      {isFree ? (
        <Button size="lg" onClick={enroll} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Enroll Free
          {!busy && <ArrowRight className="h-4 w-4" />}
        </Button>
      ) : (
        <>
          <Button size="lg" onClick={() => setCheckoutOpen(true)} disabled={busy}>
            <CreditCard className="h-4 w-4" />
            Enroll for {priceLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>

          <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Checkout
                </DialogTitle>
                <DialogDescription>
                  Review your order and proceed to payment.
                </DialogDescription>
              </DialogHeader>

              {/* Order summary */}
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-background/50 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold leading-tight">{courseName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Full course access</p>
                    </div>
                    <span className="text-lg font-bold">{priceLabel}</span>
                  </div>
                </div>

                {/* What's included */}
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> You&apos;ll get:
                  </p>
                  <ul className="space-y-1.5 text-xs text-foreground/80">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
                      <span>Full course access — every lesson, every week</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
                      <span>AI tutor — Socratic guidance, practice tests, weekly assessments</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Award className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                      <span>Verified certificate on completion (score ≥ 75) — public verification URL</span>
                    </li>
                  </ul>
                </div>

                {/* Payment integration notice */}
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5 leading-snug">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Payment integration coming soon.</strong> Clicking
                      &quot;Proceed to Payment&quot; will enroll you now (no charge) so you
                      can start learning immediately. Stripe checkout will be added in a
                      future release.
                    </span>
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <X className="h-3.5 w-3.5" /> {error}
                  </p>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    Maybe Later
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={enroll}
                  disabled={busy}
                  className="w-full sm:w-auto"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Proceed to Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        <span>Secure checkout · 30-day money-back guarantee</span>
      </div>
    </div>
  );
}
