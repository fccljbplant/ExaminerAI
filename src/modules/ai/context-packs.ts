import { db } from "@/lib/db";
import { getOrBuildContextPack } from "./context-cache";
import { estimateTokens, pseudonym } from "./privacy";

/**
 * modules/ai — context-packs.ts (2026-08-15)
 *
 * The anonymized data packs the AI assistants consume — the "desired
 * output" inputs for course outlines, projects, instructors and
 * learners. Every pack is:
 *   • cached per subject in its own namespace (context-cache)
 *   • encrypted at rest
 *   • pseudonym-only — names, emails and addresses never included
 *
 * Pack → namespace map:
 *   course outline  → course-outline:<courseId>
 *   tutor topic     → tutor-topic:<courseId>:<week>:<day>
 *   learner profile → learner:<userId>:<courseId>
 *   cohort summary  → cohort:<instructorId>:<courseId>
 *   project context → project:<userId>:<courseId>
 */

const TTL_COURSE = 6 * 60 * 60 * 1000; // outline changes rarely
const TTL_TUTOR = 60 * 60 * 1000;
const TTL_LEARNER = 10 * 60 * 1000; // progress moves fast
const TTL_COHORT = 10 * 60 * 1000;
const TTL_PROJECT = 30 * 60 * 1000;

export interface CourseOutlinePack {
  id: string;
  name: string;
  domain: string;
  category: string;
  level: string;
  durationWeeks: number;
  skills: string[];
  weeks: {
    week: number;
    phase: string;
    milestone: string;
    days: { day: number; title: string; objective: string }[];
  }[];
}

/** Full course outline — the grounding for tutors, instructors and
 *  generators. Every course teaches its own structure; nothing generic. */
export async function getCourseOutlinePack(courseId: string): Promise<CourseOutlinePack | null> {
  return getOrBuildContextPack<CourseOutlinePack | null>(
    "course-outline",
    courseId,
    TTL_COURSE,
    async () => {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          name: true,
          domain: true,
          category: true,
          level: true,
          durationWeeks: true,
          skillsVerified: true,
          weeks: {
            orderBy: { weekNumber: "asc" },
            select: {
              weekNumber: true,
              phase: true,
              milestone: true,
              days: {
                orderBy: { day: "asc" },
                select: { day: true, title: true, objective: true },
              },
            },
          },
        },
      });
      if (!course) return { data: null, estimatedTokens: 0 };

      let skills: string[] = [];
      try {
        const parsed = JSON.parse(course.skillsVerified || "[]");
        if (Array.isArray(parsed)) skills = parsed.filter((s): s is string => typeof s === "string");
      } catch {
        skills = [];
      }

      const pack: CourseOutlinePack = {
        id: course.id,
        name: course.name,
        domain: course.domain,
        category: course.category,
        level: course.level,
        durationWeeks: course.durationWeeks,
        skills,
        weeks: course.weeks.map((w) => ({
          week: w.weekNumber,
          phase: w.phase,
          milestone: w.milestone,
          days: w.days.map((d) => ({ day: d.day, title: d.title, objective: d.objective })),
        })),
      };
      return { data: pack, estimatedTokens: estimateTokens(JSON.stringify(pack)) };
    },
  );
}

export interface TutorTopicPack {
  courseName: string;
  domain: string;
  week: number;
  day: number;
  phase: string;
  title: string;
  objective: string;
}

/** Today's lesson slice — the per-subject tutor cache. */
export async function getTutorTopicPack(
  courseId: string,
  week: number,
  day: number,
): Promise<TutorTopicPack | null> {
  return getOrBuildContextPack<TutorTopicPack | null>(
    "tutor-topic",
    `${courseId}:${week}:${day}`,
    TTL_TUTOR,
    async () => {
      const row = await db.courseDay.findFirst({
        where: { day, courseWeek: { courseId, weekNumber: week } },
        select: {
          title: true,
          objective: true,
          courseWeek: { select: { phase: true, course: { select: { name: true, domain: true } } } },
        },
      });
      if (!row) return { data: null, estimatedTokens: 0 };
      const pack: TutorTopicPack = {
        courseName: row.courseWeek.course.name,
        domain: row.courseWeek.course.domain,
        week,
        day,
        phase: row.courseWeek.phase,
        title: row.title,
        objective: row.objective,
      };
      return { data: pack, estimatedTokens: estimateTokens(JSON.stringify(pack)) };
    },
  );
}

