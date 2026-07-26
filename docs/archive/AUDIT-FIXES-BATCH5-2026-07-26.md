# Audit Fixes Batch 5 — H2, H4, H9 (all HIGH items now resolved)

> **Date:** 2026-07-26
> **Status:** Implemented + deployed
> **Audit items fixed:** H2 (IDOR gaps), H4 (AI Assistant spec wiring), H9 (Action Dialog)

## Overview

This batch resolves the final 3 HIGH-priority audit items. All 16 HIGH items are now FIXED. The most significant is H9 — the Action Dialog component (Section 4 of the AI Assistant spec) was fully built but never imported anywhere. It's now wired into the teacher's Today view, so clicking "Act" on any triage item opens an AI-drafted dialog with suggested action + note presets.

## Audit Fixes

### H2 — IDOR gaps on routes accepting derived entity IDs

**Problem:** Several routes accepted derived entity IDs (dailyLogId, interactionId, submissionId, taskId, eventId) without verifying the caller has access to the underlying student/batch. A teacher could edit/delete records for students in batches they don't teach.

**Fix:** Added ownership verification to all affected routes:

| Route | Methods | Fix |
|-------|---------|-----|
| `/api/daily-logs/[id]` | PATCH, DELETE | Verify the log's userId via `assertCanAccessStudent` before modifying/deleting |
| `/api/interactions/[id]` | PATCH, DELETE | Verify the interaction's userId via `assertCanAccessStudent` |
| `/api/group-tasks/submit` | PATCH (grade) | Verify the submission's userId via `assertCanAccessStudent` before grading |
| `/api/group-tasks` | PATCH, DELETE | Verify the teacher owns the task OR can access its batch via `canAccessBatch` |
| `/api/events` | DELETE | Verify the event's creator OR batch access via `canAccessBatch` |

All checks use the existing `assertCanAccessStudent` or `canAccessBatch` helpers, so they respect the same batch-scoping rules as the rest of the platform. Admins/principals bypass the checks (institution-wide access).

### H4 — AI Assistant 7-section spec: 5 of 7 sections were dead code

**Problem:** The AI Assistant spec has 7 sections (scope resolver, data efficiency, safeguarding, action dialog, escalation, teacher load, teaching guidance). 5 of these were implemented as lib modules but never imported by any UI or route — they were dead code.

**Fix:** This batch + previous batches have now wired ALL 7 sections:

| Section | Module | Status |
|---------|--------|--------|
| 1. Scope Resolver | `src/lib/ai-assistant/scope.ts` | ✅ Wired (C1 fix — used by action-dialog, teacher assistant, counselor overview) |
| 2. Data Efficiency | `src/lib/ai-assistant/data-efficiency.ts` | ✅ Wired (C1 fix — used by scope resolver) |
| 3. Safeguarding | `src/lib/ai-assistant/safeguarding.ts` | ✅ Wired (P0-3 fix — runs on every message + comment) |
| 4. Action Dialog | `src/components/shared/action-dialog.tsx` | ✅ Wired (H9 fix — this batch) |
| 5. Escalation | `src/lib/ai-assistant/escalation.ts` | ✅ Wired (P1-7 fix — vercel.json cron + C7 fix for auth) |
| 6. Teacher Load | `src/lib/ai-assistant/teacher-load.ts` | ✅ Wired (H10 fix — TeacherLoadPanel in TodayView) |
| 7. Teaching Guidance | `src/lib/ai-assistant/teaching-guidance.ts` | ✅ Wired (used by action-dialog for in-action guidance) |

### H9 — Action Dialog component never imported

**Problem:** The `ActionDialog` component (`src/components/shared/action-dialog.tsx`, 245 lines) was fully built — headline, why, suggested action, note presets, guidance — but never imported by any UI. The 4th AI Assistant section was completely unreachable.

**Fix:**
- Wired `ActionDialog` into `TodayView` (teacher's first tab).
- Each triage item (crisis + alert rows) now has an "Act" button (violet, with Sparkles icon).
- Clicking "Act" calls `POST /api/assistant/action-dialog` with the student ID + trigger, which returns AI-drafted `{ headline, tier, why, suggestedAction, notePresets, guidance }`.
- The ActionDialog opens with that content. The teacher can:
  - Edit the suggested action (it's a draft, not a final message)
  - Select a note preset OR write a free-text note (required to confirm)
  - Expand the teaching guidance (collapsed by default)
  - Cancel (no penalty, no note required)
- On confirm: the edited action is sent as a message to the student, and the alert is acknowledged with the note as the resolution note.
- Fallback: if the AI call fails, a basic dialog is shown with sensible defaults.

## File Changes

### Modified Files
- `src/app/api/daily-logs/[id]/route.ts` — H2 fix: ownership verification
- `src/app/api/interactions/[id]/route.ts` — H2 fix: ownership verification
- `src/app/api/group-tasks/submit/route.ts` — H2 fix: ownership verification
- `src/app/api/group-tasks/route.ts` — H2 fix: ownership verification (PATCH + DELETE)
- `src/app/api/events/route.ts` — H2 fix: ownership verification (DELETE)
- `src/components/examiner/teacher/TodayView.tsx` — H9 fix: ActionDialog wiring

### No New Files
All components + endpoints already existed — this batch wires them together.

## Build Verification

- `npx tsc --noEmit` — OK (no new errors)
- `npx next build` — ✓ Compiled successfully in 29.2s, all 100 static pages generated
- `npx vitest run` — 142 passed, 5 skipped, 1 pre-existing DB-dependent failure

## Audit Status

| Priority | Total | Fixed | Pending |
|----------|-------|-------|---------|
| CRITICAL | 10 | 10 ✅ | 0 |
| HIGH | 16 | 16 ✅ | 0 |
| MEDIUM | 15 | 0 | 15 |
| LOW | 10 | 0 | 10 |
| **TOTAL** | **51** | **26** | **25** |

**ALL CRITICAL + HIGH items are now FIXED.** Only 15 MEDIUM + 10 LOW items remain.
