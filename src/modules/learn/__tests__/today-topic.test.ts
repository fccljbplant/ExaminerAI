/**
 * Tests for src/modules/learn/lib/today-topic.ts (pure helpers only).
 *
 * These tests exercise the pure functions that don't touch the DB:
 * - SLIDES_PER_TOPIC
 * - getTopicByWeekDay
 * - getNextTopic / getPrevTopic
 * - WEEKLY_TOPICS structure (6 weeks × 5 days = 30 topics)
 *
 * The DB-backed functions (getTodayTopic, completeTopicAndAdvance, etc.)
 * are not unit-tested here because they require a Prisma client. They
 * are exercised by the API integration in /api/learn/* routes.
 */

import { describe, it, expect } from "vitest";
import { WEEKLY_TOPICS } from "@/modules/course/lib/course-topics";
import {
 SLIDES_PER_TOPIC,
 getTopicByWeekDay,
 getNextTopic,
 getPrevTopic,
 isLastTopicInCourse,
} from "@/modules/learn/lib/today-topic";

describe("WEEKLY_TOPICS structure", () => {
 it("has 6 weeks", () => {
 expect(WEEKLY_TOPICS).toHaveLength(6);
 });

 it("has 5 days per week (30 topics total)", () => {
 const total = WEEKLY_TOPICS.reduce((sum, w) => sum + w.topics.length, 0);
 expect(total).toBe(30);
 for (const w of WEEKLY_TOPICS) {
 expect(w.topics).toHaveLength(5);
 }
 });

 it("every topic has title + objective + resources", () => {
 for (const w of WEEKLY_TOPICS) {
 for (const t of w.topics) {
 expect(typeof t.title).toBe("string");
 expect(t.title.length).toBeGreaterThan(0);
 expect(typeof t.objective).toBe("string");
 expect(t.objective.length).toBeGreaterThan(0);
 expect(Array.isArray(t.resources)).toBe(true);
 expect(t.resources.length).toBeGreaterThan(0);
 for (const r of t.resources) {
 expect(typeof r.label).toBe("string");
 expect(typeof r.url).toBe("string");
 expect(r.url.startsWith("http")).toBe(true);
 }
 }
 }
 });

 it("week numbers are 1..6 in order", () => {
 WEEKLY_TOPICS.forEach((w, i) => {
 expect(w.week).toBe(i + 1);
 });
 });
});

describe("SLIDES_PER_TOPIC", () => {
 it("is 4", () => {
 expect(SLIDES_PER_TOPIC).toBe(4);
 });
});

describe("getTopicByWeekDay", () => {
 it("returns the first topic for (1, 1)", () => {
 const t = getTopicByWeekDay(1, 1);
 expect(t).not.toBeNull();
 expect(t!.title).toBe(WEEKLY_TOPICS[0].topics[0].title);
 });

 it("returns the last topic for (6, 5)", () => {
 const t = getTopicByWeekDay(6, 5);
 expect(t).not.toBeNull();
 expect(t!.title).toBe(WEEKLY_TOPICS[5].topics[4].title);
 });

 it("returns null for out-of-range week", () => {
 expect(getTopicByWeekDay(0, 1)).toBeNull();
 expect(getTopicByWeekDay(7, 1)).toBeNull();
 expect(getTopicByWeekDay(99, 1)).toBeNull();
 });

 it("returns null for out-of-range day", () => {
 expect(getTopicByWeekDay(1, 0)).toBeNull();
 expect(getTopicByWeekDay(1, 6)).toBeNull();
 });
});

describe("getNextTopic", () => {
 it("returns {week:1, day:2} for (1, 1)", () => {
 expect(getNextTopic(1, 1)).toEqual({ week: 1, day: 2 });
 });

 it("crosses the week boundary: (1, 5) → (2, 1)", () => {
 expect(getNextTopic(1, 5)).toEqual({ week: 2, day: 1 });
 });

 it("returns null at course end (6, 5)", () => {
 expect(getNextTopic(6, 5)).toBeNull();
 });

 it("returns null for invalid week", () => {
 expect(getNextTopic(7, 1)).toBeNull();
 });
});

describe("getPrevTopic", () => {
 it("returns null at course start (1, 1)", () => {
 expect(getPrevTopic(1, 1)).toBeNull();
 });

 it("crosses the week boundary backward: (2, 1) → (1, 5)", () => {
 expect(getPrevTopic(2, 1)).toEqual({ week: 1, day: 5 });
 });

 it("returns {week:6, day:4} for (6, 5)", () => {
 expect(getPrevTopic(6, 5)).toEqual({ week: 6, day: 4 });
 });
});

describe("isLastTopicInCourse", () => {
 it("is true for (6, 5)", () => {
 expect(isLastTopicInCourse(6, 5)).toBe(true);
 });

 it("is false for (1, 1)", () => {
 expect(isLastTopicInCourse(1, 1)).toBe(false);
 });

 it("is false for (6, 4)", () => {
 expect(isLastTopicInCourse(6, 4)).toBe(false);
 });
});
