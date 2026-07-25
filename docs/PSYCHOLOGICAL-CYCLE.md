# The ExaminerAI Psychological Analysis Cycle

> **Purpose of this document:** Define, in professional and clinical-respectful
> language, the complete cycle by which ExaminerAI observes student behavior,
> derives psychological evidence, computes wellbeing tiers, surfaces alerts,
> and routes them into mentorship and safeguarding pathways. This document
> also describes the teaching and assessment logic that the AI Tutor and the
> Socratic test chatbots share, so that the psychological cycle is grounded
> in the pedagogical intent of the platform.

This is a companion to `docs/SEVEN-DIMENSIONS.md` (which describes each
individual dimension) and `docs/MENTORSHIP-CYCLE.md` (which describes the
mentorship + mental-health response pathways). Read all three together.

---

## 1. Guiding principles

ExaminerAI is **not** a clinical instrument. It is an **early-warning and
mentorship-support system** designed for software bootcamps and short
vocational courses. The psychological cycle is governed by five principles:

1. **Evidence, not diagnosis.** Every observation is recorded as
   `PsychEvidence` — a fact with a dimension, a value, evidence text, and a
   source. The system never labels a student "depressed" or "anxious". It
   records that the student exhibited a `frustration_signal` in their tutor
   chat on Tuesday, scored below their self-rated confidence on three daily
   tests, and wrote fewer than 50 characters per answer in the weekly test.
   The interpretation is left to the human mentor.

2. **Always-on, best-effort, non-blocking.** The pipeline runs after every
   test completion and on every AI Tutor message. It runs in
   `Promise.allSettled` mode — any stage that fails is logged and skipped,
   never propagated to the student. The user experience is never blocked by
   analysis.

3. **Trajectory, not snapshot.** A single low score is not a signal. The
   system is designed to surface *patterns over time* — 14-day windows for
   wellbeing tier computation, 7-day timers for amber-flag escalation,
   multi-test trend tracking for skill mastery. Single measurements are
   stored; multi-measurement patterns drive alerts.

4. **Human in the loop, always.** Every alert, every action, every
   safeguarding flag requires a human to acknowledge and act. The AI drafts
   suggested actions and notes; the human approves, edits, or dismisses.
   There is no automated intervention into a student's account.

5. **Scope-respecting by design.** A teacher sees only their batch's
   psychological evidence. A counsellor sees wellbeing evidence
   institution-wide but is scoped away from curriculum data. A principal
   sees everything, including safeguarding flags about staff. The AI
   Assistant never receives evidence outside the caller's scope — the
   `resolveAssistantScope()` check runs *before* any AI query.

---

