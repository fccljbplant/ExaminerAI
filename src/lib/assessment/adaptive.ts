// FILE: src/lib/assessment/adaptive.ts
// Adaptive difficulty engine. Replaces the static QUESTION_TYPES ladder
// in daily-test/route.ts. Difficulty moves with scores + the trainee's
// OWN tapped confidence (explicit, transparent — no hedging-word heuristics).

export interface DifficultyState {
  level: number;      // 1..5
  streak: number;     // consecutive strong answers
  history: number[];  // last 8 scores (0-100)
}

export interface AnswerOutcome {
  score: number;                            // 0-100 from unified grader
  selfConfidence: "sure" | "guessing";      // explicit tap from trainee BEFORE answering
}

export const DEFAULT_STATE: DifficultyState = { level: 1, streak: 0, history: [] };

/** Compute the next difficulty state given the latest answer outcome.
 *  - score >= 75: streak grows; 2+ streak → level up
 *  - score < 50: streak resets; level softens (prevents spiral)
 *  - confident + wrong: hold at a level where evidence rebuilds understanding
 */
export function nextState(state: DifficultyState, outcome: AnswerOutcome): DifficultyState {
  const history = [...state.history, outcome.score].slice(-8);
  let { level, streak } = state;

  if (outcome.score >= 75) {
    streak += 1;
    if (streak >= 2 && level < 5) { level += 1; streak = 0; } // earn the next level
  } else if (outcome.score < 50) {
    streak = 0;
    if (level > 1) level -= 1;                                 // soften before they spiral
  } else {
    streak = 0;
  }

  // Calibration guard: confident + wrong => hold them at a level where
  // evidence rebuilds real understanding. Visible to trainee as "focus level".
  if (outcome.selfConfidence === "sure" && outcome.score < 55 && level > 1) {
    level = Math.max(1, level - 1);
  }
  return { level, streak, history };
}

/** Map a difficulty level (1-5) to a directive the AI uses to phrase the next question. */
export function questionDirective(level: number): string {
  const directives = [
    "Ask a warm-up question checking basic vocabulary and definitions.",
    "Ask a core question checking understanding of how and why.",
    "Ask a stretch question applying the concept to a realistic workplace situation.",
    "Ask an advanced question about trade-offs, failure modes, or diagnosis.",
    "Ask an expert question combining multiple concepts under real-world constraints.",
  ];
  return directives[Math.min(Math.max(level, 1), 5) - 1];
}

/** Transparent calibration flag — shown openly to the trainee, not used for hidden profiling. */
export function calibrationFlag(outcome: AnswerOutcome): "calibrated" | "overconfident" | "underconfident" {
  if (outcome.selfConfidence === "sure" && outcome.score < 55) return "overconfident";
  if (outcome.selfConfidence === "guessing" && outcome.score >= 80) return "underconfident";
  return "calibrated";
}

/** Human-readable label for the difficulty level (shown in the UI). */
export function levelLabel(level: number): string {
  const labels = ["Warm-up", "Core", "Stretch", "Advanced", "Expert"];
  return labels[Math.min(Math.max(level, 1), 5) - 1];
}
