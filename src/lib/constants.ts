/** Public, browser-safe constants for the TraineesAI app. */

/** The 4 Socratic assessment pillars. Each weekly test question targets one. */
export const PILLARS = [
  "Why Probe",
  "Break-It Scenario",
  "Client Translation",
  "Edge Case Test",
] as const;

/** Single source of truth for test structure. */
export const TEST_QUESTION_COUNT = {
  daily: 3,
  weekly: 10,
  practice: 1,
} as const;

export const MAX_REPLIES_PER_QUESTION = 2;

export const GRADING = {
  hardFloorPercent: Number(process.env.GRADING_HARD_FLOOR ?? 40),
  plagiarismMaxDeduction: 25,
};

export const MARKETPLACE_CATEGORIES = [
  { value: "technology", label: "Technology & Software" },
  { value: "engineering", label: "Engineering" },
  { value: "business", label: "Business & Management" },
  { value: "finance", label: "Finance & Accounting" },
  { value: "healthcare", label: "Healthcare & Safety" },
  { value: "manufacturing", label: "Manufacturing & Operations" },
  { value: "hr", label: "Human Resources" },
  { value: "compliance", label: "Compliance & Regulatory" },
  { value: "soft-skills", label: "Professional Skills" },
  { value: "other", label: "Other" },
] as const;

/** Convert a 0-100 score to a letter grade. */
export function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/** Tailwind text color class for a letter grade. */
export function gradeColor(grade: string): string {
  if (grade === "A") return "text-emerald-500";
  if (grade === "B") return "text-lime-500";
  if (grade === "C") return "text-amber-500";
  if (grade === "D") return "text-orange-500";
  return "text-red-500";
}
