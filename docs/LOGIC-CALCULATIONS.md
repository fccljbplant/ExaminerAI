# TraineesAI · Logic & Calculations Reference

> Every formula, one source of truth.
> If a calculation lives in code, it lives here too.
> Updated every audit cycle.

---

## 1. Learning Signal (transparent 0–100 score)

**Purpose**: give the learner an honest, transparent "how am I doing?" number
that they can argue with. NOT a black-box behavioral score.

**Formula**:

```
learningSignal = 0.45 · avgScore
               + 0.30 · completion
               + 0.25 · activity
               − min(30, 10 · missedDeadlines)
```

| Component | Range | Source |
|---|---|---|
| `avgScore` | 0–100 | Mean of all graded test attempts (daily + weekly) |
| `completion` | 0–100 | `%` of project tasks completed this week |
| `activity` | 0–100 | Days with at least one daily log this week, normalized to 7 |
| `missedDeadlines` | integer | Count of tasks past `dueAt` and still incomplete |

**Tiers** (for UI coloring):

- `green` — score ≥ 70
- `amber` — 50 ≤ score < 70
- `red` — score < 50

**Trend** (vs previous 7-day window):

- `up` — current > previous + 5
- `down` — current < previous − 5
- `steady` — otherwise

**Implementation**: `src/lib/learning-signal.ts` → `recordLearningSignal(userId)`.

**Weights are documented** — they are not tunable per org (deliberate; the
signal must mean the same thing across cohorts).

---

## 2. Adaptive difficulty

**Purpose**: keep the learner in the zone of proximal development. Too easy =
boredom; too hard = frustration.

**Rules** (per learner, per topic):

| Trigger | Action |
|---|---|
| Score ≥ 75 on the same topic twice in a row | `level += 1` |
| Score < 50 on any test | `level -= 1` |
| Learner self-rates "sure" AND score < 55 | `level -= 1` (overconfident) |

**Levels**: `1` (noob) → `2` (beginner) → `3` (intermediate) → `4` (advanced)
→ `5` (expert). Floors at 1, caps at 5.

**Calibration flag** (separate from level):

- `overconfident` — self-rated "sure" AND score < 55
- `underconfident` — self-rated "guessing" AND score ≥ 80

The flag is surfaced to the mentor (not the learner). It informs the
mentor's next message but does not affect the score.

**Implementation**: `src/modules/assessment/lib/unified-test-engine.ts` +
`src/lib/learning-signal.ts`.

---

## 3. Test score

**Purpose**: the final number a learner sees on a completed test.

**Formula**:

```
rawScore = mean(perQuestionGraderScores)
finalScore = max(hardFloor, rawScore − plagiarismDeduction)
```

| Component | Range | Source |
|---|---|---|
| `perQuestionGraderScores` | 0–100 each | `gradeOneQuestion` (unified grader) |
| `plagiarismDeduction` | 0–25 | `src/lib/plagiarism-scoring.ts` |
| `hardFloor` | configurable, default 40 | `GRADING.hardFloorPercent` (env: `GRADING_HARD_FLOOR`) |

**Hard floor**: a learner who attempts every question cannot score below
`hardFloor`. The floor is configurable (some orgs want 50, others 30) and
documented in `src/lib/constants.ts`.

**Plagiarism deduction**: detected similarity to model answer + detected
copy-paste from external sources. Max deduction is 25 (so a learner with
60 raw loses 25 → 35, but the floor catches them at 40).

**Implementation**: `src/lib/unified-grader.ts` → `gradeTest()` +
`src/lib/plagiarism-scoring.ts` → `applyPlagiarismDeduction()`.

---

## 4. Test question counts (single source of truth)

**Purpose**: end the "config says 15, prompt says 10" mismatch forever.

**Constant**: `TEST_QUESTION_COUNT` in `src/lib/constants.ts`.

```ts
export const TEST_QUESTION_COUNT = {
  daily: 3,
  weekly: 10,
  practice: 1,
} as const;
```

| Test type | Question count | Max replies per question |
|---|---|---|
| Practice | 1 | 3 |
| Daily test | 3 | 2 |
| Weekly test | 10 | 5 |

