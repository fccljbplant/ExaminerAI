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
import {
 getCourseOutline,
 topicInOutline,
 nextTopicInOutline,
 prevTopicInOutline,
 isLastTopicInOutline,
 type OutlineWeek,
} from "./course-outline";
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
 whyItMatters: t.whyItMatters,
 activity: t.activity,
 deliverable: t.deliverable,
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
 furthest: { week: 1, day: 1 },
 slidesViewed: 0,
 resourcesShown: false,
 },
 };
}

/** True when topic `a` is at or before topic `b` in course order. */
function isAtOrBefore(
 a: { week: number; day: number },
 b: { week: number; day: number },
): boolean {
 return a.week < b.week || (a.week === b.week && a.day <= b.day);
}

/**
 * The furthest topic this learner has reached, derived from:
 *  1. the stored `furthest` marker (written on every advance/jump),
 *  2. the completion history,
 *  3. the per-user XP ledger — every `slide_taught` award references the
 *     slide's id, and the slide's moduleId is its "{week}-{day}" topic.
 *     This recovers pre-marker data: a topic the learner generated
 *     slides for was clearly reached.
 */
async function furthestReached(
 userId: string,
 courseId: string,
 mastery: MasteryMap,
): Promise<{ week: number; day: number }> {
 let furthest =
   mastery.topicProgress.furthest ??
   mastery.topicProgress.current ??
   { week: 1, day: 1 };
 for (const h of mastery.topicProgress.history) {
   if (isAtOrBefore(furthest, h)) furthest = h;
 }
 const slideXp = await db.xPLedger.findMany({
   where: { userId, courseId, reason: "slide_taught" },
   select: { referenceId: true },
 });
 const slideIds = slideXp
   .map((r) => r.referenceId?.replace(/^slide:/, ""))
   .filter((id): id is string => Boolean(id));
 if (slideIds.length > 0) {
   const slides = await db.learnSlide.findMany({
     where: { id: { in: slideIds } },
     select: { moduleId: true },
   });
   for (const s of slides) {
     const m = s.moduleId ? /^(\d+)-(\d+)$/.exec(s.moduleId) : null;
     if (!m) continue;
     const topic = { week: Number(m[1]), day: Number(m[2]) };
     if (isAtOrBefore(furthest, topic)) furthest = topic;
   }
 }
 return furthest;
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
 furthest: tp.furthest ?? tp.current ?? { week: 1, day: 1 },
 slidesViewed: typeof tp.slidesViewed === "number" ? tp.slidesViewed : 0,
 resourcesShown: !!tp.resourcesShown,
 },
 };
}

/**
 * Overlay the course's own curriculum on the generic topic ladder.
 *
 * WEEKLY_TOPICS is a shared 6×5 scaffold (structure + progression).
 * When a course defines its own weeks/days (Course Planner, seeds, AI
 * generation), the learner must be taught THAT course's topics — not
 * the generic ladder (2026-08-15 audit 9.5: an HSE learner was being
 * taught "Building a homepage with WordPress blocks").
 *
 * Known limitation (content-model workstream): progression bounds
 * still follow the ladder; a course whose current (week, day) has no
 * DB row falls back to the generic topic.
 */
async function overlayDbTopic(
 courseId: string,
 week: number,
 day: number,
 base: DailyTopic,
): Promise<{ topic: DailyTopic; phase: string | null }> {
 const row = await db.courseDay.findFirst({
 where: { day, courseWeek: { courseId, weekNumber: week } },
 select: {
 title: true,
 objective: true,
 activity: true,
 deliverable: true,
 courseWeek: { select: { phase: true } },
 },
 });
 if (!row) return { topic: base, phase: null };
 return {
 topic: {
 ...base,
 title: row.title,
 objective: row.objective || base.objective,
 activity: row.activity ?? base.activity,
 deliverable: row.deliverable ?? base.deliverable,
 },
 phase: row.courseWeek.phase || null,
 };
}

