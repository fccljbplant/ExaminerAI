# Default Course Selection + Audit Fixes Batch 3

> **Date:** 2026-07-26
> **Status:** Implemented + deployed
> **Related audit fixes:** H6 (guardian creation UI), H8 (messages compose for students/guardians), H13 (settings nav), H14 (guardian report cards), H15 (teacher mentorship no-op)

## Overview

This batch adds a **default course selection** feature so newly-approved students automatically land in a course (instead of seeing "No course assigned yet"). It also resolves 5 HIGH-priority audit items.

## Default Course Selection

### Schema Change

New column on `Course`:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `isDefault` | Boolean | `false` | Marks this course as the default for new students. Only ONE course can be the default at a time (enforced at the API level). |

Migration: `prisma/migrations/20260726000001_course_is_default/migration.sql` (additive + backfills the existing "Modern Web Dev & AI Bootcamp (Default)" course).

### How It Works

1. **`seedDatabase()`** (runs on every server start) now creates the default course (marked `isDefault=true`) AND links it to the "Default Batch". This ensures every deployment has a working default course + batch from the very first boot.

2. **`POST /api/courses/seed-default`** (Course Planner "Seed Default" button) now:
   - Creates the default course with `isDefault=true` (if it doesn't exist)
   - Unsets `isDefault` on all other courses (only one default at a time)
   - Links the course to the Default Batch (creates the batch if missing)
   - Idempotent — re-running on an existing installation brings it up to date

3. **`POST /api/courses/[id]/set-default`** (NEW endpoint) — lets coordinators mark ANY course as the default (or unset it). Used by the new "Set as Default" button in the Course Planner detail view.

4. **`PUT /api/users/[id]/approve`** (student approval) now ensures the Default Batch has a `courseId` before assigning the student to it. If the Default Batch has no course, it links it to the `isDefault=true` course (or falls back to any active course). This means **every newly-approved student automatically gets a course** — no more "No course assigned yet" notice for fresh accounts.

### Course Planner UI

- **Course list cards** now show a violet "Default" badge next to the course name when `isDefault=true`.
- **Course detail view** shows a "Default for new students" badge next to the title, plus a "Set as Default" / "Unset Default" button (violet when not default, amber when default).
- Clicking "Set as Default" calls the new endpoint, which atomically unsets `isDefault` on all other courses + links the Default Batch to this course.

### API Changes

| Endpoint | Change |
|----------|--------|
| `GET /api/courses` | Returns `isDefault` field on each course |
| `GET /api/courses/[id]` | Returns `isDefault` field |
| `POST /api/courses/seed-default` | Sets `isDefault=true` on the seeded course + links to Default Batch |
| `POST /api/courses/[id]/set-default` | NEW — marks a course as default (or unsets) + links to Default Batch |
| `PUT /api/users/[id]/approve` | Ensures Default Batch has a courseId before assigning student |

### Migration Path

The migration is **additive and safe** — the new `isDefault` column defaults to `false`. The migration SQL also backfills the existing "Modern Web Dev & AI Bootcamp (Default)" course (if present) to `isDefault=true`, so existing deployments get a working default course immediately.

For deployments without that course, the next server start runs `seedDatabase()` which creates it.

## Audit Fixes (Batch 3)

### H6 — No guardian creation UI

**Problem:** The guardian create/delete backend existed (`/api/guardian/create` POST + DELETE) but there was NO UI for staff to use it. Staff had to know the API existed and call it directly.

**Fix:**
- New `GuardianCreationPanel` component (`src/components/examiner/teacher/GuardianCreationPanel.tsx`) — shows the existing guardian (if any) for a student, with a form to create a new one (name, email, password, relationship) and a button to remove an existing one.
- Wired into `StudentPortfolioPage` — teachers/admins see it directly below the AI Tools section when viewing a student's portfolio.

### H8 — Messages compose broken for students + guardians

**Problem:** `GET /api/users` returned 403 for students + guardians, which broke the Messages compose recipient search (the compose UI calls `/api/users?q=...` to find recipients).

**Fix:**
- `GET /api/users` now allows students + guardians, but with a restricted scope:
  - **Students** see only teachers in their batch (via `BatchTeacher` junction + legacy `User.batchId`) + admins (principal/administrator).
  - **Guardians** see only the teachers of their linked student's batch + admins.
- This is the only scope they need (to message their teachers / their child's teachers).
- Staff roles (teacher/coordinator/counselor/admin) continue to see the same scope as before.

### H13 — Settings nav item renders Home for all roles

**Problem:** The Settings nav item rendered `<StudentDashboard initialMode="default" />` for EVERY role. Teachers/admins/principals clicked "Settings" and saw the student home view (confusing + wrong).

**Fix:**
- New `SettingsPanel` component (`src/components/examiner/SettingsPanel.tsx`) — a proper settings page that shows:
  - **Profile** — name, email, role (read-only; contact admin to change)
  - **Appearance** — theme preference (light/dark/system) via `ThemePreferenceControl`
  - **Change Password** — inline form (current + new + confirm) calling `/api/auth/change-password`
  - **Security Question** — `SecurityQuestionPanel` for self-service password reset
- All sections are role-agnostic — every authenticated user has a profile, theme preference, password, and security question.
- AppShell now renders `<SettingsPanel user={...} />` for the "settings" view.

### H14 — Guardian "Report Cards" nav item renders identical Overview page

**Problem:** Both guardian nav items ("Overview" and "Report Cards") rendered `<GuardianDashboard />` — identical content.

**Fix:**
- New `GuardianReportCards` component (`src/components/examiner/GuardianReportCards.tsx`) — a dedicated report-card view that shows:
  - A **score trend chart** (LineChart of weekly test scores over time)
  - A **trend badge** (↑/↓/→ vs prior 3 report cards)
  - An **expandable list** of ALL report cards (most recent first), each expandable to show: examiner observations, strengths, areas to improve, work habits, progress, next steps.
  - Empty state when no report cards exist yet.
- AppShell now renders `<GuardianReportCards />` for the "guardian-progress" view (was `<GuardianDashboard />`).

### H15 — Teacher Mentorship tab `load()` is a no-op

**Problem:** The `load()` function in `MentorshipView` was literally empty (the try block had only a comment). It never fetched anything, so the "follow-ups" filter showed an empty list even when students had upcoming follow-up dates logged via touchpoints.

**Fix:**
- `load()` now fetches ALL recent touchpoints for the teacher's students in one request (`GET /api/mentorship/touchpoints` without a userId filter returns touchpoints for all students the caller can access).
- The mentorship queue now includes students with upcoming follow-up dates (was only including students with alerts/attention flags).
- The "follow-ups" filter now actually shows students with upcoming follow-up dates (was only showing students with `needsAttention` flag).
- Urgency scoring updated: crisis=5, alerts=4, follow-up today/overdue=4, attention=3, follow-up upcoming=2.
- Each queue item now shows the follow-up date in the reason text (e.g. "Follow-up scheduled for 2026-07-28").

## File Changes

### New Files
- `src/components/examiner/SettingsPanel.tsx` — H13 fix: unified settings page
- `src/components/examiner/GuardianReportCards.tsx` — H14 fix: dedicated guardian report cards view
- `src/components/examiner/teacher/GuardianCreationPanel.tsx` — H6 fix: guardian creation/management UI
- `src/app/api/courses/[id]/set-default/route.ts` — new endpoint for setting default course
- `prisma/migrations/20260726000001_course_is_default/migration.sql` — schema migration

### Modified Files
- `prisma/schema.prisma` + `prisma/schema.prod.prisma` — added `isDefault` column to Course
- `src/lib/seed.ts` — now creates the default course + links it to Default Batch on every server start
- `src/app/api/courses/seed-default/route.ts` — sets isDefault + links to Default Batch
- `src/app/api/courses/route.ts` — returns isDefault in list response
- `src/app/api/courses/[id]/route.ts` — returns isDefault in detail response
- `src/app/api/users/[id]/approve/route.ts` — ensures Default Batch has a courseId before assigning student
- `src/app/api/users/route.ts` — H8 fix: allows students + guardians with restricted scope
- `src/components/examiner/AppShell.tsx` — wires SettingsPanel + GuardianReportCards
- `src/components/examiner/CoursePlanner.tsx` — Default badge + Set as Default button
- `src/components/examiner/Login.tsx` — extended PublicUser type with hasSecurityQuestion, batchId, courseId, courseName
- `src/components/examiner/teacher/MentorshipView.tsx` — H15 fix: load() now fetches touchpoints + queue includes follow-ups
- `src/components/examiner/teacher/StudentPortfolioPage.tsx` — H6 fix: renders GuardianCreationPanel

## Build Verification

- `npx prisma generate` — OK
- `npx tsc --noEmit` — OK (no new errors)
- `npx next build` — ✓ Compiled successfully in 29.7s, all 100 static pages generated
- `npx vitest run` — 142 passed, 5 skipped, 1 pre-existing DB-dependent failure

## Audit Status

| Priority | Total | Fixed | Pending |
|----------|-------|-------|---------|
| CRITICAL | 10 | 10 ✅ | 0 |
| HIGH | 16 | 5 ✅ (H6, H8, H13, H14, H15) | 11 |
| MEDIUM | 15 | 0 | 15 |
| LOW | 10 | 0 | 10 |
| **TOTAL** | **51** | **15** | **36** |
