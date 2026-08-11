/**
 * LEARN MODULE — barrel re-exports.
 *
 * Import everything from `@/modules/learn` in app code:
 *   import { awardXP, getTodayTopic, SLIDES_PER_TOPIC } from "@/modules/learn";
 *
 * NOTE: This barrel mixes server-only and isomorphic code. Anything
 * imported from here will pull in `db` (server-side). Client components
 * should import directly from `@/modules/learn/types` or
 * `@/modules/learn/lib/tts-filter` to avoid bundling the DB client.
 */

// Types + constants (isomorphic — safe to import from client)
export * from "./types";

// Server-only lib (uses `db` and `callAI`)
export * from "./lib/today-topic";
export * from "./lib/xp-ledger";
export * from "./lib/learner-profile";

// Client-only lib (uses `window.speechSynthesis`)
export {
  prepareForTTS,
  speakTTS,
  stopTTS,
  isTTSAvailable,
} from "./lib/tts-filter";