/**
 * Read (or initialize) today's topic for a user+course.
 *
 * Progression is bound to the COURSE'S OWN outline (CourseWeek/CourseDay)
 * when it has one — a learner in a 2-week HSE course never spills into
 * the generic 6×5 ladder's unrelated topics (audit 9.5). Courses without
 * outline rows keep the legacy ladder.
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

 const outline = await getCourseOutline(courseId);
 if (outline) {
   return getOutlineTopicResult(current, outline, mastery);
 }

 // ── Legacy ladder fallback (no course outline rows) ─────────────
 const base = getTopicByWeekDay(current.week, current.day);
 if (!base) return null;
 const { topic, phase } = await overlayDbTopic(
 courseId,
 current.week,
 current.day,
 base,
 );

 const slidesViewed = mastery.topicProgress.slidesViewed ?? 0;
 const completed = mastery.topicProgress.history.some(
 h => h.week === current.week && h.day === current.day,
 );

 const ctx = toTopicContext(current.week, current.day, topic);
 if (phase) ctx.phase = phase;

 return {
 topic: ctx,
 slidesViewed,
 totalSlides: SLIDES_PER_TOPIC,
 completed,
 resourcesShown: !!mastery.topicProgress.resourcesShown,
 nextTopic: getNextTopic(current.week, current.day),
 prevTopic: getPrevTopic(current.week, current.day),
 isLastTopicInCourse: isLastTopicInCourse(current.week, current.day),
 };
}

/** Build the TodayTopicResult from the course's own outline. */
function getOutlineTopicResult(
 current: { week: number; day: number },
 outline: OutlineWeek[],
 mastery: MasteryMap,
): TodayTopicResult | null {
 const day = topicInOutline(outline, current.week, current.day);
 if (!day) return null; // past the course's outline → course complete
 const week = outline.find((w) => w.week === current.week);

 const slidesViewed = mastery.topicProgress.slidesViewed ?? 0;
 const completed = mastery.topicProgress.history.some(
   (h) => h.week === current.week && h.day === current.day,
 );

 return {
   topic: {
     week: current.week,
     day: current.day,
     title: day.title,
     objective: day.objective,
     resources: [],
     phase: week?.phase ?? `Week ${current.week}`,
     activity: day.activity ?? undefined,
     deliverable: day.deliverable ?? undefined,
   },
   slidesViewed,
   totalSlides: SLIDES_PER_TOPIC,
   completed,
   resourcesShown: !!mastery.topicProgress.resourcesShown,
   nextTopic: nextTopicInOutline(outline, current.week, current.day),
   prevTopic: prevTopicInOutline(outline, current.week, current.day),
   isLastTopicInCourse: isLastTopicInOutline(outline, current.week, current.day),
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

 // Progression bounds follow the course's own outline when present.
 const outline = await getCourseOutline(courseId);
 const next = outline
   ? nextTopicInOutline(outline, current.week, current.day)
   : getNextTopic(current.week, current.day);

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
 // Track the furthest topic ever reached so a later re-learn jump
 // never locks the topics the learner has already seen.
 const furthest = mastery.topicProgress.furthest ?? current;
 if (isAtOrBefore(furthest, next)) mastery.topicProgress.furthest = next;
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
 * SEQUENCE GUARD for weekly tests (user model 2026-09).
 *
 * Weeks/days are a MANAGEMENT structure — the learner sets the pace and
 * may finish several days' topics in a single day. What is fixed is the
 * ORDER of tests: the weekly test for week W exists only AFTER the
 * learner has REACHED the last day of week W (their current topic is on
 * it, they completed it, or they moved past it). Calendar dates play no
 * role.
 *
 * Returns true when the learner has reached (week, day) — i.e. the topic
 * is at or before their furthest-reached topic. A completed course
 * (current === null) counts as having reached everything.
 */
export async function learnerReachedTopic(
  userId: string,
  courseId: string,
  week: number,
  day: number,
): Promise<boolean> {
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!profile) return false;

  const mastery = coerceMastery(profile.masteryMap);
  if (mastery.topicProgress.current === null) return true; // course complete

  const furthest = await furthestReached(userId, courseId, mastery);
  return isAtOrBefore({ week, day }, furthest);
}

/**
 * Jump to a specific (week, day) topic. Used by the JourneyPanel to
 * let the learner revisit a completed topic or jump ahead. Allows
 * jumping to any topic the learner has already REACHED (completed,
 * current, or at/before the furthest topic ever advanced to) — a
 * re-learn jump must never lock the topics that came after it.
 */
export async function jumpToTopic(
 userId: string,
 courseId: string,
 week: number,
 day: number,
): Promise<boolean> {
 // Bounds check against the course's own outline (or the legacy ladder).
 const outline = await getCourseOutline(courseId);
 const inBounds = outline
   ? topicInOutline(outline, week, day) !== null
   : getTopicByWeekDay(week, day) !== null;
 if (!inBounds) return false;

 const profile = await db.learnProfile.findUnique({
 where: { userId_courseId: { userId, courseId } },
 });
 if (!profile) return false;

 const mastery = coerceMastery(profile.masteryMap);
 const target = { week, day };
 const isCompleted = mastery.topicProgress.history.some(
 h => h.week === week && h.day === day,
 );
 const isCurrent =
 mastery.topicProgress.current?.week === week &&
 mastery.topicProgress.current?.day === day;
 const furthest = await furthestReached(userId, courseId, mastery);
 if (!isCompleted && !isCurrent && !isAtOrBefore(target, furthest)) return false; // locked

 mastery.topicProgress.current = target;
 mastery.topicProgress.slidesViewed = 0;
 mastery.topicProgress.resourcesShown = false;
 if (isAtOrBefore(mastery.topicProgress.furthest ?? target, target)) {
   mastery.topicProgress.furthest = target;
 }

 await db.learnProfile.update({
 where: { id: profile.id },
 data: { masteryMap: mastery as unknown as Prisma.InputJsonValue },
 });
 return true;
}

/** Per-topic status for the picker/journey:
 *  - current: the topic the learner is on now
 *  - completed: in history (re-learnable)
 *  - unlocked: already REACHED (≤ furthest) but not completed — e.g. the
 *    topic they jumped back from to re-learn an earlier one
 *  - locked: never reached yet */
type TopicStatus = "completed" | "current" | "unlocked" | "locked";

function topicStatus(
 current: { week: number; day: number } | null,
 history: { week: number; day: number }[],
 furthest: { week: number; day: number } | null | undefined,
 week: number,
 day: number,
): TopicStatus {
 if (current && current.week === week && current.day === day) return "current";
 if (history.some((h) => h.week === week && h.day === day)) return "completed";
 if (furthest && isAtOrBefore({ week, day }, furthest)) return "unlocked";
 return "locked";
}

/**
 * List every topic in the course (outline-first, ladder fallback) with
 * per-topic status — completed / current / unlocked / locked — for the
 * topic picker and the journey map. Re-learning a completed topic is
 * allowed; jumping to a never-reached one is not.
 */
export async function listCourseTopics(
 userId: string,
 courseId: string,
): Promise<{
 weeks: { week: number; phase: string; days: { day: number; title: string; objective: string; status: TopicStatus }[] }[];
 current: { week: number; day: number } | null;
 courseCompleted: boolean;
} | null> {
 const profile = await db.learnProfile.findUnique({
   where: { userId_courseId: { userId, courseId } },
 });
 if (!profile) return null;

 const mastery = coerceMastery(profile.masteryMap);
 const current = mastery.topicProgress.current;
 const history = mastery.topicProgress.history;
 const furthest = await furthestReached(userId, courseId, mastery);

 const outline = await getCourseOutline(courseId);
 if (outline) {
   return {
     weeks: outline.map((w) => ({
       week: w.week,
       phase: w.phase,
       days: w.days.map((d) => ({
         day: d.day,
         title: d.title,
         objective: d.objective,
         status: topicStatus(current, history, furthest, w.week, d.day),
       })),
     })),
     current,
     courseCompleted: current === null,
   };
 }

 // Ladder fallback.
 return {
   weeks: WEEKLY_TOPICS.map((w) => ({
     week: w.week,
     phase: w.phase,
     days: w.topics.map((t, i) => ({
       day: i + 1,
       title: t.title,
       objective: t.objective,
       status: topicStatus(current, history, furthest, w.week, i + 1),
     })),
   })),
   current,
   courseCompleted: current === null,
 };
}
