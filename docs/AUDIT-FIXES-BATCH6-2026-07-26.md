# Audit Fixes Batch 6 — M1, L1, L7, L8 (MEDIUM + LOW items)

> **Date:** 2026-07-26
> **Status:** Implemented + deployed
> **Audit items fixed:** M1 (batch switcher), L1 (TODOs), L7 (admin role switcher), L8 (counselor refresh)

## Overview

This batch starts on the MEDIUM + LOW audit items. All CRITICAL + HIGH items were resolved in batches 1-5. This batch tackles 4 items: 1 MEDIUM + 3 LOW.

## Audit Fixes

### M1 — Add batch switcher for multi-batch teachers

**Problem:** Teachers assigned to multiple batches (via the BatchTeacher junction) saw all their students mixed together with no way to focus on one batch at a time.

**Fix:**
- `GET /api/stats?as=teacher` now accepts an optional `?batchId=X` query param. When provided, it narrows the student filter to just that batch (after verifying access via `canAccessBatch`).
- The response now includes a `teacherBatches` array (only populated when the teacher has 2+ batches and no specific batchId is selected) — each entry has `{ id, name, studentCount }`.
- `TeacherDashboard` now has batch switcher state (`selectedBatchId`, `teacherBatches`). When the teacher has 2+ batches, a dropdown appears in the header next to the Refresh button:
  - "All Batches (N students)" — default, shows all students across all batches
  - One option per batch: "Batch Name (N)" — filters to just that batch
- Selecting a batch triggers a reload with the `batchId` param, so students + stats + alerts all narrow to that batch.

### L1 — Resolve real TODOs in code

**Problem:** 5 TODOs were flagged in the audit. Most were already resolved in previous batches. The remaining one was in `/api/growth-reports/[userId]` — `courseId` was hardcoded to `null`.

**Fix:**
- `/api/growth-reports/[userId]` now fetches the student's batch → batch's courseId, and sets `courseId` on the GrowthReport row. This properly links the growth report to the student's course.

### L7 — Admin role switcher missing "Admin" option

**Problem:** The "View As Role" switcher in the sidebar (for admins/devs to preview different role dashboards) had 6 options: Student, Teacher, Coordinator, Counselor, Guardian, Principal. The "Admin" option was missing — admins couldn't preview their own admin dashboard via the switcher.

**Fix:** Added `{ role: "admin", label: "Admin", view: "admin-dashboard" }` to the role switcher array in `AppShell.tsx`. Now there are 7 options.

### L8 — Counselor Sessions tab no refresh after logging

**Problem:** The `VoiceTouchpointLogger` component in the counselor's Sessions tab had `onLogged={() => {}}` (a no-op). After logging a new touchpoint, the touchpoint list didn't refresh — the counselor had to manually reload the page to see their new entry.

**Fix:**
- `SessionsView` now accepts an `onReload?: () => void` prop.
- The main `CounselorDashboard` passes its `load` function as `onReload`.
- `VoiceTouchpointLogger onLogged` now calls `onReload?.()` — the touchpoint list refreshes immediately after a new touchpoint is logged.

## File Changes

### Modified Files
- `src/app/api/stats/route.ts` — M1 fix: batchId param + teacherBatches in response
- `src/app/api/growth-reports/[userId]/route.ts` — L1 fix: courseId from batch
- `src/components/examiner/TeacherDashboard.tsx` — M1 fix: batch switcher UI
- `src/components/examiner/AppShell.tsx` — L7 fix: Admin option in role switcher
- `src/components/examiner/CounselorDashboard.tsx` — L8 fix: onReload passed to SessionsView

### No New Files

## Build Verification

- `npx tsc --noEmit` — OK (no new errors)
- `npx next build` — ✓ Compiled successfully in 27.8s, all 100 static pages generated
- `npx vitest run` — 142 passed, 5 skipped, 1 pre-existing DB-dependent failure

## Audit Status

| Priority | Total | Fixed | Pending |
|----------|-------|-------|---------|
| CRITICAL | 10 | 10 ✅ | 0 |
| HIGH | 16 | 16 ✅ | 0 |
| MEDIUM | 15 | 1 ✅ (M1) | 14 |
| LOW | 10 | 3 ✅ (L1, L7, L8) | 7 |
| **TOTAL** | **51** | **30** | **21** |
