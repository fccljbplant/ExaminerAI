/** Public, browser-safe constants for the ExaminerAI app. */

/** AI Tutor URL (NotebookLM notebook with bootcamp curriculum).
 *  Used as the fallback when a course doesn't have its own notebooklmUrl set. */
  "https://notebooklm.google.com/notebook/f13b0673-42aa-40d1-a5e9-510f889b8bcd";

/** The 4 Socratic assessment pillars. Each weekly test question targets one. */
export const PILLARS = [
  "Why Probe",
  "Break-It Scenario",
  "Client Translation",
  "Edge Case Test",
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
