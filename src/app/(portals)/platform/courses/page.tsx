import type { Metadata } from "next";
import { PlatformCourses } from "@/modules/platform-portal";

/** /platform/courses — course management (W16: V1 CourseManagementPanel). */

export const metadata: Metadata = { title: "Courses — TraineesAI" };

export default function PlatformCoursesPage() {
  return <PlatformCourses />;
}
