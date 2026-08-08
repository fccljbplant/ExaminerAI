/**
 * src/modules/b2b/index.ts
 *
 * B2B (Business-to-Business) module — organization management.
 *
 * Everything related to org admins managing their team: seat management,
 * member invites, course assignment, and the admin-facing B2B dashboard
 * that shows all organizations across the platform.
 *
 * Public API:
 *   - <B2BPanel />          — admin panel showing all orgs + seat utilization
 *   - <OrgCourseAssigner /> — widget for assigning courses to team members
 *
 * Backend:
 *   - /api/org/signup       — org self-registration (creates org + admin user)
 *   - /api/org              — org CRUD (GET/POST)
 *   - /api/org/members      — member invite/list/update/remove
 *   - /api/org/assign-course — assign a course to a learner
 *   - /api/admin/orgs       — platform admin: list all orgs with stats
 *
 * Pages:
 *   - /for-business         — B2B marketing landing + ROI calculator
 *   - /signup/b2b           — org registration form
 *   - /pricing              — B2B + B2C pricing tiers
 *
 * Data models: Organization, OrgMember (in prisma/schema.prisma)
 */

export { B2BPanel } from "./components/B2BPanel";
export { OrgCourseAssigner } from "./components/OrgCourseAssigner";