**Every consumer imports from `constants.ts`** — no hardcoded numbers in
route files, prompt templates, or UI copy.

The weekly-test system prompt interpolates `${DEFAULT_TOTAL_QUESTIONS}` so
the prompt and the constant can never drift again.

**Audit**: `scripts/ui-backend-audit.sh` section F greps for `15 questions`
and `questionCount: 15` — must return clean.

---

## 5. Daily topic pick

**Purpose**: each weekday maps to one topic from the week's topic list. Keeps
the daily test focused and predictable.

**Rule**:

| Day | Topic |
|---|---|
| Monday | `topics[0]` |
| Tuesday | `topics[1]` |
| Wednesday | `topics[2]` |
| Thursday | `topics[3]` |
| Friday | `topics[4]` |
| Saturday / Sunday | last topic (`topics[4]`) — review day |
| Fallback (no topics) | `topics[0]` or a default |

**Implementation**: `src/lib/course-db.ts` → `getCourseWeekTopicTitles(userId, week)`.

---

## 6. Course week computation

**Purpose**: figure out which week of the course the learner is in. Was a
past bug source — needs a regression test.

**Rule**:

| Mode | Computation |
|---|---|
| Self-paced | `user.currentWeek` (stored on the user row, advanced on completion) |
| Cohort-paced | `computeCourseWeek(enrollment.startedAt)` — calendar math |

`computeCourseWeek` returns `Math.floor((now − startedAt) / 7_days) + 1`,
clamped to `[1, totalWeeks]`.

**Implementation**: `src/lib/course-db.ts` → `computeCourseWeek()`.

**Regression test**: `src/lib/__tests__/course-week.test.ts` (planned —
audit flagged this as needing coverage).

---

## 7. Drill scheduling (spaced repetition)

**Purpose**: wrong answers come back until the learner owns them.

**Rule**:

| Event | Action |
|---|---|
| Question score < 60 | Create `DrillCard` due in +48 h |
| Drill missed (score < 60 again) | Reschedule +2 d, increment `missCount` |
| Drill passed (score ≥ 80) | `masteredAt = now` (removed from queue) |
| `missCount` reaches 5 | Stop scheduling (mentor alert fires) |

**Spacing curve**: +2 d per miss. So a question missed 3 times comes back
at +48 h, then +4 d, then +6 d. The curve is intentionally aggressive in
the first week (learner sees it again soon) and gentle after that.

**Implementation**: `src/modules/assessment/lib/unified-test-engine.ts` →
`scheduleDrillCard()` + `src/app/api/ai/practice/route.ts`.

---

## 8. AI budget

**Purpose**: prevent runaway AI spend without breaking the learner
experience.

**Limits** (per feature, configurable via env):

| Feature | Token budget per call | Cache TTL | Per-user daily | RPM | RPD |
|---|---|---|---|---|---|
| Practice | 2 000 | 1 h | 50 | 20 | 200 |
| Daily test | 3 000 | 1 h | 20 | 10 | 100 |
| Weekly test | 8 000 | none (per-student) | 5 | 5 | 25 |
| Tutor | 4 000 | 1 h | 30 | 15 | 150 |
| Grader | 2 000 | none (per-student) | — | 30 | 300 |

**Cache**: `AICache` table. Key is a hash of the prompt + context. TTL is
1 h for shared prompts (practice, tutor) and disabled for per-student
calls (weekly test, grader).

**Per-user daily limit**: enforced by `src/lib/ai-rate-limits.ts` →
`checkUserAILimit(userId, category)`. Returns `{ allowed, used, limit,
resetAt }`.

**Demo gating**: demo accounts (`@demo.ai`) can be globally blocked from AI
calls by an admin toggle. Useful for sales demos and training environments.

**Implementation**: `src/lib/ai-provider.ts` (`TOKEN_BUDGET`) +
`src/lib/ai-rate-limits.ts`.

---

## 9. Plagiarism scoring

**Purpose**: detect when a learner copy-pasted from the model answer or an
external source. Deduct score, but never below the hard floor.