## 2. The cycle at a glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STUDENT INTERACTION                            │
│  AI Tutor chat  •  Daily test  •  Weekly test  •  Project report        │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────┐
        │  1. REAL-TIME HEURISTIC ANALYSIS (no AI call)  │
        │     psych-analyzer.ts — runs in <1ms            │
        │     Mood / engagement / frustration /           │
        │     avoidance / enthusiasm / growth-mindset     │
        └────────────────────┬───────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────┐
        │  2. POST-TEST AI ANALYSIS (test completions)   │
        │     weekly-test route → DeepSeek V4 Flash       │
        │     Returns: psychAnalysis, examinerComment,    │
        │     plagiarismScore, engagementFeedback         │
        └────────────────────┬───────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────┐
        │  3. EVIDENCE EXTRACTION (deterministic)        │
        │     analysis-pipeline.ts → writePsychEvidence  │
        │     Writes 7 PsychEvidence rows per test:      │
        │     calibration, depth, gaming, attribution,   │
        │     cognitive load, SRL phase, fluency         │
        └────────────────────┬───────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────┐
        │  4. CONFIDENCE + SKILL MASTERY UPDATE          │
        │     writeConfidenceRatings  (calibration gap)  │
        │     writeSkillMastery       (per-topic trend)  │
        └────────────────────┬───────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────┐
        │  5. WELLBEING TIER RECOMPUTE (14-day window)   │
        │     recomputeWellbeingState                    │
        │     Green (≤35% concerning) → Amber (35-60%)   │
        │     → Red (>60% OR open crisis flag)           │
        └────────────────────┬───────────────────────────┘
                             │
              ┌──────────────┴───────────────┐
              │                              │
              ▼                              ▼
   ┌─────────────────────┐       ┌────────────────────────┐
   │  6a. AUTO-TOUCHPOINT│       │  6b. STUDENT ALERT      │
   │  on tier transition │       │  generated if thresholds│
   │  → teacher's queue  │       │  crossed (inactivity,   │
   │  (type: alert_      │       │  score drop, low conf,  │
   │   response)         │       │  cognitive load, etc.)  │
   └─────────┬───────────┘       └──────────┬─────────────┘
             │                              │
             └──────────────┬───────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────────────┐
        │  7. ESCALATION ENGINE (amber → red)            │
        │     Trigger 1: amber ≥ 7 days unresolved       │
        │     Trigger 2: 3rd+ repeat = immediate red;    │
        │     2nd repeat = shortened 2-day timer         │
        └────────────────────┬───────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────┐
        │  8. AI ASSISTANT ACTION DIALOG                 │
        │     AI drafts: headline, why, suggested action,│
        │     3 one-tap note presets, in-action guidance │
        │     → Teacher reviews, edits note, confirms    │
        │     → MentorshipTouchpoint recorded            │
        └────────────────────┬───────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────┐
        │  9. PARALLEL: SAFEGUARDING WATCH (staff→       │
        │     student messages only)                     │
        │     Deterministic regex pre-filter → AI        │
        │     explains candidates → 2+ corroborating     │
        │     signals → principal-only flag              │
        └────────────────────────────────────────────────┘
