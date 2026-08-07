"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Star, ThumbsUp, Loader2, MessageSquare, PenLine, AlertCircle, CheckCircle2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

/**
 * ReviewSection — client component shown on the public course detail page.
 *
 * Fetches + displays the course's reviews, average rating, and (for logged-in
 * students who completed the course) a "Write a Review" form.
 *
 * Data flow:
 *   - GET  /api/marketplace/courses/[id]/reviews        — list + stats
 *   - GET  /api/auth/me + /api/enrollments              — auth state + completion
 *   - POST /api/marketplace/courses/[id]/reviews        — submit review
 *   - POST /api/marketplace/courses/[id]/reviews/[reviewId]/helpful — upvote
 */
interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  createdAt: string;
  userId: string;
  userName: string;
}
interface ReviewsResponse {
  reviews: Review[];
  total: number;
  avgRating: number;
}
interface MeResponse {
  user: { id: string; role: string; email: string } | null;
}
interface EnrollmentsResponse {
  enrollments: Array<{ courseId: string; role: string }>;
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export default function ReviewSection({ courseId }: { courseId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  const [authState, setAuthState] = useState<"loading" | "anon" | "student" | "student-enrolled" | "staff">("loading");
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);

  // Form state
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Track which reviews the current user has upvoted (optimistic UI).
  const [votedReviewIds, setVotedReviewIds] = useState<Set<string>>(new Set());

  const loadReviews = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get<ReviewsResponse>(`/api/marketplace/courses/${courseId}/reviews`);
      setReviews(data.reviews || []);
      setAvgRating(data.avgRating || 0);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  // Determine auth state + whether the student is allowed to review.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.get<MeResponse>("/api/auth/me");
        if (!me.user || cancelled) {
          if (!cancelled) setAuthState("anon");
          return;
        }
        const role = me.user.role;
        const staff = [
          "instructor", "coordinator", "counselor", "principal",
          "administrator", "demo", "admin", "teacher", "teaching_assistant",
        ];
        if (staff.includes(role)) {
          if (!cancelled) setAuthState("staff");
          return;
        }
        // Student — check enrollment.
        try {
          const en = await api.get<EnrollmentsResponse>("/api/enrollments");
          if (cancelled) return;
          const enrolled = (en.enrollments || []).some(
            (e) => e.courseId === courseId && e.role === "student"
          );
          setAuthState(enrolled ? "student-enrolled" : "student");
          // Review permission is gated by the API itself; the form will
          // surface any 403 from the server. We optimistically show the
          // button when enrolled — the server is the source of truth for
          // "completed the course".
          if (enrolled) setCanReview(true);
        } catch {
          if (!cancelled) setAuthState("student");
        }
      } catch {
        if (!cancelled) setAuthState("anon");
      }
    })();
    return () => { cancelled = true; };
  }, [courseId]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  // Mark reviews the current user has already upvoted (best-effort — we
  // check via a HEAD-style request below per review). For simplicity in this
  // first cut, we optimistically track votes by clicking.
  const submitReview = async () => {
    setSubmitError(null);
    if (title.trim().length === 0) {
      setSubmitError("Please add a short title.");
      return;
    }
    if (content.trim().length === 0) {
      setSubmitError("Please write a few sentences in your review.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/marketplace/courses/${courseId}/reviews`, {
        rating, title: title.trim(), content: content.trim(),
      });
      setHasReviewed(true);
      setReviewFormOpen(false);
      setTitle("");
      setContent("");
      setRating(5);
      await loadReviews();
    } catch (e) {
      if (e instanceof ApiError) {
        setSubmitError(e.message);
      } else {
        setSubmitError(e instanceof Error ? e.message : "Failed to submit review");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: string, currentHelpful: number) => {
    const alreadyVoted = votedReviewIds.has(reviewId);
    // Optimistic update.
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, helpful: alreadyVoted ? r.helpful - 1 : r.helpful + 1 }
          : r
      )
    );
    setVotedReviewIds((prev) => {
      const next = new Set(prev);
      if (alreadyVoted) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
    try {
      await api.post(
        `/api/marketplace/courses/${courseId}/reviews/${reviewId}/helpful`,
        {}
      );
    } catch {
      // Revert on failure.
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, helpful: currentHelpful } : r
        )
      );
      setVotedReviewIds((prev) => {
        const next = new Set(prev);
        if (alreadyVoted) next.add(reviewId);
        else next.delete(reviewId);
        return next;
      });
    }
  };

  // ------------------------------------------------------------------------

  if (loading) {
    return (
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" /> Reviews
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" /> Reviews
        </h2>
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
        <Star className="h-5 w-5 text-primary" /> Reviews
      </h2>

      {/* Rating summary */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold">{avgRating.toFixed(1)}</span>
          <div className="flex">
            {STAR_VALUES.map((s) => (
              <Star
                key={s}
                className={`h-4 w-4 ${
                  s <= Math.round(avgRating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            ({total} review{total === 1 ? "" : "s"})
          </span>
        </div>

        {/* Write-a-review CTA */}
        {authState === "anon" && (
          <p className="text-xs text-muted-foreground">
            Sign in + complete the course to leave a review.
          </p>
        )}
        {authState === "student" && !canReview && (
          <p className="text-xs text-muted-foreground">
            Enroll in this course to leave a review.
          </p>
        )}
        {canReview && !hasReviewed && (
          <Dialog open={reviewFormOpen} onOpenChange={setReviewFormOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <PenLine className="h-3.5 w-3.5" /> Write a Review
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Write a Review</DialogTitle>
                <DialogDescription>
                  Share your experience to help future students decide.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Your rating</label>
                  <div className="flex gap-1">
                    {STAR_VALUES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        aria-label={`Rate ${s} stars`}
                        className="p-1"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            s <= rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/40 hover:text-amber-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Summarize your experience"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Review</label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What did you like? What could be better? Was the capstone project valuable?"
                    rows={5}
                    maxLength={5000}
                  />
                </div>
                {submitError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {submitError}
                  </p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={submitReview} disabled={submitting}>
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Submit Review
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {hasReviewed && (
          <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/40">
            <CheckCircle2 className="h-3 w-3 mr-1" /> You've reviewed this course
          </Badge>
        )}
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-foreground">No reviews yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Be the first to review this course after completing it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const voted = votedReviewIds.has(r.id);
            return (
              <Card key={r.id} className="py-3">
                <CardContent className="px-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex">
                          {STAR_VALUES.map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${
                                s <= r.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          by {r.userName} · {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {r.content}
                  </p>
                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant={voted ? "default" : "ghost"}
                      onClick={() => handleHelpful(r.id, r.helpful)}
                      className={`h-7 text-xs ${voted ? "bg-primary/15 text-primary hover:bg-primary/20" : ""}`}
                    >
                      <ThumbsUp className={`h-3 w-3 ${voted ? "fill-current" : ""}`} />
                      Helpful ({r.helpful})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
