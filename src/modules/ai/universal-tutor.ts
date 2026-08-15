import {
  getCourseOutlinePack,
  getTutorTopicPack,
  getLearnerPack,
  getProjectPack,
} from "./context-packs";

/**
 * modules/ai — universal-tutor.ts (2026-08-15)
 *
 * The domain-agnostic tutor prompt used by every tutor surface. Two
 * cache-friendly pieces:
 *
 *  1. `universalTutorSystemPrompt()` — STATIC. Identical for every call
 *     (no student data, no timestamps), so the provider's automatic
 *     prefix cache covers it across the entire platform.
 *
 *  2. `buildTutorContextMessage()` — the COURSE OUTLINE / CURRENT TOPIC /
 *     STUDENT PROJECT / STUDENT DATA block, assembled from the
 *     per-subject context packs (cached, encrypted, anonymized). It is
 *     stable within a lesson day, so system + context form one long
 *     cacheable prefix; only the final "Student asks: …" message varies.
 *
 * The prompt itself handles replies — no marker scraping or
 * post-processing middleware.
 */

export function universalTutorSystemPrompt(opts: { surface?: string } = {}): string {
  return `You are a friendly, practical, universal AI Tutor on TraineesAI — a training platform that teaches ANY subject (finance, mobile repair, cooking, history, coding, safety, and beyond).
${opts.surface ? `The learner is asking from: ${opts.surface}\n` : ""}
--- TEACHING RULES ---

1. Project-centric focus: every concept connects back to the learner's STUDENT PROJECT. If they talk about unrelated things, gently pivot back to how it applies to their project.

2. The Week X rule: if the learner asks about a topic that comes LATER in the COURSE OUTLINE: explain the core idea in 1-2 simple sentences, clearly state "You will learn this in full detail during Week [X] of your course.", offer ONE reputable external link (Wikipedia, official guides, trusted educational sites), then immediately pivot back and ask a question tied to the CURRENT TOPIC and their STUDENT PROJECT.

3. Teaching method — Concept First, Then Implementation. For every new concept follow these 3 steps: Step 1 Analogy (a simple real-life comparison); Step 2 Generic Example (a simple, unrelated example of the pure idea); Step 3 Project Mapping (exactly how this applies to THEIR project).

4. Roman English rule: if the learner asks in English, reply in clear simple English (short sentences, everyday words). If they ask in ANY other language (Urdu, Hindi, Spanish, French, Arabic, etc.), reply in ROMAN ENGLISH (Latin A-Z script only). Never use non-Latin scripts like Devanagari, Arabic, or Chinese characters.

5. Chat format: 3-8 sentences per reply — this is a chat, not a lecture. Plain text only: no emojis, no markdown, no bullet characters, no headings. You are TEXT-ONLY: you cannot open files, images, audio or video — if asked to read media, say plainly that you work with text and ask the learner to describe or paste it. Never fabricate content you cannot see.

6. Use the STUDENT DATA to personalize: reference the current lesson, encourage from their scores, and point at weak topics when they ask what to review. Coach their project from the PROJECT block — if they have none yet, help them choose one aligned with the course domain and break it into milestone-sized first steps. Never guilt the learner about absence or pace.

7. Coherence Progress Check: at the end of EVERY response add a section titled "[Coherence Check]". In it: tell the learner if they are On Track (Green), Slightly Ahead (Yellow), or Off-Track (Red) against the COURSE OUTLINE, then briefly list: "Mastered so far: [Topic A], [Topic B]. Next up: [Topic C]."`;
}

/** The cacheable context block — assembled from the per-subject packs.
 *  Stable within a lesson day; only the question message varies after it. */
export async function buildTutorContextMessage(opts: {
  userId: string;
  courseId: string | null;
  topic: { week: number; day: number } | null | undefined;
  studyFlow?: string;
}): Promise<string> {
  const blocks: string[] = [];

  if (opts.courseId) {
    const [outline, topicPack, learner, project] = await Promise.all([
      getCourseOutlinePack(opts.courseId),
      opts.topic
        ? getTutorTopicPack(opts.courseId, opts.topic.week, opts.topic.day)
        : Promise.resolve(null),
      getLearnerPack(opts.userId, opts.courseId),
      getProjectPack(opts.userId, opts.courseId),
    ]);

    if (outline) {
      blocks.push(
        "COURSE OUTLINE:\n" +
          outline.weeks
            .map(
              (w) =>
                `Week ${w.week} — ${w.phase}: ${w.days.map((d) => d.title).join(" | ")}` +
                (w.milestone ? ` · milestone: ${w.milestone}` : ""),
            )
            .join("\n"),
      );
    }
    if (topicPack) {
      blocks.push(
        `CURRENT TOPIC: Week ${topicPack.week}, Day ${topicPack.day} — ${topicPack.title}. Objective: ${topicPack.objective}`,
      );
    }
    if (project) {
      blocks.push(
        `STUDENT PROJECT: ${project.title}${project.goal ? ` — goal: ${project.goal}` : ""}` +
          (project.currentState ? ` · state: ${project.currentState}` : "") +
          ` · milestones: ${project.milestones
            .map((m) => `${m.title} (${m.status})`)
            .join(", ")}` +
          (project.deadline ? ` · deadline: ${project.deadline}` : ""),
      );
    } else {
      blocks.push(
        "STUDENT PROJECT: none yet — help the learner choose one aligned with the course domain.",
      );
    }
    if (learner) {
      blocks.push(
        `STUDENT DATA: ${learner.label} · ${learner.xp} XP · level ${learner.level} · ${learner.streak}-day streak` +
          (learner.weeklyTestScores.length
            ? ` · weekly tests: ${learner.weeklyTestScores.map((t) => `W${t.week}=${t.score}`).join(", ")}`
            : "") +
          (learner.weakTopics.length
            ? ` · weak topics: ${learner.weakTopics.join(", ")}`
            : "") +
          (learner.submissions.total > 0
            ? ` · submissions: ${learner.submissions.total} (${learner.submissions.approved} approved, ${learner.submissions.awaitingReview} in review)`
            : ""),
      );
    }
  } else {
    blocks.push(
      "The learner is not enrolled in a course yet — help them explore the catalog and pick one.",
    );
  }

  if (opts.studyFlow) blocks.push(opts.studyFlow);
  return blocks.join("\n\n");
}

/** The stable prefix for each learner question (keeps the per-turn user
 *  messages cache-friendly as well — identical within a lesson day). */
export function tutorQuestionPrefix(
  topicTitle: string | null | undefined,
  projectTitle: string | null | undefined,
): string {
  return `Context: ${topicTitle ?? "no active topic"}. Project: ${projectTitle ?? "none yet"}. Student asks: `;
}
