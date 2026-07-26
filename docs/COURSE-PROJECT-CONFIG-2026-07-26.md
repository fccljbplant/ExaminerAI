# Course-Aware Project Configuration

> **Date:** 2026-07-26
> **Status:** Implemented + deployed
> **Related audit fixes:** C1, C2, C3, C7, C8, C9, C10 (audit 2026-07-26)

## Overview

The capstone project feature is now **course-aware**: course coordinators decide whether each course offers a capstone project at all, whether it's required, and the default duration students see when setting one up. Students only see the Project nav item, banners, and forms when their course has projects enabled AND the course is at least 4 weeks long.

This eliminates the previous "one-size-fits-all" behavior where every student saw the project UI regardless of course length or coordinator intent.

## Schema Changes

Three new columns on the `Course` model (migration `20260726000000_course_project_config`):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `projectEnabled` | Boolean | `false` | Whether the capstone project feature is available for this course at all. When `false`, students do NOT see the Project nav item, the Project tab, or any project banners. |
| `projectRequired` | Boolean | `false` | Whether the project is MANDATORY. Only meaningful when `projectEnabled = true`. When `true`, students see a "Required" badge and the alert system treats missing project tasks as attention-worthy. |
| `projectDefaultDurationWeeks` | Int | `4` | The default project duration suggested to students. Bounded `[2, courseWeeks - 1]` by the API. |

## Validation Rules (enforced in API)

1. **`projectEnabled` requires `courseWeeks >= 4`** — courses shorter than 4 weeks cannot enable projects (too short for a meaningful capstone). The API returns HTTP 400 if you try.
2. **`projectDefaultDurationWeeks` must be in `[2, courseWeeks - 1]`** — the API clamps any incoming value to this range. This ensures the project always finishes before the course ends.
3. **`projectRequired` is auto-disabled when `projectEnabled` is turned off** — the API enforces this so the data stays consistent.

## Course Planner UI

The Course Planner now has a **Capstone Project** card in the course detail view (between the metadata card and the weekly plan). It contains:

- **Enable capstone project** toggle — disabled (with explanation) when the course has fewer than 4 weeks.
- **Project is required** toggle — only visible when projects are enabled.
- **Default project duration** dropdown — options are `2` through `courseWeeks - 1`. Only visible when projects are enabled.
- **What students will see** info box — describes the student experience based on the current config.

The course list cards also show a "Project Required" (amber) or "Project Optional" (emerald) badge when projects are enabled.

## Student Experience

### When `projectEnabled = false` (or no course assigned)

- The **Project** nav item is **hidden** from the sidebar.
- The **"Start your capstone project"** banner on the Home view is **hidden**.
- The **"Project Tasks"** daily action item is **hidden**.
- The **Project tab** is unreachable (the nav is hidden, and even if accessed via URL, the project setup API refuses).
- The **Daily Check-in** form shows a hint explaining there's no course assigned (or project is disabled).
- The **alert system** does NOT send project-inactivity nudges.

### When `projectEnabled = true` and `projectRequired = false`

- The Project nav item is visible.
- The Home view shows the "Start your capstone project" banner (without a "Required" badge) when no project tasks exist.
- The Daily Check-in form shows: *"Your course offers an optional capstone project — feel free to log project work here too."*
- The alert system does NOT send project-inactivity nudges (project is optional).

### When `projectEnabled = true` and `projectRequired = true`

- The Project nav item is visible.
- The Home view shows the "Start your capstone project" banner **with a "Required" badge** when no project tasks exist.
- The Daily Check-in form shows: *"Your course requires a capstone project — mention what you worked on for it today (if anything)."*
- The alert system flags students past week 2 who haven't started their project as needing attention, and notifies their teacher.

## Project Setup Form

The Project Settings card now fetches the student's course config from `/api/courses/user/outline` and:

