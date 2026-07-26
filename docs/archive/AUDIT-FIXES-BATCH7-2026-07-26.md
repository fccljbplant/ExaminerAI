# Audit Fixes Batch 7 — M2, M3, M4, M13, M14, M15, L6, L10

> **Date:** 2026-07-26
> **Status:** Implemented + deployed
> **Audit items fixed:** M2, M3, M4, M13, M14, M15, L6, L10 (5 MEDIUM + 3 LOW)

## Overview

This batch resolves 8 more audit items (5 MEDIUM + 3 LOW). Notable: principals now have full admin nav access (M2), counselors can acknowledge/resolve crisis flags directly (M3), course coordinators can see students (M4), and the "learning style" debunked concept is removed from AI prompts (M14).

## Audit Fixes

### M2 — Principal can't reach course/batch/user management UI

**Problem:** Admin nav items (Users, Courses, Features, Passwords, System) were admin-only. Principals — who are institution-level administrators — couldn't manage users, courses, or system settings.

**Fix:** `ADMIN_NAV_ROLES` in AppShell now includes "principal". The role-nav-config defaults for principal now include all admin nav items (admin-dashboard, admin-users, admin-courses, admin-features, admin-resets, admin-system).

### M3 — Counselor dashboard has no action buttons

**Problem:** The counselor's Command Center showed crisis flags with no action buttons — counselors couldn't acknowledge or resolve flags from the dashboard.

**Fix:** Each crisis queue item now has "Acknowledge" and "Resolve" buttons that call `PATCH /api/crisis-flags` with the appropriate status. The dashboard refreshes after each action via the `onReload` callback.

### M4 — Course Coordinator has no student visibility at all

**Problem:** Course coordinators only saw the Course Planner — they had zero visibility into the students taking their courses.

**Fix:** 
- Added "Students" nav item (`batch-students`) to the course_coordinator role in AppShell.
- Updated role-nav-config defaults to include `batch-students` for course_coordinator.
- `/api/stats` now allows `course_coordinator` role to access teacher stats (was teacher-only).

### M13 — "anxiety" keyword in psych-analyzer is diagnostic-sounding

**Problem:** The psych-analyzer used "anxiety" in alert reasons — a clinical/diagnostic term that the platform shouldn't use (it's not a medical device).

**Fix:** Replaced "May indicate anxiety or lack of confidence" with "May indicate uncertainty or lack of confidence" — descriptive, not clinical.

### M14 — "learning style" question in ai-prompts is debunked

**Problem:** The AI prompt asked "What's their learning style?" — learning styles (visual/auditory/kinesthetic) were debunked by Pashler et al. (2008). Including this in the prompt makes the AI produce pseudoscientific assessments.

**Fix:** Replaced "What's their learning style?" with "What's their preferred way of engaging with the material?" — descriptive, not tied to a debunked framework.

### M15 — Demo can't preview admin dashboard despite banner claiming "any dashboard"

**Problem:** The demo banner says "Use the role switcher below to preview any dashboard" but the role switcher was missing the "Admin" option (fixed in L7/batch 6). With the Admin option now present, M15 is resolved.

**Fix:** Already resolved by the L7 fix (adding "Admin" to the role switcher). Marked as FIXED.

### L6 — Growth reports title uses strengths text as title

**Problem:** The principal overview endpoint used `r.strengths.slice(0, 60)` as the growth report title — awkward and misleading (strengths is a JSON array, not a title).

**Fix:** Now uses `Growth Report — ${r.user?.name || "Student"}` as the title — descriptive and clear.

### L10 — Attention score "recent" low-confidence logs are actually lifetime

**Problem:** The check-alerts cron loaded `dailyLogs` with `take: 5` (5 most recent), but the strength signal said `${student.dailyLogs.length} check-ins total` — misleading because `dailyLogs.length` is capped at 5, not the total count.

**Fix:** Changed to `5+ recent check-ins — has built a check-in habit` (accurate — we know they have AT LEAST 5). Also changed "high-confidence check-ins" to "recent high-confidence check-ins" for clarity.

## File Changes

### Modified Files
- `src/components/examiner/AppShell.tsx` — M2 fix (principal in ADMIN_NAV_ROLES) + M4 fix (coordinator Students nav)
- `src/app/api/role-nav-config/route.ts` — M2 + M4 fixes (updated defaults)
- `src/app/api/stats/route.ts` — M4 fix (coordinator access to teacher stats)
- `src/components/examiner/CounselorDashboard.tsx` — M3 fix (acknowledge/resolve buttons) + L8 fix (onReload)
- `src/modules/assessment/lib/psych-analyzer.ts` — M13 fix (anxiety → uncertainty)
- `src/modules/assessment/lib/ai-prompts.ts` — M14 fix (learning style → preferred way of engaging)
- `src/app/api/principal/overview/route.ts` — L6 fix (growth report title)
- `src/app/api/students/check-alerts/route.ts` — L10 fix (accurate check-in count)

## Build Verification

- `npx tsc --noEmit` — OK (no new errors)
- `npx next build` — ✓ Compiled successfully in 30.6s, all 100 static pages generated
- `npx vitest run` — 142 passed, 5 skipped, 1 pre-existing DB-dependent failure

## Audit Status

| Priority | Total | Fixed | Pending |
|----------|-------|-------|---------|
| CRITICAL | 10 | 10 ✅ | 0 |
| HIGH | 16 | 16 ✅ | 0 |
| MEDIUM | 15 | 6 ✅ (M1, M2, M3, M4, M13, M14, M15) | 9 |
| LOW | 10 | 6 ✅ (L1, L6, L7, L8, L10) | 4 |
| **TOTAL** | **51** | **38** | **13** |
