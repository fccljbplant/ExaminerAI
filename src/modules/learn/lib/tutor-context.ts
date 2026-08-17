/**
 * modules/learn/lib/tutor-context.ts — W15: student context for the tutors
 *
 * One shared builder so every tutor surface (classroom chat, floating
 * tutor) knows the same things about the learner:
 *   - today's topic (week/day/title/objective)
 *   - scores & data (XP, level, streak, weekly-test history, weak topics)
 *   - the student's project (title/goal/stack/milestones) — or nothing,
 *     in which case the tutor is prompted to help pick one
 *
 * Every lookup is independently guarded — a missing profile, empty
 * project or DB hiccup degrades to null and must NEVER break the tutor.
 */

import { db } from "@/lib/db";
import { getTodayTopic } from "./today-topic";

export interface TutorScores {
  xp: number;
  level: string;
  streak: number;
  weeklyTests: { week: number; score: number | null; status: string }[];
  latestScore: number | null;
  avgScore: number | null;
  weakTopics: string[];
}

export interface TutorProject {
  title: string;
  goal: string | null;
  stack: string | null;
  currentState: string | null;
  deadline: string | null;
  activeMilestone: string | null;
  nextMilestones: string[];
  progress: { done: number; total: number };
}

export interface TutorStudentContext {
  courseId: string | null;
  courseName: string | null;
  courseDomain: string | null;
  topic: { week: number; day: number; title: string; objective: string } | null;
  scores: TutorScores;
  project: TutorProject | null;
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Loads the learner's course profile; null when there is no enrollment.
 *  When courseId is given the profile is scoped to THAT course — the
 *  tutor must know which course the student is in (2026-08-18 audit).
 *  Without courseId (legacy callers) the most-recently-updated profile
 *  is used as the fallback. */
async function loadProfile(userId: string, courseId?: string | null) {
  const profiles = await db.learnProfile.findMany({
    where: courseId ? { userId, courseId } : { userId },
    include: { course: { select: { name: true, domain: true, level: true } } },
    orderBy: { updatedAt: "desc" },
    take: 1,
  });
  return profiles[0] ?? null;
}

export async function getTutorStudentContext(userId: string, courseId?: string | null): Promise<TutorStudentContext> {
  const profile = await loadProfile(userId, courseId).catch(() => null);

  if (!profile) {
    return {
      courseId: null,
      courseName: null,
      courseDomain: null,
      topic: null,
      scores: {
        xp: 0,
        level: "Rookie",
        streak: 0,
        weeklyTests: [],
        latestScore: null,
        avgScore: null,
        weakTopics: [],
      },
      project: null,
    };
  }

  const [today, weeklyTests, project] = await Promise.all([
    getTodayTopic(userId, profile.courseId).catch(() => null),
    db.weeklyTest
      .findMany({
        where: { userId },
        orderBy: { week: "asc" },
        select: { week: true, score: true, status: true, weaknesses: true },
      })
      .catch(() => []),
    db.learnProject
      .findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: { milestones: { orderBy: { order: "asc" } } },
      })
      .catch(() => null),
  ]);

  const completed = weeklyTests.filter((t) => t.score != null);
  const latestScore = completed.length ? (completed[completed.length - 1].score ?? null) : null;
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, t) => s + (t.score ?? 0), 0) / completed.length)
    : null;

  // Weak topics: stored per-test weaknesses first, then the 3 most recent.
  const weakTopics: string[] = [];
  for (const t of [...weeklyTests].reverse()) {
    for (const w of parseList(t.weaknesses)) {
      if (weakTopics.length >= 5) break;
      if (!weakTopics.includes(w)) weakTopics.push(w);
    }
  }

  const activeMilestone = project?.milestones.find((m) => m.status !== "completed") ?? null;
  const nextMilestones = (project?.milestones ?? [])
    .filter((m) => m.status !== "completed")
    .slice(0, 3)
    .map((m) => m.title);

  return {
    courseId: profile.courseId,
    courseName: profile.course.name,
    courseDomain: profile.course.domain,
    topic:
      today && !today.completed
        ? {
            week: today.topic.week,
            day: today.topic.day,
            title: today.topic.title,
            objective: today.topic.objective,
          }
        : null,
    scores: {
      xp: profile.totalXP,
      level: profile.learnerLevel,
      streak: profile.streakCurrent,
      weeklyTests: completed.map((t) => ({ week: t.week, score: t.score, status: t.status })),
      latestScore,
      avgScore,
      weakTopics,
    },
    project: project
      ? {
          title: project.title,
          goal: project.goal,
          stack: project.stack,
          currentState: project.currentState,
          deadline: project.deadline?.toISOString() ?? null,
          activeMilestone: activeMilestone?.title ?? null,
          nextMilestones,
          progress: {
            done: project.milestones.filter((m) => m.status === "completed").length,
            total: project.milestones.length,
          },
        }
      : null,
  };
}

/** Renders the context as compact prompt blocks (shared formatting). */
export function tutorContextBlocks(ctx: TutorStudentContext): string {
  const lines: string[] = [];

  if (ctx.courseName) {
    lines.push(
      `COURSE: ${ctx.courseName}${ctx.courseDomain ? ` (domain: ${ctx.courseDomain})` : ""}`,
    );
    if (ctx.topic) {
      lines.push(
        `CURRENT LESSON: Week ${ctx.topic.week}, Day ${ctx.topic.day} — ${ctx.topic.title}. Objective: ${ctx.topic.objective}`,
      );
    } else {
      lines.push("The learner is between lessons.");
    }
  }

  const s = ctx.scores;
  lines.push(
    `STUDENT DATA: ${s.xp} XP · level ${s.level} · ${s.streak}-day streak` +
      (s.latestScore != null ? ` · latest weekly test ${s.latestScore}%` : "") +
      (s.avgScore != null ? ` · average ${s.avgScore}%` : ""),
  );
  if (s.weeklyTests.length) {
    lines.push(
      `WEEKLY TEST HISTORY: ${s.weeklyTests
        .map((t) => `W${t.week}=${t.score ?? "—"}`)
        .join(", ")}`,
    );
  }
  if (s.weakTopics.length) {
    lines.push(`WEAK TOPICS (review these first): ${s.weakTopics.join(", ")}`);
  }

  if (ctx.project) {
    const p = ctx.project;
    lines.push(
      `STUDENT PROJECT: ${p.title}${p.goal ? ` — goal: ${p.goal}` : ""}${
        p.stack ? ` · stack: ${p.stack}` : ""
      }${p.activeMilestone ? ` · active milestone: ${p.activeMilestone}` : ""} · milestones ${p.progress.done}/${p.progress.total}`,
    );
    if (p.nextMilestones.length) {
      lines.push(`UPCOMING PROJECT MILESTONES: ${p.nextMilestones.join(" → ")}`);
    }
    if (p.currentState) lines.push(`PROJECT CURRENT STATE: ${p.currentState}`);
    if (p.deadline) lines.push(`PROJECT DEADLINE: ${p.deadline.slice(0, 10)}`);
  } else {
    lines.push(
      "STUDENT PROJECT: none yet — if the student asks about a project, help them choose one aligned with the course domain, and suggest concrete milestone-sized first steps.",
    );
  }

  return lines.join("\n");
}