- Renders the duration as a **`<select>` dropdown** with options `2` through `courseWeeks - 1` (instead of the old free-form number input).
- Shows a hint: *"(2–N for this course)"* next to the label.
- Shows a longer explanation below: *"Your course is N weeks long. Project duration must be between 2 and N-1 weeks (course weeks − 1) so you can finish before the course ends."*
- Pre-selects the course's configured default duration.
- Clamps any existing duration (from before the course was configured) to the new bounds on load.

If the student has no course assigned (e.g. demo account, dev impersonation), the form falls back to the legacy free-form input `min=1 max=52`.

## Daily Check-In Behavior

The Check-in panel now respects course + project config:

| State | "Today's Curriculum" card | "Learning Progress" chart | "This Week's Curriculum" list | Form hint |
|-------|---------------------------|---------------------------|--------------------------------|-----------|
| No course assigned | Hidden — replaced with "No course assigned yet" notice | Hidden | Hidden | "You don't have a course assigned yet — log any learning you did today (reading, practice, side projects, etc.)." |
| Course assigned, project disabled | Shown | Shown | Shown | (no extra hint) |
| Course assigned, project optional | Shown | Shown | Shown | "Your course offers an optional capstone project — feel free to log project work here too." |
| Course assigned, project required | Shown | Shown | Shown | "Your course requires a capstone project — mention what you worked on for it today (if anything)." |

## Alert System Behavior

The `/api/students/check-alerts` cron job (runs daily at 9 AM UTC) now makes project-aware decisions:

1. **Inactivity nudges** — only sent to students with a course assigned. Students without a course don't get nagged about missing check-ins (the check-in is most valuable when tied to a course's daily curriculum).
2. **Project-required alerts** — when a student's course has `projectRequired = true`, the system adds a new struggle signal `"Has not started the required capstone project (week N)"` for students past week 2 who have 0 project tasks. This triggers a teacher alert via the existing struggle-signals pipeline.
3. **Project-optional / disabled** — no project-related alerts are ever generated.

## API Reference

### `GET /api/courses/user/outline`

Returns the full course outline + a new `project` block:

```json
{
  "courseName": "Python for Data Science",
  "totalWeeks": 8,
  "weeks": [...],
  "project": {
    "courseAssigned": true,
    "courseId": "clxxx...",
    "courseName": "Python for Data Science",
    "totalWeeks": 8,
    "projectEnabled": true,
    "projectRequired": true,
    "projectDefaultDurationWeeks": 5,
    "maxProjectDurationWeeks": 7,
    "minProjectDurationWeeks": 2
  }
}
```

### `GET /api/stats?as=student`

Returns the same project config as `projectConfig` at the top level of the response (alongside `stats`, `tasks`, `weeklyTests`, etc.):

```json
{
  "role": "student",
  "stats": { ... },
  "tasks": [ ... ],
  "projectConfig": {
    "courseAssigned": true,
    "courseId": "clxxx...",
    "courseName": "Python for Data Science",
    "totalWeeks": 8,
    "projectEnabled": true,
    "projectRequired": true,
    "projectDefaultDurationWeeks": 5
  }
}
```

### `POST /api/courses` and `PUT /api/courses/[id]`

Accept the following optional fields in the request body:

```json
{
  "name": "Python for Data Science",
  "weeks": [ ... ],
  "projectEnabled": true,
  "projectRequired": true,
  "projectDefaultDurationWeeks": 5
}
```

The API:
- Refuses `projectEnabled: true` when the course has fewer than 4 weeks (HTTP 400).
- Clamps `projectDefaultDurationWeeks` to `[2, courseWeeks - 1]`.
- Auto-disables `projectRequired` when `projectEnabled` is `false`.

### `POST /api/project/setup` and `PATCH /api/project/setup`

Enforce the course-level project config:
- Refuses to create a project when the student's course has `projectEnabled = false` (HTTP 403 with a clear error message).
- Clamps `projectDurationWeeks` to `[2, courseWeeks - 1]` when a course is assigned.
- Falls back to the legacy `[1, 52]` range when no course is assigned (for demo/dev impersonation).

## Migration Path

