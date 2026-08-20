// src/modules/ui-v3/index.ts — Barrel exports for v3 UI.
// Content-only components (render inside V3Shell provided by the layout).
export { V3Shell } from "./v3-shell";
export type { V3NavGroup, V3NavItem } from "./v3-shell";
export { V3Card, V3StatCard, V3Badge, V3Progress, V3PageHeader, V3SectionTitle } from "./v3-shell";
export { V3LearnerHomeContent } from "./learner-home";
export { V3InstructorHomeContent } from "./instructor-home";
export { V3OrgHomeContent } from "./org-home";
export { V3PlatformHomeContent } from "./platform-home";
export { V3CoursesCatalog } from "./courses";
export { V3Classroom } from "./classroom";
export { UIToggle } from "./ui-toggle";
export { StateSkeleton, StateSkeletonHero, StateEmpty, StateError, StateFor } from "./states";
