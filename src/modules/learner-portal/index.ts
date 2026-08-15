/**
 * Learner Portal Module — Public API (REDESIGN-P5 W1)
 *
 * Import from here:
 *   import { PortalShell, useApi, LearnerHome, LearnerCatalog, CourseDetail, LearnerExams, LearnerProgress } from "@/modules/learner-portal";
 */

export { PortalShell } from "./portal-shell";
export { LearnerHome } from "./home";
export { LearnerCatalog } from "./catalog";
export { CourseDetail } from "./course-detail";
export { LearnerExams } from "./exams";
export { LearnerProgress } from "./progress";
export { LearnerProfile } from "./profile";
export type { ProfileInfo } from "./profile";
export { LearnerHelp } from "./help";
export { useApi } from "./use-api";
export type { ApiState } from "./use-api";
export { LearnerAssignments } from "./assignments";
export { SubmissionFlow } from "./submission-flow";
export type { AssignmentDetail, PartInput, PartView } from "./submission-flow";
export { ExamRunner } from "./exam-runner";
export { ExamResults } from "./exam-results";
export { ProjectWorkspace } from "./project-workspace";
export { CheckInCard } from "./checkin-card";
export { LearnerMessages } from "./messages";

export { AvatarEditor } from "./avatar-editor";