```

---

## 3. Stage 1 — Real-time heuristic analysis (no AI call)

**File:** `src/modules/assessment/lib/psych-analyzer.ts`

Every AI Tutor message the student sends is analyzed locally, in under one
millisecond, with no API call. The analyzer extracts:

| Signal | Source | Effect |
|---|---|---|
| `frustrationSignal` | Keyword match: "frustrated", "can't do", "too hard", "give up", "waste of time", "burnt out", "anxious", "scared", "tired", etc. | moodScore −20 per hit (capped at 3 hits) |
| `avoidanceSignal` | Keyword match: "i don't know", "skip", "pass", "whatever", "don't care", "boring", "not interested" | moodScore −15, engagementScore −20 |
| `enthusiasmSignal` | Keyword match: "interesting", "cool", "got it", "makes sense", "thank you", "want to try", "can you explain more" | moodScore +15, engagementScore +20 |
| `growthSignal` (Dweck) | Keyword match: "learn", "practice", "improve", "try again", "get better", "challenge" | engagementScore +10 |

The output is a `MessagePsychSnapshot` with `moodScore` (0–100),
`engagementScore` (0–100), and a human-readable `signals[]` list. These
snapshots are aggregated daily into `StudentHealthSummary` so the teacher
dashboard can render mood and engagement trends without re-running the
analyzer.

**Theoretical grounding:** Self-Determination Theory (autonomy / competence /
relatedness), Cognitive Behavioral patterns (avoidance, catastrophizing,
all-or-nothing thinking), Dweck's growth-mindset research, and Fredericks'
three-component model of academic engagement (behavioral, emotional,
cognitive).

**Important:** These are heuristic scores for early-warning teacher alerts,
**not** clinical diagnoses. A low moodScore means "the teacher should check
in", not "the student is depressed".

---

## 4. Stage 2 — Post-test AI analysis (test completions only)

**Files:** `src/app/api/ai/weekly-test/route.ts`, `src/app/api/ai/practice/route.ts`, `src/app/api/ai/daily-test/route.ts`

When a student completes a test, the full conversation is sent to the AI
(DeepSeek V4 Flash — primary, with Z.ai as fallback) along with a
test-specific system prompt. The AI returns four artifacts:

1. **`psychAnalysis`** — A natural-language paragraph summarizing the
   student's behavioral and emotional state during the test. This becomes
   evidence text on the `PsychEvidence` rows.
2. **`examinerComment`** — A teacher-facing note about the student's
   performance, including strengths and areas to improve.
3. **`score`** (0–100) — Computed by the AI based on correctness, depth of
   reasoning, and engagement. The unified-grader contract (`unified-grader.ts`)
   ensures all three test types use the same scoring philosophy.
4. **`plagiarismScore`** (0–100, weekly tests only) — Voice-inconsistency
   detection. High scores indicate the answer style deviates significantly
   from the student's baseline, suggesting possible AI-generated content.

The AI is constrained to:
- Never state a clinical or psychological diagnosis
- Use "the data suggests" or "appears to" language
- Cite specific evidence from the conversation
- Keep the analysis concise and teacher-actionable

The token budget is 500 tokens per reply (5-question daily test) up to
4,000 tokens for the final weekly analysis.

---

## 5. Stage 3 — Evidence extraction (deterministic)

**File:** `src/modules/assessment/lib/analysis-pipeline.ts` → `writePsychEvidence()`

This is the heart of the cycle. After every test, **seven `PsychEvidence`
rows are written** — one per dimension, every time. The previous behavior
(only writing evidence when strict conditions were met) caused most
dimensions to be empty; the current behavior guarantees a complete picture.

Each row contains: `userId`, `dimension`, `value`, `evidenceText`,
`sourceType` (e.g. `weekly_test`), `sourceId` (the test ID), and `week`.

The seven dimensions (full details in `docs/SEVEN-DIMENSIONS.md`):

| # | Dimension | Derived from | Possible values |
|---|---|---|---|
| 1 | Calibration | Self-rated confidence vs. actual score (daily tests); score-only fallback for weekly | `overconfident`, `underconfident`, `well-calibrated`, `no_self_rating` |
| 2 | Explanatory Depth | Average character length of student answers | `surface_answers` (<50c), `moderate_depth` (50-300c), `detailed_reasoning` (>300c) |
| 3 | Gaming Pattern | Plagiarism score (weekly) or answer-length variance (daily) | `voice_inconsistency`, `authentic_voice`, `not_analyzed` |
| 4 | Attribution / Mindset | Keyword scan of student answers for growth/fixed/avoidance language | `growth_mindset`, `fixed_mindset`, `avoidant`, `neutral` |
| 5 | Cognitive Load | Test score (proxy for intrinsic vs. germane load) | `high_intrinsic` (<40), `moderate_load` (40-89), `low_germane` (≥90) |
| 6 | SRL Phase | Answer-length pattern across the conversation | `forethought`, `performance`, `reflection` |
| 7 | Fluency / Retention | First-answer score vs. last-answer score trend | `improving_recall`, `declining_recall`, `stable_recall`, `fluent`, `fragmented_recall`, `developing_fluency` |

**Theoretical grounding:** Dunning-Kruger (calibration), Sweller's cognitive
load theory, Zimmerman's self-regulated learning model, Dweck's mindset
research, Fredericks' engagement framework.

---

## 6. Stage 4 — Confidence ratings and skill mastery

The pipeline also writes:

- **`ConfidenceRating` rows** for every daily-test answer where the student
  self-rated their confidence (low=1, medium=3, high=5). The gap between
  self-rated confidence and actual score is the **calibration gap** — the
  teacher-facing indicator for overconfident vs. underconfident students.
- **`SkillMastery` upserts** per topic. Mastery level (`not-started` →
  `developing` → `proficient` → `mastered`) is computed from the running
  average of scores on that topic. The trend (`improving`, `stable`,
  `declining`) is computed by comparing the new average to the existing
  level. This is what makes the Educational Tab actionable — teachers see
  "database queries: developing, declining" instead of "week 6: 68%".

---

## 7. Stage 5 — Wellbeing tier recomputation

**File:** `analysis-pipeline.ts` → `recomputeWellbeingState()`

After evidence is written, the wellbeing tier is recomputed using a 14-day
rolling window of all `PsychEvidence` rows for that student.

**Algorithm:**

1. Fetch the last 50 evidence rows from the past 14 days.
2. Count "concerning" values: `overconfident`, `surface_answers`,
   `voice_inconsistency`, `fixed_mindset`, `avoidant`, `high_intrinsic`,
   `declining_recall`, `fragmented_recall`.
3. Count "positive" values: `well-calibrated`, `detailed_reasoning`,
   `growth_mindset`, `low_germane`, `improving_recall`, `fluent`.
4. Compute the ratio of concerning to total.
5. Tier assignment:
   - **Green:** ratio ≤ 0.35 — student is on track
   - **Amber:** 0.35 < ratio ≤ 0.60 — patterns of concern emerging
   - **Red:** ratio > 0.60 — sustained concerning patterns
6. **Override:** any open `CrisisFlag` forces the tier to Red regardless
   of evidence ratio.
7. The tier + human-readable reasons are stored in `WellbeingState`,
   upserted on every recompute.

The tier is the **single most visible psychological signal** in the
platform — it appears on the teacher triage queue, the counselor caseload,
the principal's institution overview, and (in a sanitized form) the
guardian dashboard.

---

## 8. Stage 6 — Auto-touchpoints and student alerts

### 6a. Auto-touchpoint on tier transition

When a student's wellbeing tier transitions to **Red**, the system
automatically creates a `MentorshipTouchpoint` of type `alert_response`
for every teacher in the student's batch. The note reads:

> Auto-created: student wellbeing dropped to RED after [test_type]
> (score X%). Review recommended.

This appears in the teacher's "Today" triage queue with the highest
attention score. The teacher is expected to acknowledge it and either
schedule a mentorship session or document why no action is needed.

### 6b. Student alerts (attention-score algorithm)

Independently of the tier, the `/api/stats` endpoint computes an
attention score per student on every request. The score is additive:

| Signal | Points |
|---|---|
| Inactivity 3+ days | +30 |
| Inactivity 2+ days | +15 |
| Never checked in (with tasks) | +20 |
| Latest test score < 60 | +25 |
| Score drop 15+ points week-over-week | +20 |
| Sustained low confidence (2+ of last 5 logs ≤2) | +20 |
| Blocked tasks | +10 each |
| Sustained high cognitive load (2+ of last 3 psychObs = "high") | +15 |

Students are sorted by attention score descending in the teacher's
triage queue. There is no hard threshold — the teacher sees the
rank-ordered list and decides whom to engage with first.

---

## 9. Stage 7 — Escalation engine

**File:** `src/lib/ai-assistant/escalation.ts`

One engine, three tiers (green / amber / red), two triggers. Applies to
every flag source — student wellbeing, teacher load, crisis, safeguarding.
There is no separate "crisis tier"; a crisis situation is `red` with a
specific label ("Student in crisis — needs immediate attention").

### Trigger 1 — Duration

If a flag is `amber` and unresolved for **7 or more days**, it
auto-escalates to `red`. This runs as a scheduled job
(`POST /api/assistant/escalation/run`) and on every flag-status check.

### Trigger 2 — Repeat occurrence

If the same issue type has been raised for the same person before:

- **3rd+ recurrence:** immediate escalation to `red` (no timer)
- **2nd recurrence:** shortened 2-day timer (vs. 7 days for first-time)

This runs as an on-write check (`checkOnWriteEscalation`) the moment a
new flag is created — so a third-time issue is escalated within
milliseconds of being raised, not on the next scheduled job run.

### What the engine does NOT do

- It does not auto-resolve. Only a human can mark a flag resolved or
  dismissed.
- It does not notify the subject of a safeguarding flag. Safeguarding
  flags are principal-only by design.
- It does not change the wellbeing tier directly. Tier is recomputed
  from evidence; escalation promotes the flag's tier, which then
  appears in the relevant dashboards.

---

## 10. Stage 8 — AI Assistant action dialog

**Files:** `src/lib/ai-assistant/teaching-guidance.ts`, `src/components/shared/action-dialog.tsx`, `src/app/api/assistant/action-dialog/route.ts`

When a teacher (or counselor or principal) opens an alert, the AI
Assistant generates a contextual action dialog. The dialog contains:

1. **Headline** — Plain-language summary, color-coded by tier.
2. **Why** — The specific trigger data (which signal, which date, which
   threshold crossed).
3. **Suggested action** — Editable AI-drafted recommendation (e.g.
   "Schedule a 15-minute check-in focused on database queries, where the
   student is showing declining mastery.").
4. **Required note** — Free-text field, with **3 AI-drafted one-tap
   presets** the teacher can accept with a single click. The confirm
   button is **disabled** until a note is provided — every action must
   be documented.
5. **In-action guidance** (collapsed by default) — Per-flag-type
   principles the teacher should follow. See Section 11 below.
6. **Cancel** — Always available, no penalty.

The dialog calls `callAI()` with a system prompt built from the
flag-type guidance template + the specific trigger data. The AI returns
structured JSON that the dialog renders.

When the teacher confirms, a `MentorshipTouchpoint` is recorded with
the note, the outcome (defaulting to "ongoing"), and a follow-up date
if scheduled.

---

## 11. Stage 9 — In-action teaching guidance (per flag type)

**File:** `src/lib/ai-assistant/teaching-guidance.ts`

The guidance section of the action dialog is **flag-type-specific**.
The guidance templates encode mentorship principles drawn from
established practice:

| Flag type | What it means | Principles |
|---|---|---|
| **psychological** | Behavior patterns suggest emotional distress or disengagement. Not a diagnosis — a signal. | Ask don't tell. Validate before solving. |
| **educational** | Scores or engagement dropped below expected thresholds. May be knowledge gaps, test anxiety, or external factors. | Focus on the process, not the outcome. Use GROW-stage framing. |
| **mentorship** | Student hasn't been in contact recently or engagement streak broke. Often needs a check-in, not a push. | Ask don't tell. Start with Reality (where are they now?) before Goal. |
| **teacher_load** | Teacher carrying more students, batches, or alerts than typical. Systemic signal, not performance. | Frame as support, not criticism. Offer concrete help. |
| **safeguarding** | Multiple signals in teacher-student communication triggered the pre-filter. Requires principal judgment. | Review evidence references. Consider patterns, not individual messages. |
| **crisis** | Situation escalated to highest urgency. Time matters. | Act now, document after. Follow institution's crisis protocol. |

The AI is instructed to **adapt** these templates to the specific flag
instance, not copy them verbatim. The teacher sees guidance that is
both principle-grounded and situation-specific.

---

## 12. Stage 10 — Safeguarding watch (parallel, principal-only)

**File:** `src/lib/ai-assistant/safeguarding.ts`

This is the **one deliberate exception** to the "insight stays with
caller" rule. Safeguarding flags about a teacher are **never** shown
to that teacher — they go to the principal scope only.

### What it monitors

Teacher-to-student communication only: messages, comments on student
work. It looks for:

- **Aggressive language** — name-calling, threats to fail
- **Trauma-inducing language** — "nobody cares", "you deserve this",
  references to self-harm
- **Neglect of a distressed student** — "not my problem", "figure it
  out yourself"
- **Inappropriate tone** — dismissive of student concerns
- **Dismissive of distress** — "you're overreacting", "everyone else
  gets it"

### How it works

1. **Deterministic pre-filter first.** Regex patterns scan every
   teacher-to-student message. The AI never raises a flag on its own
   judgment alone — the regex must match first. This is intentionally
   conservative: false negatives are acceptable, false positives are
   not.
2. **AI explains candidates.** When the regex matches, the AI is
   invoked to produce a contextual explanation of why the matched
   text is concerning. The AI cannot invent a flag the regex didn't
   find.
3. **Two-plus corroborating signals required.** A single message
   never produces a flag. The system requires at least two
   corroborating signals within a rolling window before creating a
   safeguarding flag. This prevents reactive flags from a single
   heated exchange.
4. **Flags go to principal scope only.** `resolveAssistantScope()`
   for safeguarding queries returns principal + admin roles. The
   teacher is not notified.
5. **Dismissed, not deleted.** A principal who reviews and dismisses
   a flag marks it `dismissed` with a note. The flag record persists
   for audit trail — it is never hard-deleted.
6. **Message references, not copies.** The flag stores `messageId`
   references, not copies of the message text. This preserves the
   audit trail without duplicating potentially sensitive content.

---

## 13. The AI Tutor — teaching, not assessing

**File:** `src/app/api/ai/tutor/route.ts`

The AI Tutor is the student's primary teacher. It is fundamentally
different from the test chatbots — it **never grades**. Its job is to
teach today's topic, connect it to the student's capstone project, and
handle disengagement with empathy.

### System prompt structure

The system prompt is dynamically built from three placeholders filled
from the student's data:

1. **COURSE OUTLINE** — the full curriculum (all weeks, all daily
   topics)
2. **STUDENT PROJECT** — the student's capstone project definition
3. **CURRENT TOPIC** — the current week's phase + today's daily topic

### Teaching rules (in order of priority)

0. **No grading.** The AI Tutor never scores, never says "correct" or
   "incorrect". If the student asks for a score, the AI redirects:
   "I am here to help you understand, not to grade you."
1. **Keep it short.** 2–3 sentences for casual chat, 3–5 for
   questions, 5–8 for concept explanations. **Never** more than 8
   sentences. Engage first, explain only when needed.
2. **Respectful, polite, warm teacher tone.** Uses "aap" (not "tu")
   in Roman Urdu. Never slang. Always polite.
3. **Handle disengaged students briefly and warmly.** Acknowledge,
   one small insight, gentle pivot. Stop after two attempts.
4. **Project-centric.** Connect concepts to the student's capstone.
   Pivot unrelated conversations back gently.
5. **Advanced questions** — 1–2 sentence summary + one link, then
   back to current topic.
6. **Teaching method** — real-life comparison → simple example →
   project connection, all under 8 sentences. No headers, no Step 1
   labels.
7. **Suggest links sparingly.** One good link, not three.
8. **Language simplicity.** English question → simple English reply.
   Any other language → Roman English (Latin script) reply. Never
   non-Latin scripts.
9. **No formatting markers.** Plain text. No emojis. No bold/italics.
   No bullet characters. The only exception: markdown links.
10. **No coherence check.** No progress indicators in the chat.

### Engagement tracking (lightweight)

On every tutor message, `trackTutorEngagement()` runs in the
background. It does **one DB upsert** to `StudentHealthSummary` —
not the 15–20 writes the old pipeline did. The full psychological
analysis pipeline only runs on test completions. This keeps the AI
Tutor scalable to thousands of concurrent students without DB
flooding.

---

## 14. The test chatbots — Socratic assessment

**Files:** `src/app/api/ai/practice/route.ts`, `src/app/api/ai/daily-test/route.ts`, `src/app/api/ai/weekly-test/route.ts`

Three test types share a unified grader contract (`unified-grader.ts`)
and a common assessment philosophy:

### Practice test

- **Purpose:** Low-stakes formative practice. No plagiarism analysis.
  No psychological deep-dive.
- **Format:** Single question, AI-generated, four "pillars" rotated:
  Why Probe, Break-It, Client Translation, Edge Case.
- **Behavioral pipeline:** Writes all 7 PsychEvidence rows but with
  `not_analyzed` for gaming pattern (not worth the analysis cost).

### Daily test

- **Purpose:** 3-question check-in on today's topic. Confidence
  self-rating collected per question.
- **Behavioral pipeline:** Full 7-dimension evidence. Calibration is
  derived from the confidence ratings. Plagiarism is estimated from
  answer-length variance (no AI call).

### Weekly test

- **Purpose:** 15-question Socratic exam. The most comprehensive
  psychological snapshot of the week.
- **Behavioral pipeline:** Full 7-dimension evidence. Plagiarism is
  computed by the AI (voice-inconsistency analysis, vocabulary jumps,
  AI-typical phrasing). Engagement feedback includes avoidance count,
  subject changes, and distracted-question indices.
- **Conversation is saved** (not deleted) so students can review
  Q&A afterward.
- **Auto-advances the student's `currentWeek`** on completion.

### The Socratic method, as implemented

The system prompt for all three test types enforces Socratic
questioning:

- The AI never gives the answer directly. It probes with follow-up
  questions.
- The AI uses "Why?" and "How would you explain this to a peer?" as
  primary tactics.
- After the student answers, the AI reveals the correct answer, why
  it's correct, and specific encouragement — **immediately**, not at
  end-of-test. This is the "learn from every question" principle.
- The AI's final analysis (psychAnalysis + examinerComment + score +
  plagiarismScore) is generated after the conversation completes, not
  during it.

### Why Socratic?

The Socratic method forces students to articulate their reasoning,
which is what makes the 7-dimension analysis possible. Without
articulated reasoning, you cannot measure calibration, explanatory
depth, attribution, or SRL phase. Multiple-choice tests would give
you a score but no psychological signal. The Socratic chatbot is the
foundation of the entire psychological cycle.

---

## 15. How the cycle protects students

The cycle is designed with multiple layers of protection:

1. **No clinical diagnosis.** The AI is explicitly prohibited from
   diagnosing. Every observation is behavioral evidence, not a label.
2. **Trajectory required.** A single bad day does not produce a red
   tier. The 14-day window ensures sustained patterns drive
   escalation.
3. **Human in the loop.** Every alert requires a teacher to
   acknowledge and act. The AI drafts, the human decides.
4. **Mandatory documentation.** Action dialogs cannot be confirmed
   without a note. Every intervention is auditable.
5. **Safeguarding isolation.** Safeguarding flags about teachers go
   to principals only — never to the teacher, never into the
   teacher's performance review without principal judgment.
6. **Dismissed, not deleted.** Every flag persists for audit.
   Patterns can be reviewed historically even after individual flags
   are dismissed.
7. **Scope-respecting AI.** The AI Assistant never sees data outside
   the caller's scope. A teacher cannot ask "what's the wellbeing of
   students in another batch?" — the AI's context is pre-filtered.
8. **Student dignity.** Students see their own progress, scores, and
   AI Tutor chat. They do not see their psychological evidence,
   wellbeing tier reasons, or teacher notes about them. The
   psychological cycle is for mentors, not for the student to obsess
   over.

---

## 16. Theoretical grounding summary

| Theory | Where it shows up |
|---|---|
| Dunning-Kruger effect | Calibration dimension, calibration gap |
| Sweller's cognitive load theory | Cognitive Load dimension (intrinsic vs. germane) |
| Zimmerman's self-regulated learning | SRL Phase dimension (forethought → performance → reflection) |
| Dweck's mindset research | Attribution / Mindset dimension, growth-signal keyword detection |
| Fredericks' engagement framework | Mood + engagement + cognitive engagement in psych-analyzer |
| Self-Determination Theory | Autonomy / competence / relatedness signals in tutor chat |
| Cognitive Behavioral patterns | Avoidance, catastrophizing, all-or-nothing detection |
| Socratic method | All three test chatbots; AI Tutor teaching approach |
| GROW coaching model | Mentorship touchpoints, action dialog principles |
| Trauma-informed practice | Safeguarding mode, validate-before-solving principle |

**Important:** The system uses these frameworks as **design
inspiration**, not as clinical instruments. Every score, every tier,
every alert is a heuristic for human mentorship, not a diagnosis.

---

## 17. What this cycle is NOT

- **Not a substitute for professional counseling.** Students in
  crisis need human professionals. The system surfaces signals; it
  does not provide therapy.
- **Not a surveillance tool.** The psychological evidence is visible
  only to roles whose scope includes that student. Safeguarding
  flags are principal-only. Students do not see their own
  psychological evidence — that's for mentors, not for the student
  to ruminate on.
- **Not a disciplinary system.** The cycle is designed to trigger
  mentorship, not punishment. Even safeguarding flags are framed as
  "requires principal judgment", not "teacher misconduct".
- **Not an automated intervention system.** The AI never modifies a
  student's account, never sends messages on the teacher's behalf,
  never auto-resolves alerts. Every action is human-initiated.
- **Not a replacement for teacher intuition.** The cycle surfaces
  signal; the teacher provides judgment. A teacher who knows a
  student's family situation will always interpret the evidence
  better than the AI.

---

## 18. Where to read more

- `docs/SEVEN-DIMENSIONS.md` — Detailed per-dimension reference, including
  what each value means and how teachers should interpret it.
- `docs/MENTORSHIP-CYCLE.md` — The mentorship and mental-health response
  pathways: GROW coaching, crisis response, teacher load management,
  safeguarding escalation.
- `docs/SYSTEM-DOCUMENTATION.md` — The full system architecture, role
  permissions, and feature inventory.
- `docs/POSITIONING.md` — Why this product exists and who it serves.
- `docs/ai-integration.md` — AI provider configuration, token budgets,
  and the multi-provider failover chain.
