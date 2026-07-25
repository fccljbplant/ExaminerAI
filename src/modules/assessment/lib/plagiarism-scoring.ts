/**
 * Plagiarism scoring — deduction formula + student-facing display.
 *
 * The user's requirement: "Show plagiarism detection to students and deduct
 * extra marks because of plagiarism. Draw a method to deduct marks on
 * percentage of plagiarism. 100% means 0 marks."
 *
 * Formula:
 *   finalScore = rawScore × (1 − plagiarismScore / 100)
 *
 * Examples:
 *   rawScore=80, plagiarism=0%  → finalScore = 80 × 1.0   = 80 (no deduction)
 *   rawScore=80, plagiarism=20% → finalScore = 80 × 0.8   = 64
 *   rawScore=80, plagiarism=50% → finalScore = 80 × 0.5   = 40
 *   rawScore=80, plagiarism=100%→ finalScore = 80 × 0.0   = 0  (100% = 0 marks)
 *   rawScore=90, plagiarism=30% → finalScore = 90 × 0.7   = 63
 *
 * The deduction is always shown to the student transparently:
 *   "Raw score: 80% | Plagiarism detected: 20% | Marks deducted: 16 | Final score: 64%"
 */

export interface PlagiarismResult {
  rawScore: number;        // score before deduction (0-100)
  plagiarismScore: number; // plagiarism percentage (0-100)
  deductedMarks: number;   // how many marks were deducted
  finalScore: number;      // score after deduction (0-100)
  deductionPercent: number; // percentage of marks deducted (= plagiarismScore)
}

/** Calculate the final score after plagiarism deduction. */
export function applyPlagiarismDeduction(
  rawScore: number,
  plagiarismScore: number | null | undefined,
): PlagiarismResult {
  const plagiarism = Math.max(0, Math.min(100, plagiarismScore ?? 0));
  const raw = Math.max(0, Math.min(100, rawScore));
  const deductionMultiplier = 1 - plagiarism / 100;
  const finalScore = Math.round(raw * deductionMultiplier);
  const deductedMarks = raw - finalScore;

  return {
    rawScore: raw,
    plagiarismScore: plagiarism,
    deductedMarks,
    finalScore,
    deductionPercent: plagiarism,
  };
}

/** Get a human-readable plagiarism label for display. */
export function plagiarismLabel(score: number): string {
  if (score === 0) return "No plagiarism detected";
  if (score <= 10) return "Genuinely your own work";
  if (score <= 30) return "Mostly genuine — minor concerns";
  if (score <= 50) return "Some answers may need review";
  if (score <= 70) return "Likely used AI on multiple answers";
  if (score <= 90) return "Very likely cheated on several answers";
  return "Almost certainly copied";
}

/** Get the color class for a plagiarism score badge. */
export function plagiarismColor(score: number): string {
  if (score <= 10) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
  if (score <= 30) return "bg-lime-500/10 text-lime-600 border-lime-500/30";
  if (score <= 50) return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  if (score <= 70) return "bg-orange-500/10 text-orange-600 border-orange-500/30";
  return "bg-red-500/10 text-red-600 border-red-500/30";
}