The migration is **additive and safe** — all three new columns have defaults, so existing course rows are automatically populated with `projectEnabled = false`, `projectRequired = false`, `projectDefaultDurationWeeks = 4`. Existing deployments continue to work unchanged until a course coordinator explicitly enables projects on a course.

**After migration, the only behavioral change is:** students with no course assigned (or whose course hasn't enabled projects) will no longer see the Project nav item. This is intentional — they couldn't actually use the feature meaningfully before either, since they had no curriculum context for a capstone project.

## Audit Fixes Included

This change also includes the following audit fixes from the 51-finding audit (2026-07-26):

| # | Finding | Fix |
|---|---------|-----|
| C1 | Null-institutionId in scope.ts leaks cross-institution data | Returns empty scope arrays when institutionId is null (no unfiltered Prisma queries) |
| C2 | `/api/admin/cleanup-psych-data` runs `deleteMany({})` wiping all institutions | Now scoped to caller's institution via `user.institutionId` |
| C3 | `/api/tasks` DELETE wipes comments on ANY task (not scoped to userId) | Verifies task ownership FIRST, then deletes comments |
| C7 | Escalation cron 401s every night (auth header vs query param mismatch) | Now accepts BOTH `?secret=` and `Authorization: Bearer` with timing-safe comparison; added GET handler |
| C8 | Safeguarding flags stored against studentId instead of teacherId | Now stored against teacherId (the one who used the language); studentId kept in resolutionNote for context |
| C9 | `/api/ai/debug` leaks API key prefix (8 chars) + suffix (4 chars) | Now only reports "set (length: N)" — no characters leaked |
| C10 | RoleNavConfigPanel missing 9 nav keys — saving config could brick any role's sidebar | Added all 9 missing keys to ALL_NAV_KEYS and DEFAULT_NAV_PER_ROLE |

## File Changes

### Schema
- `prisma/schema.prisma` — added 3 columns to Course model
- `prisma/schema.prod.prisma` — same
- `prisma/migrations/20260726000000_course_project_config/migration.sql` — new migration

### API
- `src/app/api/courses/route.ts` — POST + GET handle project config
- `src/app/api/courses/[id]/route.ts` — PUT + GET handle project config
- `src/app/api/courses/user/outline/route.ts` — returns `project` block
- `src/app/api/stats/route.ts` — returns `projectConfig` for students
- `src/app/api/project/setup/route.ts` — POST + PATCH enforce course bounds
- `src/app/api/students/check-alerts/route.ts` — project-aware alerts + skips course-less inactivity nudges
- `src/app/api/assistant/escalation/run/route.ts` — C7 fix
- `src/app/api/admin/cleanup-psych-data/route.ts` — C2 fix
- `src/app/api/tasks/route.ts` — C3 fix
- `src/app/api/messages/route.ts` — C8 fix
- `src/app/api/comments/route.ts` — C8 fix
- `src/app/api/ai/debug/route.ts` — C9 fix
- `src/app/api/role-nav-config/route.ts` — C10 fix

### Lib
- `src/lib/ai-assistant/scope.ts` — C1 fix
- `src/lib/ai-assistant/data-efficiency.ts` — C1 fix
- `src/modules/course/lib/course-db.ts` — new `getCourseProjectConfig(userId)` helper

### UI
- `src/components/examiner/CoursePlanner.tsx` — Capstone Project config card + course list badges
- `src/components/examiner/AppShell.tsx` — hides Project nav when project disabled
- `src/components/examiner/StudentDashboard.tsx` — banner + daily actions respect project config
- `src/components/examiner/student/ProjectSettingsCard.tsx` — duration dropdown bound to course weeks
- `src/components/examiner/student/ProjectDescriptionCard.tsx` — removed redundant banner
- `src/components/examiner/student/CheckInPanel.tsx` — respects course assignment + project enable/required
- `src/components/examiner/student/types.ts` — added ProjectConfig interface

### Tests
- `src/lib/__tests__/grading-and-topics.test.ts` — fixed pre-existing test failure (amber vs warning naming)
