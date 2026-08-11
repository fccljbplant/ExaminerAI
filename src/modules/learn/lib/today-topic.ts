// src/modules/learn/lib/today-topic.ts — Topic progression logic for the Learn platform.
/**
 * Topic progression logic for the Learn platform.
 * The course is structured as 6 weeks × 5 days = 30 topics (from
 * WEEKLY_TOPICS). Each topic is taught over `SLIDES_PER_TOPIC` slides.
 * The user's progress through topics is tracked on LearnProfile.masteryMap.
 *
 * masteryMap shape:
 * { topicProgress: { current: {week,day} | null,
 * history: [{week,day,completedAt}],
 * slidesViewed: number,
 * resourcesShown: boolean } }
 *
 * All functions are server-side (they hit the DB via `db`).
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
 WEEKLY_TOPICS,
 getWeekPhase,
 type DailyTopic,
} from "@/modules/course/lib/course-topics";
import type {
 MasteryMap,
 TopicContext,
 TodayTopicResult,
} from "../types";
import { XP_AMOUNTS } from "../types";
import { awardXP } from "./xp-ledger";

/** Number of slides generated per topic. */
export const SLIDES_PER_TOPIC = 4;

// ── Pure helpers (no DB) — exported for unit testing ──────────────

/** Look up a topic by (week, day). Returns null if out of range. */
export function getTopicByWeekDay(week: number, day: number): DailyTopic | null {
 if (week < 1 || week > WEEKLY_TOPICS.length) return null;
 const w = WEEKLY_TOPICS[week - 1];
 if (day < 1 || day > w.topics.length) return null;
 return w.topics[day - 1] ?? null;
}

/** Returns the next (week, day) tuple, or null if at course end. */
export function getNextTopic(week: number, day: number): { week: number; day: number } | null {
 const w = WEEKLY_TOPICS[week - 1];
 if (!w) return null;
 if (day < w.topics.length) return { week, day: day + 1 };
 if (week < WEEKLY_TOPICS.length) return { week: week + 1, day: 1 };
 return null; // course end
}

/** Returns the previous (week, day) tuple, or null if at course start. */
export function getPrevTopic(week: number, day: number): { week: number; day: number } | null {
 if (day > 1) return { week, day: day - 1 };
 if (week > 1) {
 const prevW = WEEKLY_TOPICS[week - 2];
 return { week: week - 1, day: prevW.topics.length };
 }
 return null; // course start
}

/** True if the given (week, day) is the last topic in the course. */
export function isLastTopicInCourse(week: number, day: number): boolean {
 return getNextTopic(week, day) === null;
}

/** Convert (week, day) + DailyTopic → TopicContext for AI prompts. */
function toTopicContext(week: number, day: number, t: DailyTopic): TopicContext {
 return {
 week,
 day,
 title: t.title,
 objective: t.objective,
 resources: t.resources ?? [],
 phase: getWeekPhase(week),
 };
}

/** Build a single-line context string for AI prompts. */
export function buildTopicContextForAI(
 _userId: string,
 _courseId: string,
 topic: TopicContext,
): string {
 const resources = (topic.resources ?? [])
 .map(r => ` - ${r.label}: ${r.url}`)
 .join("\n");
 return [
 `Course phase: ${topic.phase}`,
 `Today's topic (Week ${topic.week}, Day ${topic.day}): ${topic.title}`,
 `Learning objective: ${topic.objective}`,
 `Suggested self-study resources:`,
 resources || " (none)",
 ].join("\n");
}

// ── DB-backed helpers ─────────────────────────────────────────────

/** Initialize an empty masteryMap if missing. */
function emptyMasteryMap(): MasteryMap {
 return {
 topicProgress: {
 current: { week: 1, day: 1 },
 history: [],
 slidesViewed: 0,
 resourcesShown: false,
 },
 };
}

/** Coerce a Prisma JSON value into a MasteryMap (with defaults). */
function coerceMastery(raw: unknown): MasteryMap {
 if (!raw || typeof raw !== "object") return emptyMasteryMap();
 const obj = raw as Partial<MasteryMap>;
 const tp = obj.topicProgress ?? ({} as MasteryMap["topicProgress"]);
 return {
 topicProgress: {
 current: tp.current ?? { week: 1, day: 1 },
 history: Array.isArray(tp.history) ? tp.history : [],
 slidesViewed: typeof tp.slidesViewed === "number" ? tp.slidesViewed : 0,
 resourcesShown: !!tp.resourcesShown,
 },
 };
}

/**
 * Read (or initialize) today's topic for a user+course.
 * If no `current` topic is set, picks Week 1 Day 1.
 */
export async function getTodayTopic(
 userId: string,
 courseId: string,
): Promise<TodayTopicResult | null> {
 const profile = await db.learnProfile.findUnique({
 where: { userId_courseId: { userId, courseId } },
 });
 if (!profile) return null;

 const mastery = coerceMastery(profile.masteryMap);
 const current = mastery.topicProgress.current ?? { week: 1, day: 1 };
 const topic = getTopicByWeekDay(current.week, current.day);
 if (!topic) return null;

 const slidesViewed = mastery.topicProgress.slidesViewed ?? 0;
 const completed = mastery.topicProgress.history.some(
 h => h.week === current.week && h.day === current.day,
 );

 return {
 topic: toTopicContext(current.week, current.day, topic),
 slidesViewed,
 totalSlides: SLIDES_PER_TOPIC,
 completed,
 resourcesShown: !!mastery.topicProgress.resourcesShown,
 nextTopic: getNextTopic(current.week, current.day),
 prevTopic: getPrevTopic(current.week, current.day),
 isLastTopicInCourse: isLastTopicInCourse(current.week, current.day),
 };
}

