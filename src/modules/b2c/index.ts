/**
 * src/modules/b2c/index.ts
 *
 * B2C (Business-to-Consumer) module — individual learner management.
 *
 * Everything related to individual learners who self-register (not part
 * of an org): learner metrics, engagement stats, and the admin-facing
 * B2C dashboard.
 *
 * Public API:
 *   - <B2CPanel /> — admin panel showing B2C learner metrics
 *
 * Backend:
 *   - /api/admin/b2c-stats — B2C learner stats (total, active, certs, avg score)
 *   - /api/learner/xp      — learner XP total + level + progress
 *   - /api/learner/badges  — learner earned + available badges
 *
 * Pages:
 *   - /for-learners  — B2C marketing landing
 *   - /courses       — marketplace course catalog
 *   - /app?view=signup — learner self-registration
 *
 * B2C learners are identified as: role=learner AND no OrgMember rows.
 * (B2B learners are in an org; B2C learners are not.)
 */

export { B2CPanel } from "./components/B2CPanel";