export interface LearnerPack {
  /** Pseudonym ONLY — never the real name/email. */
  label: string;
  courseId: string;
  current: { week: number; day: number } | null;
  xp: number;
  level: string;
  streak: number;
  weeklyTestScores: { week: number; score: number }[];
  latestScore: number | null;
  weakTopics: string[];
  submissions: { total: number; awaitingReview: number; approved: number };
  project: {
    title: string;
    goal: string | null;
    milestonesDone: number;
    milestonesTotal: number;
  } | null;
}

/** Anonymized learner profile — everything the tutor needs, nothing
 *  that identifies the person. */
export async function getLearnerPack(userId: string, courseId: string): Promise<LearnerPack | null> {
  return getOrBuildContextPack<LearnerPack | null>(
    "learner",
    `${userId}:${courseId}`,
    TTL_LEARNER,
    async () => {
      const profile = await db.learnProfile.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: {
          totalXP: true,
          learnerLevel: true,
          streakCurrent: true,
          masteryMap: true,
        },
      });
      if (!profile) return { data: null, estimatedTokens: 0 };

      const [tests, weakRows, submissions, project] = await Promise.all([
        db.learnWeeklyTest.findMany({
          where: { userId, courseId, status: "completed", score: { not: null } },
          orderBy: { week: "asc" },
          select: { week: true, score: true },
        }),
        db.skillMastery.findMany({
          where: { userId, masteryLevel: { in: ["developing", "not-started"] } },
          orderBy: { trend: "desc" },
          take: 4,
          select: { topic: true },
        }),
        db.submission.groupBy({
          by: ["status"],
          where: { userId, assignment: { courseId } },
          _count: { _all: true },
        }),
        db.learnProject.findFirst({
          where: { userId, courseId },
          select: {
            title: true,
            goal: true,
            milestones: { select: { status: true } },
          },
        }),
      ]);

      const current = (() => {
        const m = profile.masteryMap as
          | { topicProgress?: { current?: { week?: number; day?: number } | null } }
          | null;
        const c = m?.topicProgress?.current;
        return c?.week ? { week: c.week, day: c.day ?? 1 } : null;
      })();

      const statusCount = (s: string) =>
        submissions.find((x) => x.status === s)?._count._all ?? 0;

      const pack: LearnerPack = {
        label: pseudonym(userId),
        courseId,
        current,
        xp: profile.totalXP,
        level: profile.learnerLevel,
        streak: profile.streakCurrent,
        weeklyTestScores: tests.map((t) => ({ week: t.week, score: t.score as number })),
        latestScore: tests.length ? (tests[tests.length - 1].score as number) : null,
        weakTopics: weakRows.map((w) => w.topic),
        submissions: {
          total: submissions.reduce((sum, s) => sum + s._count._all, 0),
          awaitingReview: statusCount("in_review") + statusCount("resubmitted"),
          approved: statusCount("approved") + statusCount("signed_off"),
        },
        project: project
          ? {
              title: project.title,
              goal: project.goal,
              milestonesDone: project.milestones.filter((m) => m.status === "completed").length,
              milestonesTotal: project.milestones.length,
            }
          : null,
      };
      return { data: pack, estimatedTokens: estimateTokens(JSON.stringify(pack)) };
    },
  );
}

export interface CohortPack {
  courseId: string;
  courseName: string;
  students: {
    label: string;
    week: number;
    latestScore: number | null;
    streak: number;
    risk: "at-risk" | "inactive" | "new" | "steady";
  }[];
}

/** Anonymized class summary for an instructor's assistant — who is
 *  struggling, who is inactive, who is new. Names stay behind. */
export async function getCohortPack(
  instructorId: string,
  courseId: string,
): Promise<CohortPack | null> {
  return getOrBuildContextPack<CohortPack | null>(
    "cohort",
    `${instructorId}:${courseId}`,
    TTL_COHORT,
    async () => {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { name: true },
      });
      if (!course) return { data: null, estimatedTokens: 0 };

      const profiles = await db.learnProfile.findMany({
        where: { courseId },
        select: {
          userId: true,
          totalXP: true,
          streakCurrent: true,
          lastActivityDate: true,
          masteryMap: true,
        },
      });
      // Latest completed weekly-test score per student (LearnProfile has
      // no direct relation — resolved in one query, not per student).
      const latestTests = await db.learnWeeklyTest.findMany({
        where: { courseId, status: "completed", score: { not: null } },
        orderBy: { week: "desc" },
        select: { userId: true, score: true },
      });
      const latestByUser = new Map<string, number>();
      for (const t of latestTests) {
        if (!latestByUser.has(t.userId)) latestByUser.set(t.userId, t.score as number);
      }

      const now = Date.now();
      const students = profiles.map((p) => {
        const m = p.masteryMap as
          | { topicProgress?: { current?: { week?: number } | null } }
          | null;
        const week = m?.topicProgress?.current?.week ?? 1;
        const latestScore = latestByUser.get(p.userId) ?? null;
        const inactiveDays = p.lastActivityDate
          ? Math.floor((now - p.lastActivityDate.getTime()) / 86_400_000)
          : null;
        const risk: CohortPack["students"][number]["risk"] =
          inactiveDays === null || inactiveDays >= 6
            ? "inactive"
            : inactiveDays >= 3
              ? "at-risk"
              : p.totalXP < 120
                ? "new"
                : "steady";
        return {
          label: pseudonym(p.userId),
          week,
          latestScore,
          streak: p.streakCurrent,
          risk,
        };
      });

      const pack: CohortPack = {
        courseId,
        courseName: course.name,
        students,
      };
      return { data: pack, estimatedTokens: estimateTokens(JSON.stringify(pack)) };
    },
  );
}

