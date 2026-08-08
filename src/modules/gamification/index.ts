/**
 * src/modules/gamification/index.ts
 *
 * Gamification module — Evidence-Locked XP + Badges + Celebration animations.
 *
 * Everything related to learner motivation that's tied to VERIFIED actions
 * (not engagement metrics). XP and badges are only awarded for AI-graded
 * actions — they're a trust signal for employers, not engagement bait.
 *
 * Public API:
 *   - awardXP(), getLearnerXP(), levelForXp(), levelProgress()
 *   - awardBadge(), getLearnerBadges(), getBadgeStats(), BADGES
 *   - <LearnerXPBar />, <LearnerBadgeCollection />, <CelebrationOverlay />
 *
 * Components:
 *   - LearnerXPBar        — XP progress bar (mount on TodayView)
 *   - LearnerBadgeCollection — badge grid (mount on Progress view)
 *   - CelebrationOverlay  — confetti + pop-in animation (mount globally)
 *
 * Lib:
 *   - learner-xp.ts       — XP awards, levels, idempotent awarding
 *   - learner-badges.ts   — Badge definitions, award logic, stats
 *
 * Storage: User.journeyProgress JSON field (no schema migration needed).
 */

// ── Lib re-exports ──────────────────────────────────────────────
export {
  awardXP,
  getLearnerXP,
  levelForXp,
  levelProgress,
  XP_AWARDS,
  LEVELS,
  type XPAwardReason,
  type Level,
} from "./lib/learner-xp";

export {
  awardBadge,
  getLearnerBadges,
  getBadgeStats,
  hasBadge,
  getBadge,
  BADGES,
  type BadgeDef,
} from "./lib/learner-badges";

// ── Component re-exports ────────────────────────────────────────
export { LearnerXPBar } from "./components/LearnerXPBar";
export { LearnerBadgeCollection } from "./components/LearnerBadgeCollection";
export { CelebrationOverlay } from "./components/CelebrationOverlay";
