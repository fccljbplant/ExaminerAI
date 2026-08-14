"use client";

import { useEffect } from "react";
import { markVisitedCourses } from "@/modules/course/lib/visited-courses";

/**
 * VisitedCoursesTracker — invisible client component.
 *
 * Mounts inside the public /courses marketplace page so we can mark, in
 * localStorage, that the student has visited the marketplace. The
 * OnboardingGuide uses this flag to light up step 1 ("Browse Courses").
 *
 * Renders nothing — it's a side-effect-only component.
 */
export function VisitedCoursesTracker() {
  useEffect(() => {
    markVisitedCourses();
  }, []);
  return null;
}
