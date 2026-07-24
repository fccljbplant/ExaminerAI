# Course-as-Package Architecture

## Overview

Each course in the AI Examiner is a **self-contained package** stored in the database. When a student is assigned to a cohort with a course, **ALL app features adapt** to that course — journey steps, learning topics, AI prompts, test config, project template, and report card template.

No per-course folders on the filesystem. Everything is in the DB.

## Data Flow

```
Student logs in
  → /api/auth/me returns courseId + courseName
  → /api/course/config returns ALL course configs in one call
  → All API routes call course-db.ts / course-config.ts
  → Functions look up: user → cohort → course → config JSON field
  → If course has config → use it
  → If null → fall back to course-defaults.ts
```

## File Structure (Clean — No Per-Course Folders)

```
src/lib/
├── course-defaults.ts    ← Single source of truth for the DEFAULT course
│                           (journey steps, capstone ideas, test config, AI prompts,
│                            report card template, project template)
├── course-config.ts      ← DB-backed config loader (user → cohort → course → JSON)
│                           Falls back to course-defaults.ts if no course assigned
├── course-db.ts          ← DB-backed curriculum loader (weeks, days, topics)
│                           Falls back to course-topics.ts if no course assigned
├── course-topics.ts      ← Hardcoded 6-week curriculum (fallback for course-db.ts)
├── ai-prompts.ts         ← Hardcoded AI prompts (fallback for course-config.ts)
└── constants.ts          ← PILLARS, scoreToGrade (used by course-defaults.ts)
```

## Course Model (Database)

| Field | Type | Purpose |
|:---|:---|:---|
| `name` | String | Course name (e.g. "Modern Web Dev & AI Bootcamp") |
| `description` | String | Course description |
| `isActive` | Boolean | Soft-delete flag |
| `journeyStepsJson` | String? | JSON array of journey wizard steps |
| `projectTemplateJson` | String? | JSON: default project definition + capstone ideas |
| `aiPromptsJson` | String? | JSON: custom AI system prompts |
| `testConfigJson` | String? | JSON: { totalQuestions, maxReplies, pillars, minScoreFloor } |
| `reportCardTemplateJson` | String? | JSON: grading scale + weights + sections |
| `weeks` | CourseWeek[] | Curriculum weeks (each with 5 days) |

## What Each Course Controls

| Feature | Config Field | Fallback |
|:---|:---|:---|
| Journey wizard steps | `journeyStepsJson` | `DEFAULT_JOURNEY_STEPS` in `course-defaults.ts` |
| Capstone project ideas | `projectTemplateJson` | `DEFAULT_CAPSTONE_IDEAS` in `course-defaults.ts` |
| AI system prompts | `aiPromptsJson` | `DEFAULT_AI_PROMPTS` in `course-defaults.ts` |
| Weekly test config | `testConfigJson` | `DEFAULT_TEST_CONFIG` in `course-defaults.ts` |
| Report card grading | `reportCardTemplateJson` | `DEFAULT_REPORT_CARD_TEMPLATE` in `course-defaults.ts` |
| Learning topics (weeks/days) | `CourseWeek` + `CourseDay` tables | `WEEKLY_TOPICS` in `course-topics.ts` |

## API Endpoints

### Admin/Teacher (Course Planner)
| Method | Path | Purpose |
|:---|:---|:---|
| GET | `/api/courses` | List all courses |
| POST | `/api/courses` | Create a course |
| GET | `/api/courses/[id]` | Get course with all weeks/days/configs |
| PUT | `/api/courses/[id]` | Update course (full replace weeks + update configs) |
| DELETE | `/api/courses/[id]` | Delete course (cascade) |
| POST | `/api/courses/seed-default` | Create the default bootcamp from `course-defaults.ts` |

### Student (Auto-loaded)
| Method | Path | Purpose |
|:---|:---|:---|
| GET | `/api/course/config` | Returns ALL course configs for the current student |
| GET | `/api/curriculum/progress` | Curriculum completion (reads from DB course) |
| GET | `/api/daily-tasks` | Today's topic (reads from DB course) |
| POST | `/api/ai/generate` | Practice question (reads from DB course topics) |
| POST/GET | `/api/ai/weekly-test` | Weekly test (reads from DB course + test config) |
| GET | `/api/students/final-result` | Final result (reads from DB course phase names) |

## How to Create a New Course

1. Admin/Teacher opens **Course Planner** tab
2. Click **"Seed Default"** → creates the standard 6-week bootcamp with ALL configs
3. Or click **"New Course"** → creates empty course
4. Edit:
   - Course name + description
   - Weeks (add/remove, edit phase names)
   - Days (add/remove, edit title, objective, resources)
   - Configs (journey steps, project template, AI prompts, test config, report card)
5. Assign to a cohort → all students in that cohort get that course's everything

## Backward Compatibility

If no course is assigned to a student's cohort, ALL functions fall back to the hardcoded defaults in `course-defaults.ts` and `course-topics.ts`. Existing deployments continue to work without any changes.