/** Increment the slidesViewed counter for the current topic. */
export async function incrementSlideViewed(
 userId: string,
 courseId: string,
): Promise<number> {
 const profile = await db.learnProfile.findUnique({
 where: { userId_courseId: { userId, courseId } },
 });
 if (!profile) return 0;

 const mastery = coerceMastery(profile.masteryMap);
 mastery.topicProgress.slidesViewed = (mastery.topicProgress.slidesViewed ?? 0) + 1;

 await db.learnProfile.update({
 where: { id: profile.id },
 data: { masteryMap: mastery as unknown as Prisma.InputJsonValue },
 });
 return mastery.topicProgress.slidesViewed;
}

/** Mark that resources have been shown for the current topic. */
export async function markResourcesShown(
 userId: string,
 courseId: string,
): Promise<void> {
 const profile = await db.learnProfile.findUnique({
 where: { userId_courseId: { userId, courseId } },
 });
 if (!profile) return;

 const mastery = coerceMastery(profile.masteryMap);
 mastery.topicProgress.resourcesShown = true;

 await db.learnProfile.update({
 where: { id: profile.id },
 data: { masteryMap: mastery as unknown as Prisma.InputJsonValue },
 });
}

/**
 * Complete the current topic, advance to the next, and award XP.
 * If this was the last topic, award course-completion XP (500) and
 * mark the journey as complete. Returns the awarded XP and the next
 * topic (or null if the course is finished).
 */
export async function completeTopicAndAdvance(
 userId: string,
 courseId: string,
): Promise<{ xpAwarded: number; nextTopic: { week: number; day: number } | null; courseCompleted: boolean }> {
 const profile = await db.learnProfile.findUnique({
 where: { userId_courseId: { userId, courseId } },
 });
 if (!profile) {
 return { xpAwarded: 0, nextTopic: null, courseCompleted: false };
 }

 const mastery = coerceMastery(profile.masteryMap);
 const current = mastery.topicProgress.current ?? { week: 1, day: 1 };
 const next = getNextTopic(current.week, current.day);

 // Move current → history
 mastery.topicProgress.history.push({
 week: current.week,
 day: current.day,
 completedAt: new Date().toISOString(),
 });

 // Award XP for completing one topic step (project_step amount = 15).
 let xpAwarded = XP_AMOUNTS.project_step;
 await awardXP({
 userId,
 courseId,
 amount: xpAwarded,
 reason: "project_step",
 referenceId: `topic:${current.week}:${current.day}`,
 });

 let courseCompleted = false;
 if (next) {
 mastery.topicProgress.current = next;
 mastery.topicProgress.slidesViewed = 0;
 mastery.topicProgress.resourcesShown = false;
 } else {
 // Course finished
 courseCompleted = true;
 mastery.topicProgress.current = null;
 xpAwarded += XP_AMOUNTS.course_completion;
 await awardXP({
 userId,
 courseId,
 amount: XP_AMOUNTS.course_completion,
 reason: "course_completion",
 referenceId: `course:${courseId}`,
 });

 // Mark journey plan as complete
 await db.journeyPlan.updateMany({
 where: { userId, courseId, status: "active" },
 data: { status: "completed", currentStep: { increment: 1 } },
 });
 }

 await db.learnProfile.update({
 where: { id: profile.id },
 data: { masteryMap: mastery as unknown as Prisma.InputJsonValue },
 });

 return { xpAwarded, nextTopic: next, courseCompleted };
}

/**
 * Jump to a specific (week, day) topic. Used by the JourneyPanel to
 * let the learner revisit a completed topic or jump ahead. Only allows
 * jumping to topics that are already completed or the current one.
 */
export async function jumpToTopic(
 userId: string,
 courseId: string,
 week: number,
 day: number,
): Promise<boolean> {
 if (!getTopicByWeekDay(week, day)) return false;
 const profile = await db.learnProfile.findUnique({
 where: { userId_courseId: { userId, courseId } },
 });
 if (!profile) return false;

 const mastery = coerceMastery(profile.masteryMap);
 const isCompleted = mastery.topicProgress.history.some(
 h => h.week === week && h.day === day,
 );
 const isCurrent =
 mastery.topicProgress.current?.week === week &&
 mastery.topicProgress.current?.day === day;
 if (!isCompleted && !isCurrent) return false; // locked

 mastery.topicProgress.current = { week, day };
 mastery.topicProgress.slidesViewed = 0;
 mastery.topicProgress.resourcesShown = false;

 await db.learnProfile.update({
 where: { id: profile.id },
 data: { masteryMap: mastery as unknown as Prisma.InputJsonValue },
 });
 return true;
}
