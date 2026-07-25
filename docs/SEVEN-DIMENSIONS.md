# Seven Dimensions — Psychological Evidence System

This document explains what each dimension measures, how it's calculated in this app, and how to understand the data. This content is also shown in the UI under each dimension.

---

## Overview

Every test (practice, daily, weekly) feeds the same analysis pipeline. After each test completes, the system writes **PsychEvidence** rows — one per dimension, per test. The teacher's "Seven Dimensions" panel shows these with trajectory badges and evidence text.

The key change: **all 7 dimensions are now written on EVERY test**, not just when strict conditions are met. Previously, most dimensions had no evidence because the conditions were too narrow (e.g., only writing "explanatory depth" if average answer length was <50 or >300 characters — nothing in between).

---

## The 7 Dimensions

### 1. Calibration
**What it measures:** Does the student know what they know? This is the Dunning-Kruger dimension — the gap between self-rated confidence and actual performance.

**How it's calculated:**
- **Daily tests:** The student picks a confidence level (low/medium/high) before each answer. The system converts this to a percentage (low=20%, medium=60%, high=100%) and compares it to the actual score.
- **Weekly/Practice tests:** No self-rating is collected, so the system records "no_self_rating" with the test score for context.
- **Gap > 20 points:** "overconfident" (thinks they know more than they do)
- **Gap < -20 points:** "underconfident" (knows more than they think)
- **Otherwise:** "well-calibrated"

**Values you'll see:** `overconfident` | `underconfident` | `well-calibrated` | `no_self_rating`

**How to understand it:**
- Overconfident students need reality checks — show them their wrong answers and ask them to explain why.
- Underconfident students need encouragement — show them what they got right and build momentum.
- "No self-rating" means this test type doesn't collect confidence data (weekly/practice). Daily tests do.

---

### 2. Explanatory Depth
**What it measures:** How deeply does the student explain their reasoning? Surface answers ("yes", "because it's important") vs. detailed reasoning ("The database stores user data because...").

**How it's calculated:**
- Measures the average character length of the student's answers in the conversation.
- **< 50 chars:** "surface_answers" — short, surface-level. Probing likely revealed gaps.
- **50-300 chars:** "moderate_depth" — adequate explanations with some detail. Room for deeper reasoning.
- **> 300 chars:** "detailed_reasoning" — step-by-step explanations with reasoning.

**Values you'll see:** `surface_answers` | `moderate_depth` | `detailed_reasoning`

**How to understand it:**
- Surface answers don't necessarily mean the student doesn't understand — they may be rushing or anxious. Probe with "Can you explain why?"
- Detailed answers are a strong positive signal — the student is connecting concepts, not just reciting facts.
- Moderate depth is the most common — the student can explain but doesn't go deep without prompting.

---

### 3. Gaming Pattern
**What it measures:** Is the student using AI to generate answers? This detects voice inconsistency — when some answers sound very different from others (a sign of copy-pasting from ChatGPT).

**How it's calculated:**
- **Weekly tests:** The AI's final analysis includes a plagiarism score (0-100) based on voice consistency analysis, vocabulary jumps, and AI-typical phrasing.
- **Daily tests:** A simpler estimate from answer length variance and vocabulary consistency.
- **Practice tests:** No plagiarism analysis is run (score = "not_analyzed").
- **Score > 50:** "voice_inconsistency" — significant voice inconsistency detected.
- **Score ≤ 50:** "authentic_voice" — consistent voice, no signs of AI use.

**Values you'll see:** `voice_inconsistency` | `authentic_voice` | `not_analyzed`

