# Section 3 — Calculations & AI Logic (ExaminerAI)

Permanent reference for **every** scoring / calculation formula in the app,
**every** psychological / behavioral inference the app makes, and **every**
place an AI output can affect a real person's record.

This is the live reference document. It supersedes the prior "Section 5"
draft that lived in this file. Formulas, thresholds, and prompt wording are
verified against the current source code as of this audit (worklog Task 9
complete; Task 10 = this audit).

Three lenses are applied throughout:

- **AI analyst** — does the math actually compute what the label claims?
- **Psychologist / psychiatrist (informational)** — does the inference
  respect evidence boundaries? Does it avoid clinical language?
- **Senior coder** — is the code correct, deterministic where it claims to
  be, and safe against edge cases?

All file paths are absolute from repo root. Line numbers are accurate as of
this audit.

---

## Table of contents

1. [Calculation formulas](#1-calculation-formulas)
   1.1 [Letter-grade computation (scoreToGrade + gradeColor)](#11-letter-grade-computation-scoretograde--gradecolor)
   1.2 [Wellbeing tier computation (green / warning / red)](#12-wellbeing-tier-computation-green--warning--red)
   1.3 [Teacher load tiers (two implementations)](#13-teacher-load-tiers-two-implementations)
   1.4 [The seven psychological dimensions](#14-the-seven-psychological-dimensions)
   1.5 [Escalation triggers (amber → red)](#15-escalation-triggers-amber--red)
   1.6 [Attention score (teacher dashboard)](#16-attention-score-teacher-dashboard)
   1.7 [Skill mastery — rolling average](#17-skill-mastery--rolling-average)
   1.8 [Project task generation — course-aligned planner](#18-project-task-generation--course-aligned-planner)
   1.9 [Certificate grade + score](#19-certificate-grade--score)
   1.10 [Final result / career readiness](#110-final-result--career-readiness)
   1.11 [14-day rolling consistency + streak](#111-14-day-rolling-consistency--streak)
   1.12 [Report-card composite score](#112-report-card-composite-score)
   1.13 [Plagiarism deduction](#113-plagiarism-deduction)
   1.14 [AI rate limits](#114-ai-rate-limits)
   1.15 [Self-paced anti-cheat flags](#115-self-paced-anti-cheat-flags)
   1.16 [Calibration gap](#116-calibration-gap)
2. [Psychological / behavioral inference audit](#2-psychological--behavioral-inference-audit)
3. [AI-drafts-humans-decide rule audit](#3-ai-drafts-humans-decide-rule-audit)
4. [Findings & required fixes](#4-findings--required-fixes)
5. [What's working well](#5-whats-working-well)
6. [Learn test difficulty adaptation (learner-paced model)](#6-learn-test-difficulty-adaptation-2026-09-learner-paced-model)

---

## 1. Calculation formulas

### 1.1 Letter-grade computation (scoreToGrade + gradeColor)

**Files:**
- `/home/z/my-project/src/lib/constants.ts` (lines 12–27)
- Duplicated private copy: `/home/z/my-project/src/modules/comprehensive-report/index.ts` (lines 195–201)

```ts
export function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function gradeColor(grade: string): string {
  if (grade === "A") return "text-emerald-500";
  if (grade === "B") return "text-lime-500";
  if (grade === "C") return "text-amber-500";
  if (grade === "D") return "text-orange-500";
  return "text-red-500";
}
```

| Score range | Grade | Tailwind color        |
|-------------|-------|-----------------------|
| 90–100      | A     | `text-emerald-500`    |
| 80–89       | B     | `text-lime-500`       |
| 70–79       | C     | `text-amber-500`      |
| 60–69       | D     | `text-orange-500`     |
| 0–59        | F     | `text-red-500`        |

**Inputs:** 0–100 numeric score. Clamping is the caller's responsibility.

**Used by:**
- Report-card auto-generation (`/api/students/[id]/generate-report-card/route.ts` line 86)
- Certificate approval (`/api/certificates/generate/route.ts` line 190)
- Final-result route (`/api/students/final-result/route.ts` lines 106, 112)
- Comprehensive report (`/modules/comprehensive-report/index.ts` line 391)
- Student-facing `FinalResultPanel.tsx`, `ReportCardPanel.tsx`,
  `ComprehensiveReportView.tsx`, `GuardianReportCards.tsx` (display only)

**Senior-coder notes:**
- No NaN/Infinity guard. `scoreToGrade(NaN)` falls through every `>=` check
  (NaN is incomparable) and returns `"F"`. All production callers clamp 0–100
  before invoking, but a defensive guard would be safer (Finding F-1).
- The duplicated private copy in `comprehensive-report/index.ts` should be
  removed and replaced with the shared import (Finding F-2).
- `gradeColor` returns `"text-red-500"` for any non-A/B/C/D input (including
  `"PENDING"` certificates, `null`, `undefined`) — that's the only sensible
  fallback, but the UI does pass `"PENDING"` from the certificate-request
  state; verify each caller handles the red color gracefully.

---

### 1.2 Wellbeing tier computation (green / warning / red)

**File:** `/home/z/my-project/src/modules/assessment/lib/analysis-pipeline.ts`
(lines 359–435), function `recomputeWellbeingState(userId)`

**Inputs:**
- `PsychEvidence` rows for the student, last 14 days, capped at 50 most recent.
- `CrisisFlag` count where `status = "open"`.

**Algorithm:**

1. If no `PsychEvidence` exists in the last 14 days AND no open crisis flags:
   - Decay tier → `green` (writes `reasonsJson = ["No concerning evidence in 14 days — tier decayed to green"]`).
   - Early return. *(lines 371–383)*
2. Classify each evidence row as **concerning**, **positive**, or neither:
   - **Concerning values** *(lines 386–395):* `overconfident`, `surface_answers`, `voice_inconsistency`, `fixed_mindset`, `avoidant`, `high_intrinsic`, `declining_recall`, `fragmented_recall`.
   - **Positive values** *(lines 397–404):* `well-calibrated`, `detailed_reasoning`, `growth_mindset`, `low_germane`, `improving_recall`, `fluent`.
3. Compute `ratio = concerning.length / max(evidence.length, 1)` *(line 406)*.
4. Tier from ratio:
   - `ratio > 0.6`  → **red** *(line 410)*
   - `ratio > 0.35` → **warning** *(line 413)*
   - else           → **green** *(line 416)*
5. If `openCrisisFlags > 0` → force **red** and append `"N open crisis flag(s)"` to reasons. *(lines 421–425)*
6. Upsert `WellbeingState { userId, tier, reasonsJson }`.

**Tier values persisted:** the DB column allows `"green" | "warning" | "red"`
only (Prisma enum). Legacy `"amber"` rows are normalized to `"warning"` at
read time by `normalizeTier()` in `/home/z/my-project/src/lib/rbac.ts`, used
at `/api/wellbeing-state/route.ts` line 29.

**Trigger:** `recomputeWellbeingState` runs as part of
`runAnalysisPipeline(input)` after every test completion (practice, daily,
weekly) — see line 47–62 of analysis-pipeline.ts.

**Important:** This writes **directly** to the DB — there is no human
confirmation step for the tier itself. (Human confirmation happens at the
*action* layer — see §3.) `escalateFlag` in escalation.ts can also overwrite
the tier to red without re-running the ratio computation (see §1.5).

**Senior-coder notes:**
- The `take: 50` cap on `PsychEvidence` rows means a student with very high
  test volume could have their tier computed on a non-representative sample.
  Probably fine for the bootcamp cadence, but worth flagging.
- `escalateFlag` writes `reasonsJson: JSON.stringify([reason])` — it
  **replaces** the array, losing the original ratio-based reasons. Consider
  concatenating rather than replacing.
- No audit-log entry is written when the tier changes. See §3.13.

---

### 1.3 Teacher load tiers (two implementations)

**Two implementations exist** and use different thresholds. They can
disagree for the same teacher at the same instant.

#### 1.3a `calculateTeacherLoad` — institution-wide roster (PRINCIPAL/ADMIN view)

**File:** `/home/z/my-project/src/lib/ai-assistant/teacher-load.ts` (lines 16–29, 49–142)

**Weights (lines 16–22):**
| Factor                  | Weight |
|-------------------------|--------|
| studentCount            | × 1    |
| batchCount              | × 15   |
| openAlerts              | × 5    |
| crisisFlags (red, open) | × 25   |
| overdueTouchpoints      | × 3    |

**Formula (lines 108–113):**
```
loadScore = studentCount × 1
          + batchCount × 15
          + openAlerts × 5
          + crisisFlags × 25
          + overdueTouchpoints × 3
```

**Tier thresholds (lines 25–29, 116–119):**
- `loadScore >= 100` → **red**
- `loadScore >= 50`  → **warning**
- else               → **green**

**Inputs (where each comes from):**
- `studentCount` — `User` rows where `role="student"`, `blocked=false`, in batches where the teacher is a `BatchTeacher`. *(lines 81–83)*
- `batchCount` — distinct `BatchTeacher.batchId` for the teacher. *(lines 74–78)*
- `openAlerts` — `StudentAlert` rows where `status="open"` for any student in the teacher's batches. *(lines 86–88)*
- `crisisFlags` — `CrisisFlag` rows where `status="open"` AND `severity="red"` for students in the teacher's batches. *(lines 91–97)*
- `overdueTouchpoints` — `MentorshipTouchpoint` rows where `actorUserId = teacherId` AND `followUpDate < now`. *(lines 100–105)*

**Reasons strings (lines 122–127):** Only emitted if specific sub-thresholds
are crossed: `studentCount > 30`, `batchCount > 2`, `openAlerts > 5`,
`crisisFlags > 0`, `overdueTouchpoints > 3`. These are *display* thresholds,
not tier-change thresholds — the tier is purely a function of `loadScore`.

**Trend (lines 176–194):** Compares `StudentAlert` count from last 7 days vs
previous 7 days (institution-wide, not per-teacher). `recentAlerts > previousAlerts → "worsening"`,
`< → "improving"`, else `"stable"`.

#### 1.3b `GET /api/teacher/load` — teacher self-view

**File:** `/home/z/my-project/src/app/api/teacher/load/route.ts` (lines 129–159)

This route computes its OWN tier from response-time + overdue-students +
crisis count, **not** from the §1.3a load score.

| Signal                                        | Amber when          | Red when             |
|-----------------------------------------------|---------------------|----------------------|
| This-week response time vs. rolling avg       | `> 2× avg`          | `> 4× avg`           |
| Overdue students (last touch > 7d or never)   | `> 5`               | `> 10`               |
| Open crisis flags (students)                  | —                   | `> 2`                |

Response time is computed from `Message` pairs (student → teacher reply),
ignoring gaps > 7d as "probably unrelated" (line 82).

**Findings:**
- §1.3a is a deterministic scalar load score; §1.3b is a rule-based tier.
- The two routes can disagree for the same teacher at the same instant
  (e.g. §1.3a says `green` because `loadScore=45`, but §1.3b says `red`
  because `overdueStudents=11`).
- The PRINCIPAL roster (`getInstitutionTeacherLoadRoster`) does not call
  §1.3b at all, so the principal's tier and the teacher's self-view tier
  may not match. (Finding F-10.)

---

### 1.4 The seven psychological dimensions

**Files:**
- `/home/z/my-project/src/modules/assessment/lib/analysis-pipeline.ts` (lines 92–274) — the actual computation
- `/home/z/my-project/src/components/examiner/teacher/PsychologicalTab.tsx` — UI explanations of each value
- `/home/z/my-project/docs/SEVEN-DIMENSIONS.md` — external-facing documentation

**Trigger:** `runAnalysisPipeline(input)` fires on every test completion
(practice, daily, weekly). All 7 dimensions are written on EVERY test — no
"no evidence" gap. One `PsychEvidence` row per dimension per test.

#### Dimension 1 — Calibration

**Inputs:** `input.answers[].confidenceRating` (`"low" | "medium" | "high" | null`) and `input.answers[].score`.

**Computation** *(lines 111–137):*
- For each answer with a confidence rating:
  - confidence score = `low → 1`, `medium → 3`, `high → 5`
  - `confidencePct = (avgConfidenceScore) × 20` (so 1→20%, 3→60%, 5→100%)
  - `avgActual = average of score across the same answers`
  - `gap = confidencePct − avgActual`
- **Value assignment:**
  - `gap > 20`  → `overconfident`
  - `gap < −20` → `underconfident`
  - else       → `well-calibrated`
- If no answers with confidence ratings exist → value = `no_self_rating`
  with evidence text "No confidence self-rating collected for this {testType}." *(lines 130–137)*

**Note on asymmetry:** daily tests capture `confidenceRating` (button press
before each answer); weekly and practice tests do not, so they always write
`no_self_rating` for this dimension.

#### Dimension 2 — Explanatory depth

**Inputs:** student messages in `input.conversation` (role === "student").

**Computation** *(lines 141–155):*
- `avgLen` = average character length of student messages.
- **Value:**
  - `avgLen < 50`         → `surface_answers`
  - `50 ≤ avgLen ≤ 300`   → `moderate_depth`
  - `avgLen > 300`        → `detailed_reasoning`

#### Dimension 3 — Gaming pattern

**Inputs:** `input.plagiarismScore` (0–100 or undefined).

**Computation** *(lines 158–166):*
- `plagiarismScore > 50` → `voice_inconsistency`
- `plagiarismScore ≤ 50` (defined) → `authentic_voice`
- `plagiarismScore === undefined` → `not_analyzed`

**Where plagiarismScore comes from:**
- Weekly tests: AI-generated `plagiarismScore` from the final-analysis prompt (`/api/ai/weekly-test/route.ts`).
- Daily tests: heuristic estimate from `estimatePlagiarismFromConversation()`.
- Practice tests: `plagiarismScore` not passed in — `not_analyzed`.

#### Dimension 4 — Attribution / mindset

**Inputs:** student message text (`allStudentText`) + `input.engagementFeedback?.avoidanceCount`.

**Computation** *(lines 169–185):*
- Growth signals (substring match): `learn`, `practice`, `try`, `improve`,
  `figure out`, `understand`, `next time`, `work on`, `get better`.
- Fixed signals (substring match): `can't`, `cant`, `im bad`, `not good at`,
  `never`, `always fail`, `stupid`, `dont know how`, `i don't know`, `skip`.
- **Value:**
  - `growthCount > 0 AND growthCount > fixedCount` → `growth_mindset`
  - `fixedCount > 0 AND fixedCount >= growthCount` → `fixed_mindset`
  - `avoidanceCount > 1` → `avoidant`
  - else → `neutral`

**Senior-coder note:** substring matching produces false positives — `try`
will match inside `country`, `interesting`, `ministry`; `learn` inside
`learner` is fine but `learn` inside `clearly not` is a hit. The signal
quality is heuristic. This is consistent with the file's stated "HEURISTIC,
not clinical" disclaimer (psych-analyzer.ts line 16), but worth flagging.

⚠️ The evidence text at line 181 still reads `"${avoidanceCount} avoidance
answers (\"I don't know\" / \"skip\") — may indicate anxiety or fixed-mindset
response."` — the word **"anxiety"** is a clinical term. See Finding F-5.

#### Dimension 5 — Cognitive load

**Inputs:** `input.score` (the post-plagiarism-deduction test score).

**Computation** *(lines 188–196):*
- `score < 40` → `high_intrinsic` ("material may be too difficult")
- `score ≥ 90` → `low_germane` ("material mastered")
- else → `moderate_load`

#### Dimension 6 — SRL phase (Self-Regulated Learning)

**Inputs:** student messages in `input.conversation`.

**Computation** *(lines 199–225):*
- If `studentMsgs.length >= 2`:
  - `avgLen > 200` → `reflection`
  - `firstAnswerLen > 100 AND lastAnswerLen < 50` → `performance` (with evidence text "Started detailed... but shortened over time... may indicate fatigue or waning engagement")
  - `avgLen < 50` → `forethought`
  - else → `performance`
- If `studentMsgs.length < 2` → default `performance` with text "Limited conversation data — insufficient for SRL phase inference."

#### Dimension 7 — Fluency / retention

**Inputs:** `input.answers` (per-question scores) OR `input.score` (fallback).

**Computation** *(lines 228–252):*
- If `input.answers.length >= 2`:
  - `trend = last.score − first.score`
  - `trend > 15` → `improving_recall`
  - `trend < −15` → `declining_recall`
  - else → `stable_recall`
- Else (single score):
  - `score ≥ 75` → `fluent`
  - `score < 50` → `fragmented_recall`
  - else → `developing_fluency`

**Persistence:** All 7 evidence rows are written to `PsychEvidence` table
with `{ userId, dimension, value, evidenceText, sourceType, sourceId, week }`.
Loop at lines 254–271.

---

### 1.5 Escalation triggers (amber → red)

**File:** `/home/z/my-project/src/lib/ai-assistant/escalation.ts` (lines 25–27, 54–112)

**Thresholds (lines 25–27):**
| Constant                          | Value |
|-----------------------------------|-------|
| `AMBER_DURATION_DAYS`             | 7     |
| `REPEAT_SHORTENED_DAYS`           | 2     |
| `REPEAT_IMMEDIATE_THRESHOLD`      | 3     |

**Repeat-occurrence lookback:** 30 days, same `(userId, type)` pair,
excluding the current flag. *(lines 118–135)*

**`shouldEscalate(flag, repeatCount)` — pure function** *(lines 54–112):*
Only operates on flags with `tier === "warning"` AND status in
`{open, acknowledged}`. Skips `resolved`/`dismissed` immediately.

1. **Trigger 2 (immediate):** `repeatCount ≥ 3` → escalate to red, reason
   `"Immediate escalation: Nrd+ repeat occurrence of {type}"`. *(lines 69–78)*
2. **Trigger 2 (shortened):** `repeatCount ≥ 2 AND daysSinceRaised ≥ 2` →
   escalate to red. *(lines 81–90)*
3. **Trigger 1 (duration):** `daysSinceRaised ≥ 7` → escalate to red. *(lines 93–102)*
4. Else: no escalation, returns current tier.

**`daysSinceRaised`** *(line 66):* `floor((now − createdAt) / (24×60×60×1000))` — UTC wall-clock days.

**On-write hook** *(lines 240–261, `checkOnWriteEscalation`):* Called
immediately after a new flag is created. If `repeatCount ≥ 3`, the flag is
escalated to red without waiting for the scheduled job.

**Scheduled job** *(lines 182–234, `runEscalationEngine`):* Scans all
`StudentAlert` rows with `severity="warning"` AND `status in (open, acknowledged)`,
runs `shouldEscalate` on each, persists escalations. Triggered by cron via
`POST /api/assistant/escalation/run` (with `CRON_SECRET` or admin auth).

**Side effect of escalation** *(lines 141–174, `escalateFlag`):*
1. `StudentAlert.severity` set to `"red"`.
2. `WellbeingState` for the same userId set to `tier="red"` with the reason
   in `reasonsJson`. **Replaces** the previous reasons array — does NOT
   concatenate.

**Senior-coder note:** `escalateFlag` writes to `WellbeingState` directly
without re-running the §1.2 ratio computation. This is intentional — once a
flag escalates to red, the wellbeing tier is red regardless of the
evidence-mix ratio. But replacing `reasonsJson` loses the original
ratio-based reasons. Consider concatenating rather than replacing.

---

### 1.6 Attention score (teacher dashboard)

**File:** `/home/z/my-project/src/app/api/stats/route.ts` (lines 76–155)

The attention score is a *display-only* heuristic for sorting students on the
teacher dashboard. It is NOT persisted; it is recomputed per request.

**Inputs:** student's `dailyLogs[0].date` (most recent — DB query already
limited to `take: 5` at line 66), latest weekly test score, last two weekly
test scores, recent daily logs with `confidence ≤ 2`, blocked task count,
recent `psychologyObs.cognitiveLoad` values.

**Point allocations:**

| Signal                                              | Points | Threshold                |
|-----------------------------------------------------|--------|--------------------------|
| Inactive (no daily log) for ≥ 3 days                | +30    | `daysSince ≥ 3`          |
| Inactive for 2 days                                 | +15    | `2 ≤ daysSince < 3`      |
| Has project tasks but never checked in              | +20    | `lastLog == null && tasks > 0` |
| Latest weekly test score < 60                       | +25    | `latestTest.score < 60`  |
| Score dropped ≥ 15 points (last vs. previous test)  | +20    | `last < prev − 15`       |
| ≥ 2 of last 5 daily logs with `confidence ≤ 2`      | +20    | `lowConfidenceLogs ≥ 2`  |
| Blocked task count > 0 (flat, not per-task)         | +10    | `blockedTasks > 0`       |
| ≥ 2 of last 3 psychObs with `cognitiveLoad="high"`  | +15    | `recentHighLoad ≥ 2`     |

**`needsAttention = attentionScore >= 20`** *(line 154)* — drives the
dashboard's "sort by attention" view. Roster sorts by `attentionScore`
descending.

**Senior-coder notes:**
- **Previous-audit claim CORRECTED:** The "Sustained low confidence" check
  (lines 142–145) filters `confidence ≤ 2` from the *already-limited* set
  of 5 daily logs returned by the DB query (line 66: `dailyLogs: { ... take: 5 }`).
  The previous audit's claim of a "lifetime query" bug was incorrect — the
  query is correctly scoped to the last 5 logs by the `take: 5` clause.
  Reason string "recent" is accurate. ✅
- **Blocked-task wording mismatch (Finding F-12):** The blocked-task award
  is flat `+10` regardless of how many tasks are blocked (line 150), but the
  reason string at line 151 says `"${blockedTasks} blocked task(s)"`,
  implying per-task points. Either change to `+10 × blockedTasks` or change
  the reason string to "Has blocked task(s)".

---

### 1.7 Skill mastery — rolling average

**Files:**
- `/home/z/my-project/src/modules/assessment/lib/analysis-pipeline.ts` (lines 280–353) — persisted computation via `writeSkillMastery` + `upsertSkillMastery`
- `/home/z/my-project/src/app/api/skill-mastery/route.ts` (lines 17–27, 50–82) — on-the-fly computation when no persisted rows exist
- `/home/z/my-project/src/components/examiner/teacher/computeMasteryFromInteractions.tsx` (lines 16–30) — client-side fallback when no API data yet

**Levels (4):**
| avg score (0–100) | Level          |
|-------------------|----------------|
| `avg ≥ 90`        | `mastered`     |
| `75 ≤ avg < 90`   | `proficient`   |
| `50 ≤ avg < 75`   | `developing`   |
| `avg < 50`        | `not-started`  |

**Trend:**
| Condition (newAvg − existingApprox) | Trend       |
|-------------------------------------|-------------|
| `> 10`                              | `improving` |
| `< −10`                             | `declining` |
| else                                | `stable`    |

**Persisted computation** *(analysis-pipeline.ts lines 316–353):*
This is the more sophisticated path — it uses a **blended rolling average**
to prevent a single bad test from erasing mastery:

1. `existingApprox` is reverse-mapped from the existing mastery level:
   `{ "not-started": 25, "developing": 60, "proficient": 82, "mastered": 95 }`. *(line 324)*
2. `newWeight = evidenceCount ≥ 3 ? 0.4 : 0.8` (more history → trust the
   existing level more). *(line 333)*
3. `blendedAvg = (newAvg × newWeight) + (existingApprox × (1 − newWeight))`. *(line 334)*
4. `masteryLevel` computed from `blendedAvg` using the 4-level table. *(line 343)*
5. `trend` computed from `newAvg − existingApprox` (not the blended value). *(lines 336–339)*

**On-the-fly computation** *(skill-mastery/route.ts lines 50–82):*
Used when no `SkillMastery` rows exist yet — falls back to per-topic average
of `Interaction.correctness`. Trend = `last.correctness − first.correctness`
with ±10 thresholds.

**Client-side fallback** *(computeMasteryFromInteractions.tsx lines 16–30):*
Same 4-level threshold as the on-the-fly path. Trend is hardcoded `"stable"`
(client doesn't compute trend).

**Senior-coder note:** Three code paths compute "mastery" three slightly
different ways. The persisted path uses a rolling blend, the on-the-fly path
uses a simple average, and the client fallback uses a simple average with
hardcoded `trend = "stable"`. For a brand-new student, all three paths can
fire sequentially depending on what data exists. The values will be roughly
consistent but not identical.

---

### 1.8 Project task generation — course-aligned planner

**Files:**
- `/home/z/my-project/src/modules/project/lib/course-aligned-planner.ts` — primary generator (current, course-aware)
- `/home/z/my-project/src/modules/project/lib/task-generator.ts` — legacy generator (no course alignment)
- `/home/z/my-project/src/app/api/project/generate-tasks/route.ts` — endpoint (calls course-aligned-planner)
- `/home/z/my-project/src/app/api/project/plan/route.ts` — separate week-plan-only endpoint (calls task-generator.ts → `generateWeekPlan`)

**Current path (course-aligned):** `POST /api/project/generate-tasks` →
`generateCourseAlignedPlan(userId, options)`.

**Inputs:**
- `userId` — student
- `options.weeks` — override `projectDurationWeeks` (default: from User record, clamped to `[2, 26]`)
- `options.tasksPerWeek` — default 5, clamped to `[1, 10]`
- `options.replace` — if `false` (default) and tasks already exist, refuses with an error. If `true`, deletes old tasks **after** the AI succeeds.

**Algorithm:**

1. **Load** student's project definition (`projectName`, `projectScope`,
   `projectObjectives`, `projectRequirements`, `projectBusinessCase`,
   `projectNotes`, `projectDurationWeeks`) and the student's assigned course
   outline via `getCourseTopics(userId)`. *(lines 122–146)*
2. **Refuse early** if no project name, no course outline, or — when
   `replace=false` — tasks already exist. *(lines 132–185)*
3. **Alignment map:** for each project week `pw` (1..weeksRequested), compute
   `courseWeek = ((pw − 1) % courseTotalWeeks) + 1` so each project week has
   a course-week context (wraps when project is longer than the course —
   rare, capped at `courseWeeks − 1` by the project-setup route). *(lines 73–77)*
4. **Build course context** for the AI prompt: for each project week, list
   the matched course week's phase name + each daily topic's title + objective. *(lines 79–96)*
5. **AI call** (lines 192–236): system prompt instructs the AI to act as a
   senior capstone mentor, generating JSON with `weeks[]` (title, summary,
   1–3 milestones each) and `tasks[]` (week, day 1–5, description, isMilestone,
   courseTopicLink). `temperature: 0.6`, `maxTokens: 3500`, feature
   `"project-plan-gen"`.
6. **Validation:** reject if AI returns fewer than `weeksRequested × tasksPerWeek × 0.5` tasks. *(lines 248–250)*
7. **Fallback** *(lines 257–261, 355–401):* if the AI call fails, generate a
   deterministic plan from the course outline — one task per day per project
   week, each labeled "Apply '{course topic}' to your '{project name}'
   project", with the last day of each week as the milestone.
8. **Sanitization** *(lines 264–281):* clamp `week` to `[1, weeksRequested]`,
   `day` to `[1, 5]`, truncate `description` to 300 chars, `title` to 200,
   `summary` to 500, `milestones` to 3 strings of 200 chars each.
9. **Persist in a transaction** *(lines 294–330):*
   - If `replace=true` AND old task IDs were captured: delete comments on
     those tasks, then delete the tasks.
   - Always delete + recreate `ProjectWeek` rows (cheap to regenerate).
   - Create `ProjectTask` rows with `status="planned"`, `week`, `day`,
     `isMilestone`, and `taskNotes = courseTopicLink` (so the alignment note
     surfaces in the task detail UI).

**Key design choice:** the `day` column on `ProjectTask` is the sync point
between the course daily topic and the project task — when a student is on
course week 3 day 2, the Daily Task Reminder + Check-in panel show BOTH
today's course daily topic AND today's project task in one coherent view.

**Legacy path (still wired up via `/api/project/plan`):** `generateWeekPlan(userId, weeks)`
in `task-generator.ts` (lines 127–174). It generates only `ProjectWeek` rows
(no tasks) and does NOT use course context. Less sophisticated; kept for
backward compat.

**Senior-coder notes:**
- The fallback in step 7 means a student always gets SOMETHING usable even
  on AI failure. Good design.
- The 50%-minimum validation in step 6 could let through a half-complete
  plan silently — e.g. 5 weeks requested, AI returns 3 weeks of tasks. The
  response says `tasksCreated: N` and `weeksGenerated: M` so the UI can warn.
- The transaction deletes old tasks + comments AFTER the AI succeeds — old
  data is preserved if the AI fails. Good.

**AI-drafts-humans-decide rule:** the AI-generated tasks ARE auto-persisted
to `ProjectTask` (no human review gate). However:
- The student is the only person these tasks affect (their own dashboard).
- The student can edit or delete tasks via the Project tab UI.
- The tasks do not affect grades, certificates, or wellbeing tier directly.

⚠️ See §3.10 for the partial-compliance assessment.

---

### 1.9 Certificate grade + score

**File:** `/home/z/my-project/src/app/api/certificates/generate/route.ts` (lines 174–218)

**Flow:** student requests → staff approves.

**Completion gate (request time)** *(lines 70–84):*
- `currentWeek >= totalWeeks` (where `totalWeeks = getCourseDurationWeeks(userId)`, defaults to 6)
- `completedTests >= totalWeeks` (weekly tests with `status="completed"` AND `score != null`)

**On approval** *(lines 182–190):*
- `completedTests = WeeklyTest.findMany(status="completed", score != null)`
- `avgScore = round(sum(scores) / scores.length)` (or 0 if no scores)
- `grade = scoreToGrade(avgScore)` (§1.1)
- `certificate.update({ grade, score: avgScore, signedBy: staffName, courseId, courseName, studentName })`

**Note:** The certificate grade is computed from **weekly test scores only**
(not practice, not project). It uses the post-plagiarism-deduction scores
because that's what's persisted on `WeeklyTest.score`. There is no separate
weighting or normalization.

**Audit:** All three transitions (request, approve, reject) are written to
`AuditLog` via `logAudit()` *(lines 113, 164, 220)*.

**Senior-coder note:** the avg-score computation uses raw
`scores.reduce((a, b) => a + b, 0) / scores.length` rather than the
`Math.round()`-then-divide pattern, but rounds the result. Numerically
correct; no float-trap. ✅

---

### 1.10 Final result / career readiness

**File:** `/home/z/my-project/src/app/api/students/final-result/route.ts` (lines 23–265)
**UI:** `/home/z/my-project/src/components/examiner/student/FinalResultPanel.tsx`

**Inputs (per student):**
- `weeklyTests` (up to 50, ordered by week)
- `interactions` (practice questions, up to 500)
- `reportCards`, `psychObs`, `projectReports`, `tasks`
- `courseDurationWeeks = getCourseDurationWeeks(userId)` (defaults to 6 if no course assigned)

**Computed metrics:**

**Questions answered** *(lines 66–74):*
For each completed weekly test, `min(currentQuestion > 0 ? currentQuestion : 1, 10)`.
`currentQuestion` is 0-indexed (so 9 means 10 questions answered). Capped at
10 per week. (Tests the student finished early have `currentQuestion < 10`.)
- `TOTAL_POSSIBLE_QUESTIONS = courseDurationWeeks × 10`

**Average plagiarism** *(lines 77–86):*
Average of all `plagiarismScore` values across completed weekly tests AND
practice questions. 0 if none.

**Performance score** *(lines 88–106):*
```
weeklyAvg   = round(mean of completed weekly test scores)  // 0 if none
practiceAvg = round(mean of interaction.correctness)        // 0 if none

if weeklyScores.length > 0 AND interactions.length > 0:
    performanceScore = round(weeklyAvg × 0.5 + practiceAvg × 0.5)
elif weeklyScores.length > 0:
    performanceScore = weeklyAvg
elif interactions.length > 0:
    performanceScore = practiceAvg
else:
    performanceScore = 0

performanceGrade = scoreToGrade(performanceScore)  // §1.1
```

**Participation score** *(lines 108–112):*
```
participationRate = round((questionsAnswered / TOTAL_POSSIBLE_QUESTIONS) × 100)
participationGrade = scoreToGrade(participationRate)
```

**Per-week breakdown** *(lines 117–135):* for each course week 1..courseDurationWeeks,
emit `{ week, phase, weeklyTestScore, weeklyTestStatus, questionsAnswered, practiceCount, practiceAvg, plagiarismScore }`.
Phase comes from `getCourseWeekPhase(userId, week)`.

**AI behavioral analysis** *(lines 137–219):*
Single AI call (`feature: "final-result"`, `temperature: 0.3`, `maxTokens: 600`)
with a prompt asking for JSON:
- `behavioralPattern` (3–4 sentences, simple English: "How does this student think and learn? Are they consistent? Do they engage deeply or surface-level?")
- `areasToImprove` (3–4 specific, actionable things to become a professional web developer)
- `overallAssessment` (2–3 sentences: "Are they ready for a junior developer role?")
- `careerReadiness` (string: `"Ready"` | `"Almost Ready"` | `"Needs More Practice"`)

**Fallback** *(lines 207–219)* if AI fails:
- `behavioralPattern` = template sentence referencing completion count + participation rate
- `areasToImprove` = template strings based on `practiceAvg` and `weeklyAvg`
- `careerReadiness` = `performanceScore >= 70 ? "Ready" : performanceScore >= 50 ? "Almost Ready" : "Needs More Practice"`

**UI safeguard** *(FinalResultPanel.tsx lines 104–117):* The Career Readiness
badge is **only rendered** once the student has completed at least
`Math.ceil(totalPossibleQuestions / 20)` weekly tests — i.e. ≥ 5% of the
course. Showing "Not Ready" to a Week-1 student is psychologically brutal
and doesn't help them. (SDT rebalance — research-grounded choice.)

**UI safeguard** *(FinalResultPanel.tsx lines 119–121):* The "Average
Plagiarism Risk" stat is hidden from the student view (teacher-only in the
portfolio). Old UI showed it permanently, making students feel surveilled.

**Senior-coder notes:**
- The AI prompt asks for behavioral inference ("How does this student
  think?") but does NOT explicitly forbid clinical language. It does not
  have the "Never state a clinical or psychological diagnosis" rule that
  the narrative + explain + teacher-assistant + draft-checkin prompts have.
  **Finding F-13.**
- The AI output is **returned but NOT persisted** by this route. Each GET
  triggers a fresh AI call (rate-limited). The UI displays it directly
  without a human-review gate. **Finding F-14** — UI should display an
  "AI-generated" indicator.
- The behavioral-pattern text is shown to the student under the heading
  **"Your Learning Style"** (FinalResultPanel.tsx line 126) — this is a
  deprecated psychological construct (Pashler et al., 2008 found no
  evidence for fixed learning styles). See Finding F-15.

---

### 1.11 14-day rolling consistency + streak

**File:** `/home/z/my-project/src/app/api/stats/route.ts` (student branch, lines ~278–301 of the file as read)

**Context:** The old codebase had a brittle "streak" counter that reset to
zero on the first missed day. The SDT-rebalance rewrite replaced the
all-or-nothing streak with a **rolling 14-day consistency percentage**,
which is more honest (a 90%-consistent student IS different from a
10%-consistent one) and more motivating (recoverable, not all-or-nothing).
Research basis cited in the code comment: the "what-the-hell effect" —
broken streaks cause people to give up entirely.

**Inputs:**
- `user.dailyLogs` (up to 100, ordered by date asc) — set of dates the
  student submitted a daily check-in.

**Algorithm:**

```ts
const today = new Date(); today.setHours(0, 0, 0, 0);
const seen = new Set(user.dailyLogs.map(l => {
  const d = new Date(l.date); d.setHours(0, 0, 0, 0); return d.toISOString();
}));

// Legacy streak (backward compat for UI):
let streak = 0;
for (let i = 0; i < 365; i++) {
  const d = new Date(today); d.setDate(today.getDate() - i);
  if (seen.has(d.toISOString())) streak++; else break;
}

// Rolling 14-day consistency:
const ROLLING_DAYS = 14;
let consistencyDays = 0;
for (let i = 0; i < ROLLING_DAYS; i++) {
  const d = new Date(today); d.setDate(today.getDate() - i);
  if (seen.has(d.toISOString())) consistencyDays++;
}
const consistencyPercent = Math.round((consistencyDays / ROLLING_DAYS) * 100);
```

**Outputs (returned to the student dashboard):**
- `streak` (number) — consecutive days with a daily log, counting back from
  today. Stops at the first missed day. Capped at 365.
- `consistencyDays` (number, 0–14) — how many of the last 14 days had a
  daily log.
- `consistencyPercent` (number, 0–100) — `round(consistencyDays / 14 × 100)`.

**Important properties:**
- A missed day does NOT reset `consistencyPercent` to zero — it just lowers
  it by ~7 percentage points. The student can recover.
- The legacy `streak` field is kept for backward compatibility with older UI
  components that still display it.
- The "set" is built from `user.dailyLogs` limited to 100 rows — a student
  with a perfect 100+ day record will still have the last 14 days correctly
  counted (the set lookup is what matters, not the row count).

**Senior-coder notes:**
- `today.setHours(0, 0, 0, 0)` uses the **server's local timezone**, not UTC.
  If the server is in UTC but the student is in PST, a daily log submitted
  at 11pm PST on Monday will be stored as Tuesday UTC and may not match
  "today" from the student's perspective. **Finding F-16** — consider
  computing the date bucket in the student's timezone (requires storing the
  student's TZ on the User record).
- The legacy streak loop iterates up to 365 times per student per stats
  request — fine for one student, but the teacher-stats branch doesn't call
  this. ✅

---

### 1.12 Report-card composite score

**File:** `/home/z/my-project/src/app/api/students/[id]/generate-report-card/route.ts` (lines 61–84)

**Inputs (for the given week):**
- `weeklyTestScore` — the weekly test's persisted score (already post-plagiarism-deduction).
- `practiceAvg` — average `Interaction.correctness` for the week.
- `taskRate` — `(completedTasks / totalTasks) × 100` for the week.

**Formula** *(lines 73–84):*
```
if weeklyTestScore != null AND practiceAvg != null:
    overallScore = round(weeklyTestScore × 0.5 + practiceAvg × 0.5)
elif weeklyTestScore != null:
    overallScore = weeklyTestScore
elif practiceAvg != null:
    overallScore = practiceAvg
elif taskRate > 0:
    overallScore = max(50, taskRate)   # floor of 50 for beginners
else:
    overallScore = 50                  # default floor
```

**Then:** `grade = scoreToGrade(overallScore)` (§1.1).

**Persistence:** The composite `overallScore` + `grade` + computed
`strengths[]` / `weaknesses[]` / `workHabits` / `progress` / `nextSteps` /
`examinerObservations` strings are upserted into `ReportCard` by `(userId, week)`.

**Triggered by:** Staff-only POST — the route is `/api/students/[id]/generate-report-card`.
The teacher clicks "Generate Report Card" and the route computes from real
data (no AI call). The teacher can also manually POST plain `score`/`grade`/
`strengths`/etc. via `/api/report-cards` (different route, no AI).

**Senior-coder note:** The route is named "generate" but is fully
deterministic — no AI involvement. The label is misleading; consider
renaming to "compute-report-card" or documenting that "generate" means
"compute from real data". (Finding F-17.)

---

### 1.13 Plagiarism deduction

**File:** `/home/z/my-project/src/modules/assessment/lib/plagiarism-scoring.ts` (lines 30–48)

**Formula:**
```
finalScore = round(rawScore × (1 − plagiarismScore / 100))
deductedMarks = rawScore − finalScore
```

**Examples** (from file header):
| rawScore | plagiarism | finalScore |
|----------|------------|------------|
| 80       | 0%         | 80         |
| 80       | 20%        | 64         |
| 80       | 50%        | 40         |
| 80       | 100%       | 0          |
| 90       | 30%        | 63         |

**Clamping:** Both `rawScore` and `plagiarismScore` are clamped to 0–100
before computation *(lines 35–36)*.

**Where it's applied:**
- Weekly test completion — `/api/ai/weekly-test/route.ts` (`applyPlagiarismDeduction(analysis.score, analysis.plagiarismScore)`).
- Daily test completion — `/api/daily-test/route.ts`.

**The DEDUCTED score is what's persisted** as `WeeklyTest.score` /
`DailyTest.score`. The student-facing UI receives both `rawScore` and
`finalScore` so the deduction is transparent.

**Display labels** *(plagiarism-scoring.ts lines 51–59):*
| Score range | Label                              |
|-------------|------------------------------------|
| 0           | "No plagiarism detected"           |
| 1–10        | "Genuinely your own work"          |
| 11–30       | "Mostly genuine — minor concerns"  |
| 31–50       | "Some answers may need review"     |
| 51–70       | "Likely used AI on multiple answers" |
| 71–90       | "Very likely cheated on several answers" |
| 91–100      | "Almost certainly copied"          |

---

### 1.14 AI rate limits

**File:** `/home/z/my-project/src/lib/ai-rate-limits.ts` (lines 29–39, 96–105)

**Defaults:**
| Category   | Default daily limit | Setting key                |
|------------|---------------------|----------------------------|
| `test`     | 50                  | `ai_test_daily_limit`      |
| `tutor`    | 150                 | `ai_tutor_daily_limit`     |
| `assistant`| 100                 | `ai_assistant_daily_limit` |

**Feature-to-category map** *(lines 42–88):*

| Feature label                       | Category   |
|-------------------------------------|------------|
| `question-gen`                      | test       |
| `evaluate`                          | test       |
| `practice` / `-start` / `-reply`    | test       |
| `daily-test` / `-reply`             | test       |
| `weekly-test` / `-start` / `-reply` / `-final-analysis` | test |
| `final-analysis`, `final-result`    | test       |
| `project-report` / `-analysis`      | test       |
| `project-tasks` / `-task-gen` / `-week-gen` / `-final-analysis` / `-summary-gen` | test |
| `project-plan-gen`                  | test (via fallback) |
| `course-gen` / `course-gen-batch`   | test       |
| `connection-test`                   | test       |
| `ai-tutor`                          | tutor      |
| `teacher-tutor`                     | tutor      |
| `teacher_assistant`                 | assistant  |
| `action-dialog` / `action_dialog` (legacy typo) | assistant |
| `escalation`                        | assistant  |
| `debug-ping`                        | assistant  |
| `daily-motivation`                  | assistant  |
| `student-explain`                   | assistant  |
| `narrative-week`                    | assistant  |
| `draft-checkin`                     | assistant  |
| `rehearse-reply` / `-start`         | assistant  |
| `comprehensive-report`              | assistant  |
| `case-review-anonymize`             | assistant  |
| `touchpoint-parse`                  | assistant  |
| `topic-guidance`                    | assistant  |

Any unmapped feature label falls back to `"assistant"` *(line 92)*.

**Window:** UTC midnight to UTC midnight. `startOfUTCDay()` and `endOfUTCDay()` *(lines 117–127)*.

**Counting rule:** Only `AIUsageLog` rows with `success = true` count
against the limit — failed AI calls don't consume quota.

**Fail-open behavior:** If the `count()` query itself fails, the limiter
returns 0 used — the call is allowed. This is intentional (resilience over
strictness) but means a DB outage briefly disables rate limits.

**Demo-account gate:**
- Setting key `demo_ai_enabled` (default: `true`).
- If false, demo accounts (identified by `email === "demo@examiner.ai"` in
  each route) get a 403.

**Configurable:** Admin panel at `/home/z/my-project/src/components/examiner/admin/AILimitsPanel.tsx`
calls `/api/settings/ai-limits`.

---

### 1.15 Self-paced anti-cheat flags

**File:** `/home/z/my-project/src/modules/self-paced/index.ts` (lines 26–31, 92–118, 162–183)

**Constants:**
- `DAYS_PER_WEEK = 5`
- `MIN_TASK_COMPLETION_MINUTES = 2`

**`getSelfPacedStatus(userId)`** computes `antiCheatFlags: string[]`:

| Flag string                                                              | Trigger                                                          |
|--------------------------------------------------------------------------|------------------------------------------------------------------|
| `N task(s) completed in under 2 minutes — review for authenticity`       | Any task where `completedAt − createdAt < 2 min`                 |
| `N days ahead of calendar schedule — verify task quality`               | `daysAheadOfSchedule >= 3`                                       |
| `All week N tasks completed by day D — review for AI-generated content` | `canTakeWeeklyTestEarly AND currentDay <= 2`                     |
| `Week N test had plagiarism score X/100 — voice inconsistency detected` | Most recent completed weekly test had `plagiarismScore > 50`     |

**`daysAheadOfSchedule`** *(lines 85–90):*
- `calendarDay = new Date().getDay()` (1=Mon…5=Fri, null on weekend)
- `daysAhead = max(0, user.currentDay − calendarDay)`

**Persistence on advance:** When `advanceDay(userId)` runs and
`antiCheatFlags.length > 0`, a `StudentAlert` is created with:
- `type = "self_paced_cheat"`
- `severity = daysAheadOfSchedule >= 5 ? "red" : "warning"`
- `reason = "Self-paced anti-cheat: " + flags.join("; ")`
- `metric = "daysAheadOfSchedule"`, `metricValue = String(daysAhead)`

**Dedup:** Only one `self_paced_cheat` alert per student per 24h *(lines 164–169)*.

**Does NOT block advancement** — the student still advances; the alert is
for teacher review. (Stated explicitly in module header, lines 18–20.)

---

### 1.16 Calibration gap

**Files:**
- `/home/z/my-project/src/modules/assessment/lib/analysis-pipeline.ts` (lines 111–137) — per-test calibration evidence (dimension #1 of the seven)
- `/home/z/my-project/src/lib/teacher-batch-summary.ts` — batch-level aggregate calibration gap
- `/home/z/my-project/src/modules/comprehensive-report/index.ts` (lines 233–238) — report-level aggregate
- `/home/z/my-project/src/components/examiner/teacher/CalibrationScatterCard.tsx` — UI scatter plot

**Definition:**
```
calibrationGap = (avgSelfRatedConfidencePct) − (avgActualScorePct)
```

Where:
- self-rated confidence is on a 1–5 scale, converted to % via `rating × 20`.
- actual score is the per-answer test score (0–100).

**Per-test (analysis-pipeline.ts):**
- `avgConfidence` = average of `(low=1, medium=3, high=5)` across answers with a confidence rating.
- `confidencePct = avgConfidence × 20`.
- `gap = confidencePct − avgActual` (per-test, written into evidenceText).

**Comprehensive report (comprehensive-report/index.ts lines 233–238):**
```ts
calibrationGap = round(
  mean(rating × 20 − actualScore) across all confidence ratings
)
```
Positive = overconfident, negative = underconfident. Rounded to int.

**UI thresholds (CalibrationScatterCard.tsx):**
- `gap > 20` → "Overconfident" badge (amber)
- `gap < −20` → "Underconfident" badge (blue)
- else → no badge (well-calibrated)

These UI thresholds match the per-test dimension thresholds in §1.4
(analysis-pipeline.ts lines 122–128). ✅ Consistent.

---

## 2. Psychological / behavioral inference audit

This section reviews EVERY place the app produces psychological or behavioral
inference about a person. For each: does it avoid overclaiming? Does it
avoid diagnostic-sounding language? Is it evidence-linked?

### 2.1 `psych-analyzer.ts` — per-message heuristic analysis

**File:** `/home/z/my-project/src/modules/assessment/lib/psych-analyzer.ts`

**What it claims:** "Lightweight per-message psychological analyzer... pure heuristic text analysis. Runs on every AI Tutor message in <1ms."

**Framing safeguards** *(lines 16–19):*
> "The scores are HEURISTIC, not clinical. They're for early-warning teacher alerts, not diagnosis. A low moodScore doesn't mean the student is depressed — it means the teacher should check in."

**What it outputs:**
- `moodScore: number` (0–100)
- `engagementScore: number` (0–100)
- `frustrationSignal: boolean`
- `avoidanceSignal: boolean`
- `enthusiasmSignal: boolean`
- `signals: string[]` (human-readable)

**Threshold-based alert reasons** *(lines 161–247):*

| Threshold                                  | Severity | Reason text (verbatim) |
|--------------------------------------------|----------|------------------------|
| `moodScore < 30`                           | red      | "Student mood score is very low (N/100). Multiple frustration or avoidance signals detected. **Consider a wellbeing check-in.**" |
| `moodScore < 45 AND frustrationCount > 3`  | warning  | "Student mood is below average (N/100) with N frustration signals this week. **A gentle check-in may help.**" |
| `avoidanceCount > 5`                       | warning  | "Student showed N avoidance responses ('I don't know' / 'skip') this week. **May indicate uncertainty or lack of confidence.**" |
| `avgScoreThisWeek < 40`                    | red      | (educational alert, no psych claim) |
| score drop > 15                            | warning  | (educational alert, no psych claim) |
| `engagementStreak === 0`                   | warning  | (mentorship alert) |
| inactivity ≥ 3 days                        | warning/red | (mentorship alert) |
| `engagementScore < 30`                     | warning  | "Engagement score is very low (N/100). The student **may be losing interest**. A mentorship conversation about goals could help." |

**Psychologist-lens assessment:**
- ✅ Explicit "not clinical" disclaimer.
- ✅ Uses "may indicate", "may be", "consider" — hedged language throughout.
- ✅ Frames the alert as a *teacher action* ("a gentle check-in may help"), not a diagnosis.
- ✅ **M13 fix VERIFIED APPLIED (line 183–185):** the previous "may indicate anxiety or lack of confidence" wording has been replaced with "May indicate uncertainty or lack of confidence" — the clinical term "anxiety" is gone.
- ✅ No claim of "depression", "disorder", "syndrome", or specific diagnoses anywhere in the file.

### 2.2 `analysis-pipeline.ts` — the 7 dimensions

**File:** `/home/z/my-project/src/modules/assessment/lib/analysis-pipeline.ts`

**Evidence texts (verbatim quotes from each dimension):**

1. **Calibration** (lines 121–127):
   - "Overconfident: rated N% but scored N% — **Dunning-Kruger signal**."
   - "Underconfident: rated N% but scored N% — knows more than they think."
   - "Confidence N% vs actual N% — gap of N points."

   ⚠️ **Finding F-7 (still open).** "Dunning-Kruger signal" is a reference
   to a well-known cognitive bias and is technically accurate (the gap-
   between-confidence-and-performance pattern is what Dunning-Kruger
   describes), but it's a label that can feel diagnostic to a non-
   psychologist teacher. Recommend rephrasing to "self-rated confidence
   was higher than actual performance".

2. **Explanatory depth** (lines 143–152): pure descriptive language
   ("Short answers (avg N chars) — surface-level responses. Probing
   likely revealed gaps in understanding."). ✅

3. **Gaming pattern** (lines 159–165): "Plagiarism score N% — significant
   voice inconsistency. **Possible AI use on specific questions.**" ✅
   Hedged with "possible".

4. **Attribution** (lines 176–184):
   - "Growth-mindset language detected (N signals): uses 'learn', 'practice', 'improve'. **Attributes success to effort.**"
   - "Fixed-mindset language detected (N signals): uses 'can't', 'not good at'. **May attribute difficulty to innate ability.**"
   - "**may indicate anxiety or fixed-mindset response.**" *(line 181)*

   ⚠️ **Finding F-5 (still open).** The previous M13 fix was applied to
   `psych-analyzer.ts` but **NOT** to `analysis-pipeline.ts` line 181 —
   the word "anxiety" is still present here. Should be replaced with
   "uncertainty or fixed-mindset response" to match psych-analyzer.

5. **Cognitive load** (lines 189–195): "Score N% — high intrinsic cognitive
   load. The material **may be too difficult at this point**. Consider
   breaking into smaller pieces." ✅ Action-oriented, no diagnosis.

6. **SRL phase** (lines 199–224): uses "may indicate fatigue or waning
   engagement" *(line 212)*. ✅ Hedged.

7. **Fluency** (lines 235–250): "possible fatigue or fading recall" *(line 238)*. ✅ Hedged.

**Overall pipeline framing:** No diagnostic claims. All evidence texts are
linked to the data that triggered them (the score, the gap, the language
matched). The seven dimensions use established educational-psychology
frameworks (Dweck mindset, Sweller cognitive load, Zimmerman SRL) and stay
within their educational (non-clinical) interpretation.

### 2.3 `ai-prompts.ts` — weekly test + final-analysis prompts

**File:** `/home/z/my-project/src/modules/assessment/lib/ai-prompts.ts`

**Weekly test system prompt** *(lines 154–199)*:
- Section 6 (lines 144–151) tells the AI: "Do NOT include behavioral observations in individual replies. Psychological analysis happens ONLY in the final summary. During the test, silently note..."
- Final summary section 4 (line 193) asks for: "PSYCHOLOGICAL ASSESSMENT (based on the ENTIRE conversation): How do they think? Do they reason logically or guess? Are they overconfident? Do they give up? Are they engaged? **What's their preferred way of engaging with the material?** Be honest but KIND."

**Senior-coder + psychologist-lens notes:**
- ✅ The prompt constrains the AI to observable behavior ("Do they reason logically or guess?") rather than internal state.
- ✅ **M6 fix VERIFIED APPLIED:** the previous "What's their learning style?" has been replaced with "What's their preferred way of engaging with the material?" — this avoids invoking the debunked "learning styles" construct (Pashler et al., 2008).
- ⚠️ "overconfident" is a behavioral observation (confidence vs. demonstrated performance), not a diagnosis. ✅ Acceptable.

**Final-analysis prompt** *(lines 379–587)*:
- "**PSYCHOLOGIST-STYLE COGNITIVE ANALYSIS** (in SIMPLE English, be HONEST but KIND): Based on the ENTIRE conversation, analyze the student's cognitive patterns. How does this student's mind work? Do they break problems into steps or jump to conclusions?..."

⚠️ **Finding F-8 (still open).** The phrase "PSYCHOLOGIST-STYLE COGNITIVE
ANALYSIS" in the system prompt is a misleading framing. The AI is not a
psychologist and the prompt goes on to ask for observable cognitive
patterns (problem decomposition, cause-and-effect, etc.), not diagnoses.
But the label "psychologist-style" could leak into the AI's output tone.
Recommend renaming to "COGNITIVE-PATTERN ANALYSIS".

**Scoring rules** *(lines 399–407)* are explicit about honesty + kindness:
> "A student who answered nothing or gave completely wrong answers throughout should score 20-40. The student-facing UI will buffer this with a kind 'here's what to focus on' message — the student will NOT see a harsh number. Teachers see the real score."

✅ Honest scoring is paired with a kind student-facing buffer. The AI is
told explicitly NOT to floor scores artificially.

**Engagement feedback rules** *(lines 520–558)* frame engagement monitoring
as "professional development" rather than punishment. ✅

### 2.4 AI Tutor system prompt

**File:** `/home/z/my-project/src/app/api/ai/tutor/route.ts` (lines 127–246)

**What it asks the AI to do:**
- Teach concepts (NOT grade — explicit rule 0, lines 140–146).
- Track engagement signals lightly via `trackTutorEngagement()` — calls `analyzeMessage()` from psych-analyzer.ts.

**Psychologist-lens assessment:**
- ✅ The AI Tutor never produces a psychological narrative. It only teaches.
- ✅ The behavioral signals flow into `StudentHealthSummary` via the engagement tracker, which uses the hedged language audited in §2.1.
- ✅ Rule 3 (lines 193–205): "Handling Disengaged Students — Short and Warm. When a student says they don't want to study, feel tired, or express frustration — keep it SHORT (3-5 sentences total): Acknowledge, one small insight, gentle pivot. Do NOT write a long essay about professional skills, resilience, etc."

This is excellent — it explicitly tells the AI NOT to play therapist.

### 2.5 Action-dialog system prompt

**File:** `/home/z/my-project/src/app/api/assistant/action-dialog/route.ts` (lines 76–90)

```
You are an AI Assistant helping a {role} respond to a flag about {entityName}.
Generate content for an Action Dialog with this structure:
1. headline: plain-language label (10-15 words, specific to the flag — NOT generic)
2. why: 1-2 sentences explaining the specific data/threshold that triggered this
3. suggestedAction: a drafted message or action the human can edit (2-3 sentences)
4. notePresets: 3 short (5-10 word) one-tap note options, contextual to THIS specific flag
5. guidance.whatItMeans: 1-2 sentences explaining what this situation likely means
6. guidance.principles: 1-2 grounded principles for approaching it (ask-don't-tell, validate-before-solving, GROW-stage framing where relevant)

Rules:
- Words first, color second
- AI drafts, humans decide — the suggestedAction is a DRAFT, not an order
- Be specific to the flag type — a confidence drop reads differently from disengagement
- Keep it concise
```

✅ Explicit "AI drafts, humans decide" rule baked into the prompt.
✅ Guidance principles include "ask-don't-tell, validate-before-solving" — coaching principles, not diagnosis.
✅ No diagnostic language requested.
⚠️ **Finding F-9 (still open).** "guidance.whatItMeans: 1-2 sentences
explaining what this situation likely means" — the word "likely" is good
hedging. The AI is asked to interpret, not diagnose. The full prompt
doesn't specify that the AI must avoid clinical terms — should add an
explicit "Never use diagnostic language; never state or imply a mental-
health diagnosis" rule (the narrative + explain + teacher-assistant +
draft-checkin prompts have this; action-dialog does not).

### 2.6 Comprehensive report generator

**File:** `/home/z/my-project/src/modules/comprehensive-report/index.ts` (lines 254–283)

System prompt rule 4 *(line 281)*:
> "Be professional — never diagnose, never judge character. Focus on behavior + evidence."

✅ Explicit anti-diagnosis rule.
✅ Rule 5: "Management attitude: assess whether the student shows signals of being able to manage others (reliability, communication, self-awareness, helping peers, taking feedback). This is forward-looking — even a beginner can show early manager signals."

⚠️ "Management attitude" is a forward-looking employability assessment
(early manager signals). This is appropriate for a bootcamp context but
the AI is asked to make a fairly speculative judgment
(`managerReadiness: Not Ready | Almost Ready | Ready | Strong`). The labels
are explicitly behavior-based (the prompt says "assess whether the student
shows signals of being able to manage others (reliability, communication,
self-awareness, helping peers, taking feedback)") so the basis is
observable behavior. **Acceptable**, but the cached comprehensive report
is persisted without human review (see §3.3) — a teacher could be
reading AI-generated "managerReadiness: Not Ready" without knowing the
AI's reasoning.

### 2.7 Narrative + explain routes

**File:** `/home/z/my-project/src/app/api/students/[id]/narrative/route.ts` (line 106)
System prompt: `"Write one paragraph (2-3 sentences) about this student's week. Plain language. Note what changed. Note uncertainty. Never diagnose. Roman script."`

**File:** `/home/z/my-project/src/app/api/students/[id]/explain/route.ts` (line 135)
System prompt: `"Write a short (4-6 sentence) narrative for a teacher about one student's trajectory this course. Plain language, not a data recitation. Note what changed and when. Note anything you're uncertain about rather than smoothing over it. Never state a clinical or psychological diagnosis. Use 'the data suggests' or 'appears to' language for behavioral observations. Write in Roman (Latin) script, matching the student's dominant language from their answers if not English."`

✅ Both prompts explicitly forbid diagnosis.
✅ `explain/route.ts` requires hedged language ("the data suggests", "appears to").
✅ Both require noting uncertainty rather than smoothing over it.

### 2.8 Teacher AI Assistant (batch queries)

**File:** `/home/z/my-project/src/app/api/teacher/assistant/route.ts` (lines 134–151)

System prompt rules:
1. "Cite which students and which specific signal led to your answer."
2. "If the data doesn't support a confident answer, say so — **do not speculate about a student's internal state beyond what the evidence shows.**"
3. "Use 'the data suggests' or 'appears to' language for behavioral observations."
4. "**Never state a clinical or psychological diagnosis.**"

✅ All four safeguards present. Excellent.

### 2.9 Draft-checkin (teacher-to-student message drafting)

**File:** `/home/z/my-project/src/app/api/students/[id]/draft-checkin/route.ts` (lines 117–125)

System prompt rules:
1. "Reference the concern factually (e.g. 'I noticed you haven't logged in for a few days' not 'I'm worried about your mental health')."
2. "Never state a clinical or psychological diagnosis."
3. "Match the teacher's communication style from the examples."

✅ Explicit example of what NOT to say ("I'm worried about your mental health"). Excellent concrete guidance.

### 2.10 Rehearse (teacher practice conversation)

**File:** `/home/z/my-project/src/app/api/students/[id]/rehearse/route.ts` (lines 91–106)

System prompt: "You are SIMULATING a student named {name} for a teacher's practice conversation. This is a REHEARSAL — not a prediction of how the real student will respond."

Rules:
1. Respond as this student would plausibly respond.
2. Stay in character.
3. If the teacher asks something the student wouldn't know, say so in character.
4. **Never provide information the real student hasn't shared.**
5. Roman script.
6. Short responses.

**Closing warning** *(line 106)*:
> "IMPORTANT: This is a SIMULATION for teacher practice. It is NOT a prediction of how the real conversation will go. The teacher should not treat this as fact about the student."

✅ Heavy emphasis on simulation-not-prediction. The session isn't persisted
by default. ✅

### 2.11 Case-review anonymization

**File:** `/home/z/my-project/src/app/api/mentorship/case-review/route.ts` (lines 27–31)

Prompt: "Anonymize this teacher's case description for peer review. Strip ALL identifying information: names, emails, specific dates, project names, anything that could identify the student. Keep the behavioral pattern and the mentorship question."

Returns the anonymized text for teacher review — never auto-publishes. ✅
The PUT endpoint (line 58) requires the teacher to confirm and re-submit
the `patternSummary` before it's persisted to `CaseReview`.

### 2.12 Touchpoint parser

**File:** `/home/z/my-project/src/app/api/mentorship/touchpoints/parse/route.ts` (lines 37–49)

Returns `{ parsed: {...}, requiresConfirmation: true }` — the teacher must
confirm before the touchpoint is saved. ✅ The endpoint is POST-only;
persistence happens in a separate `POST /api/mentorship/touchpoints` call
initiated by the teacher's "Confirm" button.

### 2.13 Safeguarding flag detector

**File:** `/home/z/my-project/src/lib/ai-assistant/safeguarding.ts`

**Pattern-based** (no AI call): aggressive_language, trauma_inducing,
neglect_of_distressed_student, inappropriate_tone, dismissive_of_distress.
Uses regex patterns *(lines 49–87)*.

**Guardrails:**
- "Deterministic pre-filter first — the AI never raises a flag on its own judgment alone." *(line 12)*
- "Escalation only after multiple corroborating signals, never a single message." *(line 14)*
- `createSafeguardingFlag` requires `signalCount ≥ 2` *(line 171)*.

✅ Strong safeguards. The flag stores message IDs (not text) — data
minimization. ✅

**Pattern coverage** *(lines 49–79):*
- `AGGRESSIVE_PATTERNS` — `stupid|idiot|dumb|useless|worthless|pathetic|failure|loser`, "you are/always/never wrong/stupid/bad/terrible", "shut up|don't speak|stop talking", "I'll fail you|you'll never pass|give up"
- `TRAUMA_PATTERNS` — "nobody cares|nobody will help|you're alone", "you deserve this|to fail", "kill|harm|hurt|damage yourself/your"
- `NEGLECT_PATTERNS` — "I don't have time for you/this", "not my problem|job|concern", "figure it out yourself|deal with it"
- `DISMISSIVE_PATTERNS` — "stop complaining|it's not that big a deal", "everyone else gets/did it", "you're overreacting|being dramatic"
- `INAPPROPRIATE_TONE_PATTERNS` — "you're too sensitive|grow up|act your age", "cry me a river|boo hoo|wah wah", "get over it|move on", "stop being so emotional|dramatic|weak"

**Over-flagging risk:** The patterns are deliberately conservative (word
boundaries via `\b`), so "stupid" matching inside "stupidly" is avoided.
The ≥2 corroboration requirement means a single careless message won't
create a flag. **Acceptable** balance between false positives and false
negatives.

### 2.14 Growth report

**File:** `/home/z/my-project/src/app/api/growth-reports/[userId]/route.ts` (lines 60–221)

The growth report is a deterministic data rollup — it does NOT call the AI.
It builds `strengths[]` and `growthAreas[]` from the student's PsychEvidence
dimension values using template strings.

⚠️ **Finding F-6 (NEW).** Line 159:
```
"Multiple avoidance responses ('I don't know', 'skip'). May indicate anxiety or lack of preparation. Create safe spaces for wrong answers."
```
This uses the clinical term "anxiety" — same issue as the (now-fixed)
psych-analyzer.ts and the (still-open) analysis-pipeline.ts line 181.
The M13 fix was applied inconsistently; this third location was missed.

Other than this single string, the growth-report template strings are
appropriately hedged and action-oriented. ✅

### 2.15 Daily motivation

**File:** `/home/z/my-project/src/app/api/daily-motivation/route.ts` (lines 37–51)

Prompt requires:
- Single line, max 15 words
- Generic (applies to any student any day)
- NOT about a specific technology
- Plain text only

No psych inference. ✅

### 2.16 Summary of psychological-inference audit

**Verdict:** The app's psychological inference is **consistently hedged
and non-diagnostic** across all 15 locations reviewed. The framework is
educational-psychology (Dweck, Sweller, Zimmerman, SDT, Dunning-Kruger) —
all used in their educational, non-clinical sense.

**Status of the previous audit's M5–M9 fixes:**
- ✅ M5/M13a (psych-analyzer.ts line 183): FIXED — "anxiety" → "uncertainty".
- ❌ M5/M13b (analysis-pipeline.ts line 181): NOT FIXED — still says "may indicate anxiety or fixed-mindset response".
- ❌ F-6 (growth-reports route line 159): NOT FIXED — still says "May indicate anxiety or lack of preparation" (new location not in prior audit).
- ✅ M6 (ai-prompts.ts line 194): FIXED — "What's their learning style?" → "What's their preferred way of engaging with the material?".
- ❌ M7 (ai-prompts.ts line 392): NOT FIXED — still says "PSYCHOLOGIST-STYLE COGNITIVE ANALYSIS".
- ❌ M8 (analysis-pipeline.ts line 124): NOT FIXED — still says "Dunning-Kruger signal".
- ❌ M9 (action-dialog system prompt): NOT FIXED — still no explicit "Never use diagnostic language" rule.

**Required fixes (small, listed in §4):**
1. analysis-pipeline.ts line 181: Replace "may indicate anxiety or fixed-mindset response" with "may indicate uncertainty or fixed-mindset response".
2. growth-reports/[userId]/route.ts line 159: Replace "May indicate anxiety or lack of preparation" with "May indicate uncertainty or lack of preparation".
3. ai-prompts.ts line 392: Replace "PSYCHOLOGIST-STYLE COGNITIVE ANALYSIS" with "COGNITIVE-PATTERN ANALYSIS".
4. analysis-pipeline.ts line 124: Replace "Dunning-Kruger signal" with "self-rated confidence was higher than actual performance".
5. action-dialog/route.ts system prompt: Add an explicit "Never use diagnostic language; never state or imply a mental-health diagnosis" rule.
6. final-result/route.ts AI prompt: Add the same anti-diagnosis rule (it currently lacks one — Finding F-13).
7. FinalResultPanel.tsx line 126: Rename the "Your Learning Style" heading to "Your Learning Patterns" or similar — avoids invoking the debunked "learning styles" construct (Finding F-15).

**Optional:** Consider adding a one-line "evidence-linked" reminder to
every psych-producing prompt: "Every claim must reference specific data
points from the evidence — no generalizations beyond what's in the data."

---

## 3. AI-drafts-humans-decide rule audit

This section lists EVERY place an AI output could affect a real person's
record or reputation, and confirms whether the AI drafts and a human
confirms, or whether the AI directly writes to the DB.

### 3.1 Action dialog — ✅ AI DRAFTS, HUMAN DECIDES

**File:** `/home/z/my-project/src/app/api/assistant/action-dialog/route.ts`

- Route header *(lines 17–18)*: "AI DRAFTS, HUMANS DECIDE — this endpoint generates content only. It does NOT send messages, flag people, or execute any action."
- The route returns JSON to the client. **No DB writes.**
- The client component `/home/z/my-project/src/components/shared/action-dialog.tsx` requires the human to type a note OR select a preset, and to click "Confirm". The Confirm button is disabled until a note is entered.
- The actual write (e.g. creating a MentorshipTouchpoint or resolving an alert) happens in a separate API call initiated by `onConfirm` — not by the action-dialog route itself.

✅ Compliant.

### 3.2 Report cards — ✅ HUMAN DECIDES (no AI in the loop)

**Files:**
- `/home/z/my-project/src/app/api/report-cards/route.ts` — staff-only POST writes the card. No AI call. All fields come from the request body.
- `/home/z/my-project/src/app/api/students/[id]/generate-report-card/route.ts` — staff-only POST. Computes the composite score from real data (weekly test scores, practice averages, task completion). No AI call.

✅ Compliant. Both routes require `isStaffRole(payload.role)` and IDOR
checks via `assertCanAccessStudent`. Audit logged via `logAudit` on the
cert path (not on report-cards — see §3.13).

### 3.3 Comprehensive reports — ⚠️ AI WRITES DIRECTLY TO DB (cached, no human review)

**File:** `/home/z/my-project/src/modules/comprehensive-report/index.ts`

`generateComprehensiveReport(userId)`:
1. Gathers all student data.
2. Calls the AI to produce `accomplishments`, `areasToImprove`, `managementAttitude`, `narrative` *(lines 332–341)*.
3. Builds the full report object.
4. **Caches it directly in the `AICache` table** *(lines 446–451)*: `db.aICache.upsert({ where: { cacheKey }, create: { ..., response: JSON.stringify(report) }, update: { ... } })`.

The cached report is returned on subsequent calls until
`forceRegenerate=true` is passed.

**Trigger:** `GET /api/students/[id]/comprehensive-report` — the route
calls `generateComprehensiveReport(id, { forceRegenerate })` and returns
the result. Anyone with access (the student themselves, their teacher,
their counsellor, principal, admin) can read it.

**Concerns:**
- The AI's `narrative`, `accomplishments`, `areasToImprove`, and `managementAttitude` are persisted without any human review.
- The report is described as PRIVATE (only visible to the student + staff with access), but it IS persisted.
- The `managementAttitude.managerReadiness` field is a forward-looking employability judgment that the AI makes about the student. If a teacher reads "managerReadiness: Not Ready" without realizing it's AI-generated, that could affect how they treat the student.

**Required fix (Finding F-3):** Either:
- (a) Mark the AI-generated fields as "AI draft — not yet reviewed" in the UI until a teacher reviews and approves them, OR
- (b) Add a `reviewed = false` flag to the cached report; require teacher review before the report becomes the "source of truth" for staff workflows.

**Partial mitigation already in place:**
- The system prompt rule 4 *(line 281)* says "never diagnose, never judge character."
- The cache key is invalidated when new evidence arrives (cacheKey includes the latest psych-evidence timestamp).
- The route is rate-limited and IDOR-protected.
- The route IS audit-logged when a privileged user views another person's report (line 69).

⚠️ Not compliant with strict AI-drafts-humans-decide. **Documented for fix.**

### 3.4 Weekly test scores — ⚠️ AI WRITES DIRECTLY TO DB (with teacher override path)

**File:** `/home/z/my-project/src/app/api/ai/weekly-test/route.ts`

`generateFinalAnalysis()`:
1. Calls the AI with the full transcript.
2. Parses `score`, `psychAnalysis`, `examinerComment`, `weaknesses`, `plagiarismScore`, `plagiarismBreakdown`, `engagementFeedback`, `feedback`.
3. Persists all of these directly to `WeeklyTest` row in a transaction.

**The AI's score is the score of record.** It is used by:
- Report-card composite (§1.12) — `weeklyTestScore` is the AI-generated score.
- Certificate grade (§1.9) — `avgScore` from AI-generated weekly test scores.
- SkillMastery updates — fed from AI-generated scores.
- PsychEvidence writing — fed from AI-generated scores and conversation.
- Wellbeing tier — fed from PsychEvidence derived from AI scores.
- Teacher dashboards, parent reports, etc.

**Human-in-the-loop paths that DO exist:**
- `/api/grades/override` — teacher can override `interaction` or `weeklyTest` scores. Audit-logged.
- `/api/students/[id]/edit-weekly-test` — teacher can edit `score`, `psychAnalysis`, `examinerComment` on a completed weekly test.
- `/api/students/[id]/allow-retake` — teacher can allow/revoke a retake.

**Concerns:**
- The override path exists, but it is opt-in by the teacher — there is no mandatory review gate before AI scores flow downstream.
- `psychAnalysis` and `examinerComment` are AI-written strings persisted verbatim. The teacher CAN edit them via `edit-weekly-test`, but doesn't HAVE to.
- `engagementFeedback.teacherNote` and `plagiarismBreakdown.teacherNote` are AI-written strings shown to teachers verbatim — they influence how the teacher perceives the student.

**Mitigation already in place:**
- The student-facing UI uses `needsStudyPlan = (test.score ?? 100) < 60` to buffer low scores with a kind message.
- The student-facing UI shows `plagiarismNotes` with explicit "some answers may need review" framing (not "you cheated") when plagiarism > 50.
- The teacher-facing portfolio shows the raw AI analysis (intentional — teachers should see the real signal).
- The scoring prompt is explicit about honesty: "A fake '70' for a student who actually scored 30 helps no one".

⚠️ Partially compliant. The AI writes the score of record; the human can override but doesn't have to. **Recommendation:** Surface AI-generated scores with a small "AI-generated — review if needed" indicator in the teacher UI for the first 7 days after the test, with the indicator fading once the test is ≥7 days old or once a teacher has viewed the result.

### 3.5 Daily test scores — ⚠️ AI WRITES DIRECTLY TO DB (no override path)

**File:** `/home/z/my-project/src/app/api/daily-test/route.ts`

Same pattern as weekly tests — AI grades via `gradeDailyTest()` → `gradeTest()`
(unified grader at `/modules/assessment/lib/unified-grader.ts`). Score is
persisted directly. `/api/grades/override` doesn't cover daily tests (only
`interaction` and `weeklyTest`). **Daily test scores cannot be overridden
by staff.**

⚠️ **Finding F-4.** Gap: daily test scores have no override path. Either
extend `/api/grades/override` to cover `dailyTest`, or document that daily
tests are explicitly low-stakes and don't need override.

### 3.6 Practice test scores — ⚠️ AI WRITES DIRECTLY TO DB (override via interaction)

**File:** `/home/z/my-project/src/app/api/ai/practice/route.ts` (calls `gradeTest()` from unified-grader.ts)

Same pattern. Practice scores feed `Interaction` rows (used by skill
mastery + report card composite). `/api/grades/override` DOES cover
interactions, so practice scores can be overridden via the interaction
path. ✅

### 3.7 Psych evidence — ⚠️ AI-DERIVED EVIDENCE WRITES DIRECTLY TO DB (no human review)

**File:** `/home/z/my-project/src/modules/assessment/lib/analysis-pipeline.ts` (lines 254–271)

`writePsychEvidence(input)` writes 7 `PsychEvidence` rows per test completion.
The `evidenceText` strings are template-generated from real data (score,
answer lengths, plagiarism score, language signals) — they are NOT raw AI
output. The AI's only contribution is:
- The plagiarism score (weekly test).
- The engagement feedback (subjectChanges, avoidanceCount).

Everything else in the evidence text is computed deterministically from
the conversation + score.

**Persistence:** Direct DB write, no human review. The evidence drives:
- Wellbeing tier (§1.2) — via `recomputeWellbeingState`.
- Teacher dashboards (Psychological tab).
- Comprehensive reports.
- Growth reports.
- Counselor overview.

**Staff can write additional evidence** via `POST /api/psych-evidence` (manual entry, no AI). Staff CAN'T edit or delete AI-written evidence rows through any documented route (only the `admin/cleanup-psych-data` route deletes them, admin-only).

⚠️ The AI-derived evidence (specifically the `value` labels like
`overconfident`, `fixed_mindset`, `voice_inconsistency`) is persisted
without review. These labels then drive the wellbeing tier, which drives
alerts, which drive teacher outreach. **The chain is automatic end-to-end.**

**Mitigation:**
- The labels are deterministic functions of measurable inputs (gap > 20, score < 40, plagiarism > 50). They're not free-form AI judgments.
- The evidence text always explains the data behind the label.

**Recommendation (Finding F-5):** Add a `disputed` flag to `PsychEvidence`
so a teacher can flag a row as "I disagree with this label" without
deleting it. This preserves the audit trail while letting teachers correct
misleading labels. Disputed rows should be excluded from
`recomputeWellbeingState` ratio computation.

### 3.8 Alerts — ⚠️ SOME AUTO-CREATED, HUMAN RESOLVES

**Files:**
- `/home/z/my-project/src/modules/assessment/lib/engagement-tracker.ts` (lines 220–237) — auto-creates `StudentAlert` rows when `checkAlertThresholds` triggers.
- `/home/z/my-project/src/modules/self-paced/index.ts` (lines 162–183) — auto-creates `self_paced_cheat` alerts.
- `/home/z/my-project/src/lib/ai-assistant/safeguarding.ts` (lines 162–206) — `createSafeguardingFlag` writes a `StudentAlert` with `type="safeguarding"`. Requires ≥ 2 corroborating signals.
- `/home/z/my-project/src/lib/ai-assistant/escalation.ts` (lines 141–174) — `escalateFlag` writes `severity="red"` + escalates `WellbeingState`.

**Auto-created alert types:**
- `psychological` (from psych-analyzer thresholds)
- `educational` (from test score thresholds)
- `mentorship` (from engagement streak / inactivity)
- `self_paced_cheat` (from anti-cheat flags)
- `safeguarding` (from deterministic pattern match — NOT AI)

**Human resolution path:**
- `/api/students/alerts` PATCH — staff can resolve or acknowledge with a `resolutionNote`.
- `/api/crisis-flags` PATCH — staff can resolve crisis flags.

**The auto-created alerts are NOT AI free-form text.** The `reason` field
is a deterministic template string (e.g. "Student mood score is very low
(25/100). Multiple frustration or avoidance signals detected. Consider a
wellbeing check-in."). The AI doesn't write the alert reason — the
template does.

⚠️ Alerts are auto-created (correct behavior — early warning system), and
the human resolution path exists. **Compliant.** The only AI involvement
in alerts is:
- AI plagiarism scores flow into the `gaming_pattern` dimension, which can contribute to wellbeing tier, which can contribute to alerts. (Indirect.)
- AI test scores flow into the `cognitive_load` dimension. (Indirect.)
- Safeguarding alerts are explicitly deterministic — the AI never raises a safeguarding flag on its own judgment (§2.13). ✅

### 3.9 Crisis flags — ✅ HUMAN CREATES, HUMAN RESOLVES

**File:** `/home/z/my-project/src/app/api/crisis-flags/route.ts`

- POST requires staff role, validates `category` and `severity`.
- Never stores the sensitive content of what was said — only category + severity + evidenceRef pointer.
- Auto-creates a MentorshipTouchpoint so the Mentorship tab shows it.
- Notifies counselors + principals via in-app messages.
- PATCH resolves/acknowledges with audit log.

✅ Fully human-driven. The AI never creates a crisis flag.

### 3.10 Project auto-report — ⚠️ AI WRITES DIRECTLY TO DB

**File:** `/home/z/my-project/src/app/api/project/auto-report/route.ts` (lines 170–179)

The auto-report route saves `ProjectReport.reportText` and
`ProjectReport.aiAnalysis` (JSON) directly to the DB. The response
includes `autoGenerated: true`.

**Concerns:**
- The AI's analysis (`score`, `projectUnderstanding`, `technicalDepth`, `progress`, `clarity`, `strengths`, `weaknesses`, `feedback`) is persisted without review.
- These feed the comprehensive report generator and the final project analysis route.

**Mitigation:**
- The student is told the report was auto-generated and can edit before "submitting" it officially (per the route docstring, lines 22–25).
- There's a separate `/api/students/[id]/generate-project-analysis` route that generates a FINAL project analysis. This route is staff-initiated and the analysis is RETURNED to the teacher, not persisted — the teacher decides whether to use it.

⚠️ Auto-report is auto-persisted but labeled `autoGenerated: true`. Final
project analysis is returned to the teacher (not auto-persisted). **Mostly
compliant.**

### 3.11 Project analysis (final) — ✅ AI DRAFTS, TEACHER RECEIVES

**File:** `/home/z/my-project/src/app/api/students/[id]/generate-project-analysis/route.ts`

Returns the analysis JSON to the caller. **Does NOT persist.** The teacher
decides how to use it (e.g. enters it into a report card manually).

✅ Compliant.

### 3.12 Project tasks (course-aligned) — ⚠️ AI WRITES DIRECTLY TO DB

**File:** `/home/z/my-project/src/modules/project/lib/course-aligned-planner.ts` (lines 294–330)

`generateCourseAlignedPlan()` saves `ProjectTask` and `ProjectWeek` rows
directly to the DB in a transaction. No human review gate.

**Mitigation:**
- The student is the only person these tasks affect (their own dashboard).
- The student can edit or delete tasks via the Project tab UI.
- The tasks do not affect grades, certificates, or wellbeing tier directly.
- The `replace=false` default refuses to overwrite existing tasks without explicit intent.
- The transaction deletes old tasks + comments AFTER the AI succeeds — old data is preserved on AI failure.
- A deterministic fallback runs if the AI call fails.

⚠️ Partially compliant — the AI-generated tasks are auto-persisted but
the blast radius is limited to the student's own dashboard. **Acceptable.**

### 3.13 Narrative + explain — ⚠️ AI WRITES TO CACHE (no human review)

**Files:**
- `/home/z/my-project/src/app/api/students/[id]/narrative/route.ts` (lines 112–116) — caches narrative paragraphs in `AICache`.
- `/home/z/my-project/src/app/api/students/[id]/explain/route.ts` (lines 152–166) — caches the narrative in `AICache`.

Both routes cache the AI-generated narrative and return the cached version
on subsequent requests. The cache is invalidated when new evidence arrives
(key includes latest evidence timestamp).

**Concerns:**
- The narrative is shown to staff as "the AI's view of this student's trajectory."
- It's persisted (in AICache) but labeled as AI-generated.
- No human review before display.

**Mitigation:**
- The UI displays these narratives alongside the underlying data (evidence, scores, touchpoints) — teachers can cross-check.
- The prompts explicitly forbid diagnosis and require hedged language (§2.7).

⚠️ Cached without review. **Recommendation:** Display a "AI-generated
narrative — verify against evidence" label in the UI.

### 3.14 Final result AI behavioral analysis — ⚠️ AI OUTPUT SHOWN WITHOUT REVIEW

**File:** `/home/z/my-project/src/app/api/students/final-result/route.ts` (lines 137–219)

The route calls the AI on every request (rate-limited) and returns the
`behavioralPattern`, `areasToImprove`, `overallAssessment`, `careerReadiness`
fields directly in the response. The AI output is **not persisted** (no
AICache write), but it IS shown to the student and any staff who view the
result.

**Concerns:**
- The AI's behavioral pattern analysis is shown to the student under the heading "Your Learning Style" (FinalResultPanel.tsx line 126) — a deprecated psychological construct.
- The AI's career readiness verdict ("Ready / Almost Ready / Needs More Practice") is shown to the student once they've completed ≥ 5% of the course.
- The AI prompt (lines 168–196) asks for behavioral inference but does NOT include the "Never state a clinical or psychological diagnosis" rule that other prompts have.

⚠️ **Finding F-13.** Add the anti-diagnosis rule to the final-result prompt.
⚠️ **Finding F-14.** Display an "AI-generated" indicator in the UI near the
behavioral pattern text.
⚠️ **Finding F-15.** Rename "Your Learning Style" heading in
FinalResultPanel.tsx to "Your Learning Patterns" or similar.

### 3.15 Audit trail gaps

The audit log captures: `crisis_flag_created`, `crisis_flag_updated`,
`certificate_requested`, `certificate_rejected`, `AuditAction.CERTIFICATE_GENERATED`,
`AuditAction.GRADE_CHANGED`, `comprehensive_report_viewed`.

**Missing audit events:**
- `psych_evidence_written` (auto-written by pipeline, no audit)
- `student_alert_auto_created` (no audit when the engagement tracker creates an alert)
- `wellbeing_state_changed` (no audit when recomputeWellbeingState or escalateFlag changes the tier)
- `report_card_generated` (no audit on `generate-report-card` route)
- `comprehensive_report_cached` (no audit when AI output is persisted to AICache)
- `final_result_generated` (no audit when AI behavioral analysis is generated)

**Recommendation (Finding F-18):** Add audit events for every auto-write
that affects a student's record. The audit log should make it possible to
reconstruct "why is this student's tier red right now?" purely from log
entries.

### 3.16 Summary of AI-drafts-humans-decide audit

| # | Location                              | Pattern                              | Compliant? |
|---|---------------------------------------|--------------------------------------|------------|
| 1 | Action dialog                         | AI drafts, human confirms            | ✅ Yes    |
| 2 | Report cards (manual POST)            | Human-only, no AI                    | ✅ Yes    |
| 3 | Report cards (generate endpoint)      | Deterministic, no AI                 | ✅ Yes    |
| 4 | Comprehensive reports                 | AI writes to cache, no review        | ⚠️ No     |
| 5 | Weekly test scores                    | AI writes, human can override        | ⚠️ Partial |
| 6 | Daily test scores                     | AI writes, NO override path          | ⚠️ No     |
| 7 | Practice scores                       | AI writes, override via interaction  | ⚠️ Partial |
| 8 | Psych evidence                        | AI-derived labels auto-persist       | ⚠️ No     |
| 9 | Alerts (psychological/educational/mentorship) | Auto-created, human resolves | ✅ Yes |
| 10 | Self-paced cheat alerts              | Auto-created, human resolves         | ✅ Yes    |
| 11 | Safeguarding alerts                  | Deterministic, ≥2 signals, human resolves | ✅ Yes |
| 12 | Crisis flags                         | Human creates, human resolves        | ✅ Yes    |
| 13 | Project auto-report                  | AI writes, labeled autoGenerated     | ⚠️ Partial |
| 14 | Final project analysis               | AI drafts, teacher receives          | ✅ Yes    |
| 15 | Project tasks (course-aligned)       | AI writes, student can edit          | ⚠️ Partial |
| 16 | Narrative + explain                  | AI writes to cache, no review        | ⚠️ No     |
| 17 | Touchpoint parser                    | AI drafts, human confirms            | ✅ Yes    |
| 18 | Case-review anonymization            | AI drafts, human confirms            | ✅ Yes    |
| 19 | Topic guidance                       | AI drafts, teacher approves via PUT  | ✅ Yes    |
| 20 | Draft check-in                       | AI drafts, teacher edits + sends     | ✅ Yes    |
| 21 | Rehearse simulation                  | AI generates, NOT persisted          | ✅ Yes    |
| 22 | Daily motivation                     | AI generates (cached daily), no psych inference | ✅ Yes |
| 23 | Final result behavioral analysis     | AI output shown, not persisted, no review | ⚠️ No |

**Summary:** 13/23 fully compliant. 10 partially or not compliant. The
non-compliant items all share the same pattern: AI output is persisted
(or shown directly) without a human review gate, then surfaces in staff
workflows as if it were ground truth.

---

## 4. Findings & required fixes

### 4.1 Required fixes (priority order)

#### HIGH — Privacy / record integrity

1. **Comprehensive reports** (§3.3, F-3): Add a `reviewed` flag. AI-generated fields should be marked "AI draft" in the UI until a teacher reviews them. Persisted AI judgments about `managerReadiness` and `leadershipPotential` should not appear in staff workflows without a visible AI-draft label.

2. **Daily test scores have no override path** (§3.5, F-4): Either extend `/api/grades/override` to cover `dailyTest`, or document that daily tests are explicitly low-stakes and unreviewable. Currently a teacher who disagrees with an AI daily-test score has no recourse.

3. **Psych evidence has no dispute mechanism** (§3.7, F-5): Add a `disputed` flag to `PsychEvidence`. A teacher who disagrees with a label like `overconfident` should be able to mark it disputed (with a reason) without deleting it. Disputed rows should be excluded from `recomputeWellbeingState` ratio computation.

4. **Audit log gaps** (§3.15, F-18): Add audit events for `psych_evidence_written`, `student_alert_auto_created`, `wellbeing_state_changed`, `report_card_generated`, `comprehensive_report_cached`, `final_result_generated`. Make it possible to reconstruct tier changes from the audit log alone.

5. **Final-result AI prompt lacks anti-diagnosis rule** (§3.14, F-13): Add "Never state a clinical or psychological diagnosis" to the system prompt at `/api/students/final-result/route.ts` lines 168+. The narrative, explain, teacher-assistant, draft-checkin, and rehearse prompts have this rule; the final-result prompt does not.

#### MEDIUM — Inference framing

6. **Remove "anxiety" from analysis-pipeline.ts** (§2.2, F-5): Line 181 — replace `"may indicate anxiety or fixed-mindset response"` with `"may indicate uncertainty or fixed-mindset response"` (matching the M13 fix already applied to psych-analyzer.ts).

7. **Remove "anxiety" from growth-reports route** (§2.14, F-6): Line 159 — replace `"May indicate anxiety or lack of preparation"` with `"May indicate uncertainty or lack of preparation"` (new location not in prior audit).

8. **Drop "PSYCHOLOGIST-STYLE" framing** (§2.3, F-8): ai-prompts.ts line 392 — rename "PSYCHOLOGIST-STYLE COGNITIVE ANALYSIS" to "COGNITIVE-PATTERN ANALYSIS". The AI is not a psychologist.

9. **Soften "Dunning-Kruger signal"** (§2.2, F-7): analysis-pipeline.ts line 124 — replace with "self-rated confidence was higher than actual performance". Name the observation, not the bias.

10. **Add explicit anti-diagnosis rule to action-dialog prompt** (§2.5, F-9): action-dialog/route.ts system prompt should include "Never use diagnostic language; never state or imply a mental-health diagnosis".

11. **Rename "Your Learning Style" heading** (§2.16, F-15): FinalResultPanel.tsx line 126 — rename to "Your Learning Patterns" or "How You Engage". The "learning styles" construct is debunked (Pashler et al., 2008).

12. **Surface AI-draft labels in UI** (§3.13, §3.14, F-14): Display "AI-generated — verify against evidence" near cached narratives (narrative + explain routes) and the final-result behavioral pattern text.

#### MEDIUM — Formula consistency

13. **Two teacher-load formulas disagree** (§1.3, F-10): `teacher-load.ts` and `/api/teacher/load/route.ts` use different thresholds and can disagree for the same teacher. Unify or document explicitly that they answer different questions ("how loaded are you right now?" vs. "how loaded are you on the institution-wide roster?").

14. **NaN guard on scoreToGrade** (§1.1, F-1): Add `if (!Number.isFinite(score)) return "F";` or throw. Currently relies on caller clamping.

15. **Duplicate scoreToGrade in comprehensive-report** (§1.1, F-2): `/modules/comprehensive-report/index.ts` lines 195–201 duplicates the function. Import from `@/lib/constants` instead.

16. **Attention score blocked-task wording mismatch** (§1.6, F-12): The blocked-task award is flat `+10` regardless of how many tasks are blocked, but the reason string says `"${blockedTasks} blocked task(s)"` implying per-task points. Either change to `+10 × blockedTasks` or change the reason string to "Has blocked task(s)".

17. **14-day consistency uses server-local timezone** (§1.11, F-16): The `today.setHours(0, 0, 0, 0)` call uses the server's local timezone, not the student's. A daily log submitted at 11pm PST on Monday will be stored as Tuesday UTC and may not match "today" from the student's perspective. Consider computing the date bucket in the student's timezone (requires storing the student's TZ on the User record).

#### LOW — Documentation / clarity

18. **Rename `generate-report-card` to `compute-report-card`** (§1.12, F-17): The route is deterministic and the "generate" name implies AI involvement that doesn't exist.

19. **Soft indicator on AI scores for 7 days** (§3.4): Weekly test scores shown to teachers could carry a small "AI-generated — review if needed" indicator for the first 7 days or until viewed.

20. **Concatenate rather than replace `reasonsJson` on escalation** (§1.5): `escalateFlag` writes `reasonsJson: JSON.stringify([reason])` — replaces the array, losing the original ratio-based reasons. Concatenate to preserve the audit trail.

### 4.2 Status of the previous audit's recommendations

The prior "Section 5" draft in this file listed 17 required fixes. Status:

| # | Prior recommendation | Status |
|---|----------------------|--------|
| 1 | Comprehensive reports: add `reviewed` flag | ❌ Not done (still F-3) |
| 2 | Daily test scores: extend override or document low-stakes | ❌ Not done (still F-4) |
| 3 | Psych evidence: add `disputed` flag | ❌ Not done (still F-5) |
| 4 | Audit log gaps | ❌ Not done (still F-18) |
| 5 | Remove "anxiety" from psych-analyzer | ✅ **DONE** (M13 applied) |
| 6 | Stop asking AI to infer "learning style" | ✅ **DONE** (M6 applied) |
| 7 | Drop "PSYCHOLOGIST-STYLE" framing | ❌ Not done (still F-8) |
| 8 | Soften "Dunning-Kruger signal" | ❌ Not done (still F-7) |
| 9 | Add anti-diagnosis rule to action-dialog | ❌ Not done (still F-9) |
| 10 | Two teacher-load formulas disagree | ❌ Not done (still F-10) |
| 11 | Attention score bug: "recent" low-confidence logs are lifetime | ✅ **RESOLVED AS NON-ISSUE** — the DB query already limits to `take: 5`, so the filter IS scoped to the last 5 logs. The prior audit was wrong about this. |
| 12 | Attention score blocked-task wording mismatch | ❌ Not done (still F-12) |
| 13 | NaN guard on scoreToGrade | ❌ Not done (still F-1) |
| 14 | Duplicate scoreToGrade in comprehensive-report | ❌ Not done (still F-2) |
| 15 | Rename `generate-report-card` | ❌ Not done (still F-17) |
| 16 | Surface AI-draft labels in UI for narrative + explain | ❌ Not done (still F-14) |
| 17 | Soft indicator on AI scores for 7 days | ❌ Not done |

**Net:** 2 of 17 fixes applied (M5/M13a, M6). 1 was a non-issue (the
attention-score "recent" claim was wrong). 14 still open. Three NEW
findings added in this audit: F-6 (growth-reports "anxiety"), F-13
(final-result prompt lacks anti-diagnosis rule), F-15 ("Your Learning
Style" heading invokes debunked construct), F-16 (timezone bucketing bug).

---

## 5. What's working well

No changes needed in these areas — they're exemplary:

- **Safeguarding flag pipeline** (§2.13, §3.8): Deterministic pre-filter, ≥2 corroborating signals, principal-only access, data minimization (message IDs not text), teacher cannot see their own flags. Exemplary design.
- **Action dialog component** (§3.1): AI drafts, human confirms, note required. The reusable dialog is well-designed.
- **Crisis flag flow** (§3.9): Fully human-driven, audit-logged, evidence-ref pointer (no content duplication).
- **Rehearse simulation** (§3.21, §2.10): Heavy "simulation not prediction" framing, not persisted by default.
- **AI Tutor prompt** (§2.4): Explicit "you teach, you don't grade" rule, explicit "don't play therapist" rule for disengaged students.
- **Teacher AI Assistant prompt** (§2.8): All four safeguards (cite evidence, no speculation about internal state, hedged language, no diagnosis).
- **Draft check-in prompt** (§2.9): Concrete good/bad example ("I noticed you haven't logged in" vs "I'm worried about your mental health").
- **Plagiarism deduction** (§1.13): Transparent formula, student sees both raw and deducted scores, label wording is graded ("possible AI use" → "almost certainly copied").
- **Skill mastery rolling blend** (§1.7): The 40/60 weighting (after 3 evidence points) prevents a single bad test from erasing mastery. Good design.
- **Wellbeing tier decay** (§1.2): If no evidence in 14 days AND no open crisis flags, tier decays to green. Prevents stale red tiers.
- **14-day rolling consistency** (§1.11): Replaces the brittle streak counter with a recoverable percentage — grounded in the "what-the-hell effect" research on broken streaks.
- **Course-aligned project planner** (§1.8): Tasks build on the course topic for that day, with a deterministic fallback if the AI fails. The `day` column sync point makes the daily dashboard coherent.
- **Final-result career readiness badge gating** (§1.10): The badge only shows once the student has completed ≥ 5% of the course — protects Week-1 students from a brutal "Not Ready" verdict.
- **Final-result plagiarism stat hidden from student** (§1.10): Teacher-only in the portfolio — students don't feel surveilled.
- **Escalation engine** (§1.5): Pure `shouldEscalate` function is testable; on-write + scheduled job cover both immediate and duration-based triggers.

---

## 6. Learn test difficulty adaptation (2026-09, learner-paced model)

Covers the **Learn** platform tests (`/api/learn/daily-test/*`,
`/api/learn/weekly-test/*`) — a separate pipeline from the legacy
teacher-dashboard tests documented above. Implementation:
`src/modules/learn/lib/learner-difficulty.ts`.

### 6.1 Course model assumptions

- Weeks/days are a **management structure** (content organization), not a
  calendar. The learner may complete several days' topics in one day;
  progression lives in `LearnProfile.masteryMap` per topic.
- Test sequence is fixed: **daily test** after each study session →
  **weekly test** for week W once the learner has REACHED week W's last day
  (server-enforced `OUT_OF_SEQUENCE` guard). "After 5–6 days" means 5–6 days
  of CONTENT, learner-paced.

### 6.2 Difficulty level calculation

| Step | Rule |
|:---|:---|
| Sources | Last 8 completed tests per (user, course): `LearnDailyTest` + `LearnWeeklyTest` |
| Normalization | `score / questionCount` → 0..1 per test (daily score is a 0..3 sum, weekly a 0..10 sum; both are sums of per-question 0..1 scores) |
| Kind weight | Weekly tests ×2 (10 questions is a bigger signal than 3) |
| Recency weight | Linear, oldest = 1 … newest = N (multiplied by the kind weight) |
| Level bands (avg) | ≥0.85 → 5 Expert · ≥0.70 → 4 Advanced · ≥0.55 → 3 Stretch · ≥0.40 → 2 Core · else 1 Warm-up |
| Cold start | No completed tests → level 2 (Core): kind, but not trivia |
| Failure mode | Any DB error → level 2; question generation NEVER blocked |

The level maps to a **directive** injected into the question-generation system
prompt (`LEARN_DIFFICULTY_DIRECTIVES`). Every directive is application-first
(WHY / HOW / WHAT-IF, real situations) at ALL levels — a low level means
gentler scenarios and more scaffolding, never bare-definition recall. Daily
tests additionally ramp within the band (Q1 easiest → Q3 hardest).

### 6.3 Token-cache interaction

The directive is part of the prompt, and the token cache
(`token-cache.ts`) keys on the exact messages — so the cache naturally
shards per (course, day/week, **difficulty level**). Learners in the same
level still share one cached generation (6h TTL); grading remains
per-student and uncached. Difficulty data also rides additively on each
stored question (`difficultyLevel`, `difficultyLabel`) so resumed tests
display their band without a schema migration.

---

## End of Section 3

This document is the permanent reference for:
- Every scoring / calculation formula in the app
- Every psychological / behavioral inference the app makes
- Every place an AI output can affect a real person's record

Next sections (4+) should build on this to cover data retention / deletion,
consent flows, and the specific UI affordances for the `humanReviewed` flag
recommended in §4.1.
