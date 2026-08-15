/**
 * modules/ai — the AI data layer (2026-08-15)
 *
 * Privacy-safe, cached data feeding for every AI surface:
 *   - privacy: deterministic pseudonyms + AES-256-GCM encryption
 *   - context-cache: per-subject, DB-backed, hit/miss accounted
 *   - context-packs: anonymized course / learner / cohort / project data
 */

export {
  pseudonym,
  estimateTokens,
  encryptPayload,
  decryptPayload,
} from "./privacy";

export {
  getOrBuildContextPack,
  clearNamespace,
  getCacheOverview,
  evictExpired,
  type NamespaceStat,
} from "./context-cache";

export {
  getCourseOutlinePack,
  getTutorTopicPack,
  getLearnerPack,
  getCohortPack,
  getProjectPack,
  buildTutorBlocksFromPacks,
  type CourseOutlinePack,
  type TutorTopicPack,
  type LearnerPack,
  type CohortPack,
  type ProjectPack,
} from "./context-packs";