**Detection**:

- **Model-answer similarity**: cosine similarity of embeddings (or simple
  token-overlap for short answers) between the learner's reply and the
  model answer. Threshold: > 0.85 → flag.
- **External-source similarity**: same metric vs a corpus of common
  Stack Overflow / docs snippets. Threshold: > 0.90 → flag.
- **Verbatim copy-paste**: detect exact 50-char substrings from the
  model answer. Always flag.

**Deduction**:

| Flags | Deduction |
|---|---|
| 0 flags | 0 |
| 1 flag | 10 |
| 2 flags | 20 |
| 3 flags (or verbatim) | 25 (max) |

**Implementation**: `src/lib/plagiarism-scoring.ts` →
`applyPlagiarismDeduction(rawScore, flags)`.

---

## 10. Streak computation

**Purpose**: a learner's current consecutive-days-with-activity streak.

**Rule**:

1. Collect `DailyLog` dates for the last 30 days.
2. Normalise to date-only (midnight UTC), dedupe.
3. Sort descending.
4. If the most recent date is today or yesterday → streak starts at 1.
   Otherwise → streak is 0.
5. Walk backwards; each consecutive day adds 1. First gap breaks the streak.

**Implementation**: `src/app/api/today/summary/route.ts` → `computeStreak()`.

---

## 11. Score-to-grade conversion

| Score | Grade | Color |
|---|---|---|
| ≥ 90 | A | emerald |
| ≥ 80 | B | lime |
| ≥ 70 | C | amber |
| ≥ 60 | D | orange |
| < 60 | F | red |

**Implementation**: `src/lib/constants.ts` → `scoreToGrade()` +
`gradeColor()`.

---

## 11a. Evidence-Locked XP (learners only)

**Purpose**: give learners a trust signal for employers. XP is earned ONLY
from verified, AI-graded actions — never from engagement metrics (login,
posting, commenting). This makes XP a credential, not engagement bait.

**Awards** (single source of truth in `src/lib/learner-xp.ts`):

| Action | XP | Condition |
|---|---|---|
| Daily test passed | +20 | Score ≥ 60 |
| Daily test aced | +30 (bonus) | Score ≥ 90 |
| Weekly test passed | +50 | Score ≥ 60 |
| Weekly test aced | +80 (bonus) | Score ≥ 90 |
| Drill card mastered | +10 | Spaced-repetition mastery |
| Project week completed | +40 | All week's tasks done |
| Project milestone signed | +60 | Mentor signs off |

**What does NOT earn XP**: logging in, posting a comment, messaging the
mentor, watching a video, "engaging" with content. These are important
but don't demonstrate competence.

**Levels** (casual-yet-professional labels, not LMS-speak):

| Level | XP range | Label | Hint |
|---|---|---|---|
| 1 | 0 – 99 | Just started | Welcome. Take your first daily test. |
| 2 | 100 – 299 | Finding their feet | Daily tests are adding up. |
| 3 | 300 – 599 | Building confidence | You've passed a weekly test. |
| 4 | 600 – 999 | Getting solid | Multiple weeks down. |
| 5 | 1000 – 1499 | Capstone-ready | Present your project with confidence. |
| 6 | 1500 – 2199 | Job-ready | Capstone signed off. Time to apply. |
| 7 | 2200+ | Mentor-tier | You could mentor a peer. |

**Idempotency**: `awardXP()` checks for existing `reason` + `refId` before
awarding. No double-XP on webhook retry or page refresh.

**Storage**: XP awards stored inside `User.journeyProgress` JSON field.
No schema migration needed.

**Implementation**: `src/lib/learner-xp.ts` → `awardXP()`, `getLearnerXP()`,
`levelForXp()`, `levelProgress()`. API at `/api/learner/xp`.

---

## 12. Formula change protocol

Every formula change must:

1. Update this document (the formula description).
2. Update the implementation (with a regression test).
3. Update the audit script if the change introduces a new red line.
4. Be reviewed by someone who didn't write the change.

If a formula is in code but not in this document, that's a bug — open an
issue. The document is the source of truth, not the code.
