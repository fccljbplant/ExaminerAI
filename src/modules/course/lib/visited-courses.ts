/**
 * modules/course/lib/visited-courses.ts — public marketplace visitor flag
 *
 * Marks that a visitor has browsed /courses so the learner onboarding
 * guide can light up step 1. Extracted from the deleted examiner
 * OnboardingGuide at W10 cutover.
 */

const STORAGE_VISITED_KEY = "examiner-visited-courses";

export function markVisitedCourses(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(STORAGE_VISITED_KEY) === "1") return;
  localStorage.setItem(STORAGE_VISITED_KEY, "1");
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_VISITED_KEY, newValue: "1" }));
}
