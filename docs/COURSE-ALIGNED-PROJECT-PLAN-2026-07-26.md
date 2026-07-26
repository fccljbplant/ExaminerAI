# Course-Aligned Project Plan + Daily Tasks (AI Generator v2)

> **Date:** 2026-07-26
> **Status:** Implemented + deployed
> **Supersedes:** the old generic project task generator
> **Related audit fixes:** C4 (certificate approval UI), C5 (teacher create assignments), C6 (principal academic tab)

## Overview

The capstone project plan + daily task generator is now **course-aligned**: each generated task is paired with a specific course daily topic, so students see a clear bridge between what they're learning in the course and what they're building for their project. The Daily Task Reminder and Check-in panel both surface this pairing, so the student's "today" experience is a single coherent flow:

> **Today's course topic:** REST APIs
> **Today's project task:** Build the GET /products endpoint for your e-commerce store — _🔗 Builds on course topic: REST APIs_

## Old vs. New

### Old generator (replaced)

The previous `/api/project/generate-tasks` endpoint:
- Loaded only the student's project definition (name, scope, objectives, etc.)
- Asked the AI for `N` weeks × 5 tasks/week, generic to "no-code bootcamp tools"
- Stored tasks with `week` + `day` columns but NO link to course topics
- Each task was a free-floating project task with no curriculum context
- Fallback was a hardcoded 6-phase bootcamp plan (WordPress/LocalWP-specific)

### New generator (current)

The new `generateCourseAlignedPlan()` in `src/modules/project/lib/course-aligned-planner.ts`:
- Loads the student's project definition **AND** their course outline (all weeks + daily topics + objectives)
- Aligns each project week with a course week (1:1 when `projectDurationWeeks <= courseWeeks`)
- Builds a course-context section in the AI prompt showing each project week's aligned course week + daily topics
- Asks the AI for a single JSON object with `weeks` (title/summary/milestones) + `tasks` (per-day, with `courseTopicLink`)
- Each task's `courseTopicLink` explains how the task connects to that day's course topic
- Stores `courseTopicLink` in the `ProjectTask.taskNotes` column (already existed)
- Fallback generates a sensible plan using the actual course daily topics (no AI dependency)

## AI Prompt Structure

The AI receives three sections:

```
=== STUDENT'S PROJECT ===
Project Name: ...
Scope: ...
Objectives: ...
...

=== COURSE OUTLINE (project weeks align with these course weeks) ===
PROJECT WEEK 1 (aligns with COURSE WEEK 1: Foundations of Web Development)
  Day 1: HTML Basics — Objective: Build a static webpage with semantic HTML
  Day 2: CSS Styling — Objective: Style a page with selectors and the box model
  Day 3: ...

PROJECT WEEK 2 (aligns with COURSE WEEK 2: JavaScript Fundamentals)
  Day 1: Variables + Types — Objective: Declare and use JavaScript variables
  ...

=== REQUIREMENTS ===
For EACH project week, generate:
1. A week plan: title, summary (1-2 sentences), 1-3 milestones
2. 5 tasks, one per day (day 1-5, Mon-Fri)

Each task MUST:
- Be specific to THIS student's project — use the project name and features
- Be actionable in 2-4 hours by a beginner
- BUILD ON the course topic for that day (reference the course concept in the task description)
- Have a clear deliverable (not vague like "research" or "plan")
- Include a "courseTopicLink" field — a short note explaining how the task connects to that day's course topic
```

The AI returns:

```json
{
  "weeks": [
    { "week": 1, "courseWeek": 1, "title": "Week 1: Foundation + Project Setup", "summary": "...", "milestones": ["..."] }
  ],
  "tasks": [
    { "week": 1, "day": 1, "description": "Set up the dev environment for your e-commerce store and build the homepage skeleton with semantic HTML.", "isMilestone": false, "courseTopicLink": "Builds on course topic: HTML Basics" }
  ]
}
```

## Daily Task Reminder Sync

The `DailyTaskReminder` component (floating popup) now:

1. **Hides the project section entirely** when `projectConfig.projectEnabled` is false (no course assigned, or course has projects disabled).
2. **Shows the `courseTopicLink`** under each project task description, prefixed with 🔗.
3. **Shows a "Required" badge** on the project section header when the project is required.
4. **Shows a "Milestone" badge** on individual tasks marked as milestones.
5. **The "all done" green state** conditionally mentions project tasks only when projects are enabled.

The `/api/daily-tasks` endpoint now:
- Returns `projectConfig` alongside the existing task data, so the UI can decide whether to render the project section.
- Returns `courseTopicLink` on each pending project task (read from `ProjectTask.taskNotes`).
- Doesn't count project tasks toward `pendingCount` when projects are disabled (so the floating badge doesn't show a false positive).

## Daily Check-In Sync

The `CheckInPanel` (Study → Check-in tab) now:

1. **Hides the curriculum cards** (Today's Curriculum, Learning Progress chart, Weekly Curriculum list) when no course is assigned — replaced with a friendly "No course assigned yet" notice.
2. **Shows a new "Today's Project Task" card** (between the weekly curriculum overview and the daily check-in form) when projects are enabled. This card:
   - Lists today's pending project tasks
   - Shows the 🔗 `courseTopicLink` for each
   - Has a "Mark done" button (calls PATCH `/api/tasks`)
   - Has an "Open Project" button (navigates to the Project tab)
   - Shows a "Required" badge when the project is required
3. **Shows context-aware hints** in the daily check-in form header:
   - Project required: "Your course requires a capstone project — mention what you worked on for it today (if anything)."
   - Project optional: "Your course offers an optional capstone project — feel free to log project work here too."
   - No course: "You don't have a course assigned yet — log any learning you did today (reading, practice, side projects, etc.)."

## Project Plan UI Updates

- `ProjectDescriptionCard` — the "Generate" CTA now explicitly says "Generate your **course-aligned** project plan with AI" and explains that the AI reads the project summary AND the course outline.
- `ProjectWeekPlan` — the task-notes input is now labeled "Course topic link" with a clear placeholder ("e.g. Builds on course topic: REST APIs") and helper text. Task notes are now displayed with a 🔗 icon and primary color to visually signal they're course-alignment links.

## API Reference

### `POST /api/project/generate-tasks` (rewritten)

Request body (unchanged):

```json
{
  "weeks": 4,            // optional, default = user.projectDurationWeeks
  "tasksPerWeek": 5,     // optional, default 5, max 10
  "replace": true        // optional, default false
}
```

Response (unchanged shape, clearer message):

```json
{
  "ok": true,
  "tasksCreated": 20,
  "weeksGenerated": 4,
  "weeksCovered": 4,
  "message": "Generated 20 course-aligned project tasks across 4 weeks. Each task is paired with a course daily topic — view them in the Project tab."
}
```

Implementation: delegates to `generateCourseAlignedPlan()` in `src/modules/project/lib/course-aligned-planner.ts`.

### `GET /api/daily-tasks` (extended)

New fields in the response:

```json
{
  "projectTasks": [
    {
      "id": "...",
      "description": "Build the GET /products endpoint for your e-commerce store",
      "status": "planned",
      "isMilestone": false,
      "estimatedMinutes": null,
      "courseTopicLink": "Builds on course topic: REST APIs"  // NEW
    }
  ],
  "projectConfig": {  // NEW
    "courseAssigned": true,
    "courseId": "clxxx",
    "courseName": "Python for Data Science",
    "totalWeeks": 8,
    "projectEnabled": true,
    "projectRequired": true,
    "projectDefaultDurationWeeks": 5
  }
}
```

## Audit Fixes Included

This change also includes the following audit fixes from the 51-finding audit (2026-07-26):

| # | Finding | Fix |
|---|---------|-----|
| C4 | Certificate approval has NO UI — students request, nobody can approve from the interface | New `CertificateApprovals` component in the teacher Assignments tab; new `GET /api/certificates/pending` endpoint that lists pending requests with computed eligibility info; teachers can approve (issues certificate with computed grade/score) or reject (with a reason visible to the student) |
| C5 | Teacher cannot create assignments — `createTask()` missing required `batchId` | `AssignmentsTab` now fetches the teacher's `batchId` from `/api/auth/me` (which now exposes it) and passes it to `POST /api/group-tasks`. The "New Assignment" button is disabled with a clear error when no batch is assigned. |
| C6 | Principal Academic tab shows entirely fake data (all zeros) | `GET /api/principal/overview` now runs real queries for `coursePerformance` (student count per course + avg weekly test score across the course's batches) and `teacherPerformance` (batch count from BatchTeacher junction, mentorship session count, alerts raised count). The hardcoded `studentCount: 0, avgScore: 0` values are gone. |

## File Changes

### New Files
- `src/modules/project/lib/course-aligned-planner.ts` — the new course-aligned AI generator
- `src/app/api/certificates/pending/route.ts` — C4 fix: lists pending certificate requests for staff
- `src/components/examiner/teacher/CertificateApprovals.tsx` — C4 fix: UI for reviewing/approving/rejecting certificate requests

### Modified Files
- `src/app/api/project/generate-tasks/route.ts` — rewritten to delegate to `generateCourseAlignedPlan()`
- `src/app/api/daily-tasks/route.ts` — returns `projectConfig` + `courseTopicLink` per task; respects project enabled flag in `pendingCount`/`allDone`
- `src/app/api/auth/me/route.ts` — C5 fix: exposes `batchId` in the user response
- `src/app/api/principal/overview/route.ts` — C6 fix: real `coursePerformance` + `teacherPerformance` queries
- `src/components/examiner/DailyTaskReminder.tsx` — hides project section when disabled; shows `courseTopicLink` + Milestone badge
- `src/components/examiner/student/CheckInPanel.tsx` — new "Today's Project Task" card; hides curriculum when no course; context-aware form hints
- `src/components/examiner/student/ProjectDescriptionCard.tsx` — clearer "course-aligned" Generate CTA
- `src/components/examiner/student/ProjectWeekPlan.tsx` — relabeled task-notes as "Course topic link" with 🔗 display
- `src/components/examiner/teacher/AssignmentsTab.tsx` — C5 fix: fetches + uses batchId; C4 fix: renders `<CertificateApprovals />` at the bottom

## Migration Path

No schema migration needed — the new generator uses the existing `ProjectTask.taskNotes` column to store the `courseTopicLink` string. Existing tasks (from the old generator) continue to work; their `taskNotes` will be null, so the UI simply won't show the 🔗 link for them.

Students who want the new course-aligned tasks should use the "Regenerate Tasks" button in the Project tab (which calls the same endpoint with `replace: true`).