export interface ProjectPack {
  label: string;
  title: string;
  goal: string | null;
  currentState: string | null;
  deadline: string | null;
  milestones: { title: string; status: string }[];
}

/** Anonymized project context — helps the tutor coach the work, not the person. */
export async function getProjectPack(userId: string, courseId: string): Promise<ProjectPack | null> {
  return getOrBuildContextPack<ProjectPack | null>(
    "project",
    `${userId}:${courseId}`,
    TTL_PROJECT,
    async () => {
      const project = await db.learnProject.findFirst({
        where: { userId, courseId },
        select: {
          title: true,
          goal: true,
          currentState: true,
          deadline: true,
          milestones: { orderBy: { order: "asc" }, select: { title: true, status: true } },
        },
      });
      if (!project) return { data: null, estimatedTokens: 0 };
      const pack: ProjectPack = {
        label: pseudonym(userId),
        title: project.title,
        goal: project.goal,
        currentState: project.currentState,
        deadline: project.deadline?.toISOString() ?? null,
        milestones: project.milestones.map((m) => ({ title: m.title, status: m.status })),
      };
      return { data: pack, estimatedTokens: estimateTokens(JSON.stringify(pack)) };
    },
  );
}

/** Assemble the tutor's student-context blocks from the per-subject
 *  packs (cached + anonymized). Same output shape as the legacy
 *  tutorContextBlocks, but every read goes through the namespace caches
 *  so the admin panel can show per-subject hit/miss. */
export async function buildTutorBlocksFromPacks(
  userId: string,
  courseId: string,
  topic: { week: number; day: number } | null | undefined,
): Promise<string> {
  const [topicPack, learner, project] = await Promise.all([
    topic ? getTutorTopicPack(courseId, topic.week, topic.day) : Promise.resolve(null),
    getLearnerPack(userId, courseId),
    getProjectPack(userId, courseId),
  ]);

  const lines: string[] = [];
  if (topicPack) {
    lines.push(
      `COURSE: ${topicPack.courseName} (domain: ${topicPack.domain})`,
      `CURRENT LESSON: Week ${topicPack.week}, Day ${topicPack.day} — ${topicPack.title}. Objective: ${topicPack.objective}`,
    );
  }
  if (learner) {
    lines.push(
      `STUDENT: ${learner.label}`,
      `STUDENT DATA: ${learner.xp} XP · level ${learner.level} · ${learner.streak}-day streak` +
        (learner.latestScore != null ? ` · latest weekly test ${learner.latestScore}%` : ""),
    );
    if (learner.weeklyTestScores.length) {
      lines.push(
        `WEEKLY TEST HISTORY: ${learner.weeklyTestScores.map((t) => `W${t.week}=${t.score}`).join(", ")}`,
      );
    }
    if (learner.weakTopics.length) {
      lines.push(`WEAK TOPICS (review these first): ${learner.weakTopics.join(", ")}`);
    }
    if (learner.submissions.total > 0) {
      lines.push(
        `SUBMISSIONS: ${learner.submissions.total} total · ${learner.submissions.awaitingReview} awaiting review · ${learner.submissions.approved} approved`,
      );
    }
  }
  if (project) {
    lines.push(
      `PROJECT: ${project.title}${project.goal ? ` — goal: ${project.goal}` : ""}` +
        (project.currentState ? ` · state: ${project.currentState}` : "") +
        ` · milestones: ${project.milestones.map((m) => `${m.title} (${m.status})`).join(", ")}` +
        (project.deadline ? ` · deadline: ${project.deadline}` : ""),
    );
  } else if (learner) {
    lines.push("PROJECT: none yet — help the student pick one based on the course.");
  }
  return lines.join("\n");
}