**How to understand it:**
- A high plagiarism score doesn't automatically mean the student cheated — it means some answers deviate from their baseline. Could be AI use, could be they studied harder on that topic.
- Look at WHICH questions were flagged (in the teacher's full analysis view) to judge for yourself.
- "Not analyzed" means this test type doesn't run plagiarism detection. Practice tests are low-stakes — not worth the analysis cost.

---

### 4. Attribution / Mindset
**What it measures:** Does the student have a growth mindset (believes effort leads to improvement) or a fixed mindset (believes ability is innate)?

**How it's calculated:**
- Scans the student's answer text for growth-mindset language: "learn", "practice", "try", "improve", "figure out", "understand", "next time", "work on", "get better".
- Scans for fixed-mindset language: "can't", "not good at", "never", "always fail", "stupid", "don't know how".
- Also checks for avoidance patterns (saying "I don't know" or "skip" multiple times).
- **More growth signals:** "growth_mindset"
- **More fixed signals:** "fixed_mindset"
- **Multiple avoidances:** "avoidant"
- **Neither:** "neutral"

**Values you'll see:** `growth_mindset` | `fixed_mindset` | `avoidant` | `neutral`

**How to understand it:**
- Growth mindset students respond well to challenges and feedback — push them with harder material.
- Fixed mindset students may give up easily — frame challenges as "practice" not "tests", and praise effort over results.
- Avoidant students may have anxiety or knowledge gaps — create a safe space to attempt answers without penalty.
- "Neutral" is the most common — most students don't explicitly signal mindset in their answers.

---

### 5. Cognitive Load
**What it measures:** How hard is the material for this student right now? High intrinsic load means the material is too difficult; low germane load means it's too easy.

**How it's calculated:**
- Based on the test score (the most reliable signal available without biometric data).
- **Score < 40:** "high_intrinsic" — the material itself is too difficult. The student is overwhelmed.
- **Score 40-89:** "moderate_load" — the student is engaging with the material but hasn't fully mastered it.
- **Score ≥ 90:** "low_germane" — material mastered, low cognitive load. Ready for advanced work.

**Values you'll see:** `high_intrinsic` | `moderate_load` | `low_germane`

**How to understand it:**
- High intrinsic load is NOT a sign the student is unintelligent — it means the material is at the edge of their current ability. This is where learning happens, but sustained high load leads to burnout.
- Moderate load is the sweet spot — the student is challenged but coping.
- Low germane load means the student has mastered this topic — move them forward or give them harder problems.

---

### 6. SRL Phase (Self-Regulated Learning)
**What it measures:** Where is the student in the self-regulated learning cycle? Forethought (planning) → Performance (doing) → Reflection (reviewing).

**How it's calculated:**
- Analyzes answer patterns across the conversation:
  - **Average length > 200 chars:** "reflection" — the student elaborates, connects concepts, and processes deeply.
  - **First answer long, last answer short:** "performance" — started engaged but fatigued or lost interest.
  - **Average length < 50 chars:** "forethought" — still building familiarity, hasn't engaged deeply yet.
  - **Otherwise:** "performance" — actively working through the material at a steady pace.

**Values you'll see:** `forethought` | `performance` | `reflection`

**How to understand it:**
- Forethought students need structure — give them clear objectives and examples before asking them to produce.
- Performance students are doing the work — keep them engaged with varied question types.
- Reflection students are the deepest learners — they connect new material to what they already know. Encourage them to help peers.

---

### 7. Fluency / Retention
**What it measures:** Can the student recall and apply knowledge consistently? Improving recall during a test is a sign of good retrieval practice; declining recall suggests fatigue or weak consolidation.

**How it's calculated:**
- **Multiple answers (daily/weekly):** Compares the first answer's score to the last answer's score.
  - **Trend > +15:** "improving_recall" — recall is strengthening during the test.
  - **Trend < -15:** "declining_recall" — possible fatigue or fading recall.
  - **Otherwise:** "stable_recall" — consistent performance.
- **Single score (practice):** Infers from overall score.
  - **≥ 75:** "fluent" — knowledge is accessible and well-practiced.
  - **< 50:** "fragmented_recall" — knowledge gaps are affecting fluency.
  - **Otherwise:** "developing_fluency" — some recall but not yet automatic.

**Values you'll see:** `improving_recall` | `declining_recall` | `stable_recall` | `fluent` | `fragmented_recall` | `developing_fluency`

**How to understand it:**
- Improving recall is a great sign — the test itself is helping the student learn (retrieval practice effect).
- Declining recall may indicate the test is too long, or the student needs more spaced repetition.
- Fragmented recall means the student has gaps — they know some things but can't connect them fluently yet.

---

## How Data Flows

```
Student takes test (practice/daily/weekly)
         ↓
   Test completes → score + conversation saved
         ↓
   runAnalysisPipeline() fires (best-effort, non-blocking)
         ↓
   writePsychEvidence() creates 7 PsychEvidence rows:
     1. Calibration       — from confidence ratings (daily) or "no_self_rating"
     2. Explanatory depth — from average answer length in conversation
     3. Gaming pattern    — from plagiarism score (weekly/daily) or "not_analyzed"
     4. Attribution       — from language analysis of student answers
     5. Cognitive load    — from test score
     6. SRL phase         — from answer length patterns across conversation
     7. Fluency           — from score trend across answers or single score
         ↓
   writeSkillMastery() — updates per-topic mastery level + trend
         ↓
   recomputeWellbeingState() — Green/Amber/Red tier from recent evidence
         ↓
   Teacher sees data in:
     - Seven Dimensions panel (Psychological tab)
     - Student portfolio (per-student detail)
     - AI Assistant (cohort-level analysis)
     - My Load (teacher wellbeing — derived from student wellbeing)
```

## Data Sources Per Test Type

| Dimension | Practice | Daily | Weekly |
|-----------|----------|-------|--------|
| Calibration | no_self_rating | from confidence buttons | no_self_rating |
| Explanatory depth | from conversation | from conversation | from conversation |
| Gaming pattern | not_analyzed | from plagiarism estimate | from AI plagiarism analysis |
| Attribution | from answer text | from answer text + avoidance | from answer text + engagement feedback |
| Cognitive load | from score | from score | from score |
| SRL phase | from answer patterns | from answer patterns | from answer patterns |
| Fluency | from single score | from score trend across answers | from score trend across answers |

All three test types now pass the same data shape (conversation + answers + score) to the pipeline, so all dimensions are computed uniformly.
