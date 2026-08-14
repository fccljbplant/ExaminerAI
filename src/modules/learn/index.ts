// src/modules/learn/index.ts — Barrel re-exports for the Learn platform.
/**
 * LEARN MODULE — barrel re-exports.
 * Import everything from `@/modules/learn` in app code:
 * import { awardXP, getTodayTopic, SLIDES_PER_TOPIC } from "@/modules/learn";
 *
 * NOTE: This barrel mixes server-only and isomorphic code. Anything
 * imported from here will pull in `db` (server-side). Client components
 * should import directly from `@/modules/learn/types`,
 * `@/modules/learn/lib/tts-filter`, `@/modules/learn/lib/voice-input`,
 * or the component files under `@/modules/learn/components/` to avoid
 * bundling the DB client.
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

// Client-only lib (uses `window.SpeechRecognition`)
export {
 isVoiceInputAvailable,
 createVoiceInput,
 type VoiceInputHandlers,
 type VoiceInputSession,
} from "./lib/voice-input";

// ── Classroom components (client-only) ─────────────────────────
export { ClassroomShell } from "./components/classroom/ClassroomShell";
export { LessonStage } from "./components/classroom/LessonStage";
export { VoiceBar } from "./components/classroom/VoiceBar";
export { AvatarStage } from "./components/avatar/AvatarStage";
export { AvatarRig, tutor } from "./components/avatar/avatar-rig";
