/**
 * Project Module — Public API
 *
 * Owns: student project planning, task management, weekly progress,
 * project reports, group tasks, and AI-powered task generation.
 *
 * Structure:
 *   src/modules/project/
 *   ├── index.ts              ← public API (this file)
 *   ├── types/
 *   │   └── index.ts          ← shared types (ProjectTask, ProjectWeek, etc.)
 *   ├── lib/
 *   │   ├── project-setup.ts  ← project initialization + config
 *   │   ├── course-aligned-planner.ts ← AI-powered course-aligned task generation
 *   │   ├── project-reports.ts← project report management
 *   │   └── project-weeks.ts  ← weekly plan management
 *   └── components/
 *       ├── CoursePlanner.tsx  ← project planning UI (legacy name)
 *       ├── StudentAssignmentsPanel.tsx
 *       └── DailyTaskReminder.tsx
 *
 * API routes (thin HTTP wrappers, stay under src/app/api/):
 *   - POST/GET/PUT/DELETE /api/project/setup
 *   - POST /api/project/generate-tasks (AI task generation)
 *   - GET/POST/DELETE /api/project/reports
 *   - GET/PUT /api/project/weeks
 *   - GET/POST/PUT/DELETE /api/project/plan
 *   - GET/POST/PUT/DELETE /api/tasks
 *   - GET /api/daily-tasks
 *   - GET/POST/PUT/DELETE /api/group-tasks
 *   - POST /api/group-tasks/submit
 */

// === Types ===
export type {
  ProjectTask,
  ProjectWeek,
  ProjectReport,
  GroupTask,
  GroupTaskSubmission,
} from "./types";

// === Project Setup ===
export {
  setupProject,
  deleteProject,
  getProjectPlan,
  updateProjectPlan,
} from "./lib/project-setup";

// === Project Reports ===
export {
  getProjectReports,
  submitProjectReport,
  deleteProjectReport,
} from "./lib/project-reports";

// === Project Weeks ===
export {
  getProjectWeeks,
  updateProjectWeek,
} from "./lib/project-weeks";

// === UI Components (re-exported from src/components/examiner/) ===
// Components stay in src/components/examiner/ — they depend on shared UI primitives.
// Import directly:
//   import { StudentAssignmentsPanel } from "@/components/examiner/student/StudentAssignmentsPanel";
//   import { DailyTaskReminder } from "@/components/examiner/DailyTaskReminder";
