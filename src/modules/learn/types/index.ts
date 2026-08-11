// src/modules/learn/types/index.ts — Shared types + constants for the Learn platform.
/**
 * LEARN PLATFORM — Shared types and constants.
 * These types describe the AI-guided audio-visual learning experience
 * that lives under /learn. They are consumed by:
 * - src/modules/learn/lib/* (server-side logic)
 * - src/app/api/learn/* (API routes)
 * - src/components/learn/* (client UI)
 *
 * NOTE: This file is imported by BOTH server and client code, so it must
 * NOT import any server-only modules (db, ai-provider, etc.).
 */

// ── Teaching levels ────────────────────────────────────────────────
// The avatar's "teaching level" slider controls vocabulary, sentence
// length, and analogy complexity. Stored on LearnProfile.teachingLevel.
export type TeachingLevel = 1 | 2 | 3 | 4;

export const TEACHING_LEVELS: { value: TeachingLevel; label: string; description: string }[] = [
 { value: 1, label: "Kindergarten", description: "Simple words, short sentences, lots of pictures and analogies." },
 { value: 2, label: "School", description: "Plain language, clear steps, everyday examples." },
 { value: 3, label: "College", description: "Standard technical vocabulary, moderate depth." },
 { value: 4, label: "University", description: "Full technical depth, domain jargon, rigorous explanations." },
];

// ── Learner levels (XP-based progression) ──────────────────────────
// Each level requires cumulative XP. Awarded by awardXP() in xp-ledger.ts.
export interface LearnerLevel {
 name: string;
 minXp: number;
}

export const LEARNER_LEVELS: LearnerLevel[] = [
 { name: "Rookie", minXp: 0 },
 { name: "Learner", minXp: 100 },
 { name: "Scholar", minXp: 300 },
 { name: "Specialist", minXp: 700 },
 { name: "Expert", minXp: 1500 },
 { name: "Master", minXp: 3000 },
 { name: "Legend", minXp: 7000 },
];

// ── XP award amounts ───────────────────────────────────────────────
// Centralized so we never give the wrong amount for an action. Source
// of truth — every XP-awarding code path MUST read from here.
export const XP_AMOUNTS = {
 slide_taught: 5, // viewing an AI-generated slide
 probe_correct: 10, // answering the slide's check-question correctly
 quiz_correct: 15, // answering a tutor chat quiz correctly
 daily_test_done: 30, // completing the daily 3-question test
 weekly_test_done: 100, // completing the weekly test
 streak_day: 20, // daily streak bonus
 level_raise: 75, // bonus when learner-level rises
 project_step: 15, // completing a project milestone
 course_completion: 500, // finishing the last topic of the course
} as const;

export type XPReason = keyof typeof XP_AMOUNTS;

// ── Slide data shape (returned by AI slide generator) ──────────────
// A slide is the atomic teaching unit — title + bullets + analogy +
// real-world example + check-question. The TutorAvatar narrates it
// while the canvas displays it.
export interface SlideData {
 title: string;
 bullets: string[];
 visualSpec?: string;
 keyTerms: string[];
 checkQuestion?: string;
 realWorldExample?: string;
 analogy?: string;
}

// ── Topic context for AI ───────────────────────────────────────────
// Passed to callAI() when generating slides or quiz questions for a
// specific daily topic.
export interface TopicContext {
 week: number;
 day: number;
 title: string;
 objective: string;
 resources: { label: string; url: string }[];
 phase: string;
}

// ── Today's topic payload (returned by getTodayTopic) ──────────────
export interface TodayTopicResult {
 topic: TopicContext;
 slidesViewed: number;
 totalSlides: number;
 completed: boolean;
 resourcesShown: boolean;
 nextTopic: { week: number; day: number } | null;
 prevTopic: { week: number; day: number } | null;
 isLastTopicInCourse: boolean;
}

// ── Mastery map stored on LearnProfile.masteryMap ──────────────────
// Tracks current topic + history of completed topics for a user/course.
export interface MasteryMap {
 topicProgress: {
 current: { week: number; day: number } | null;
 history: { week: number; day: number; completedAt: string }[];
 slidesViewed?: number;
 resourcesShown?: boolean;
 };
}

// ── Level directive strings (passed to AI prompts) ─────────────────
// Maps a TeachingLevel to a natural-language instruction for the AI.
export const LEVEL_DIRECTIVES: Record<TeachingLevel, string> = {
 1: "Teach this like you're talking to a curious 6-year-old. Use very short sentences, simple words, and lots of fun analogies involving toys, animals, or food. Avoid all jargon. If you must use a technical word, immediately explain it with a kid-friendly comparison.",
 2: "Teach this to a bright middle-schooler. Use plain language, clear step-by-step explanations, and everyday examples (cooking, sports, school projects). Define any technical term the first time you use it.",
 3: "Teach this to a first-year college student. Use standard technical vocabulary with brief definitions. Be concise but thorough — assume the learner is comfortable with the basics of the field.",
 4: "Teach this to a final-year university student or junior professional. Use full domain terminology without hand-holding. be rigorous, include edge cases, and reference industry-standard tools and practices.",
};
