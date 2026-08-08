import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { getCourseMetadata, getCourseTopics, getCourseDurationWeeks } from "@/lib/course-db";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import { logger } from "@/lib/logger";

/**
 * GET /api/project/suggestions — AI generates textual project suggestions
 * based on the student's course content.
 *
 * Returns 5 project ideas with:
 *   - name
 *   - type (Web App, Mobile App, Data Pipeline, etc.)
 *   - description (2-3 sentences)
 *   - why (how it connects to the course topics)
 *   - difficulty (beginner / intermediate / advanced)
 *
 * The student picks one or uses them as inspiration for their own project.
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can get project suggestions" }, { status: 403 });
  }

  // Demo AI check
  const isDemoUser = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled." }, { status: 403 });
  }

  // Rate limit
  const category = categoryForFeature("project-summary-gen");
  const limit = await checkUserAILimit(user.id, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
    }, { status: 429 });
  }

  // Fetch course content
  const [courseMeta, courseTopics, totalWeeks] = await Promise.all([
    getCourseMetadata(user.id),
    getCourseTopics(user.id),
    getCourseDurationWeeks(user.id),
  ]);

  if (!courseMeta) {
    return NextResponse.json({
      suggestions: [],
      message: "No course assigned yet. Ask your teacher to assign you to a course.",
    });
  }

  // Build course summary for the AI
  const courseSummary = courseTopics.length > 0
    ? courseTopics.map(w =>
        `Week ${w.week}: ${w.phase}\n${w.topics.map((t, i) => `  Day ${i + 1}: ${t.title}`).join("\n")}`
      ).join("\n\n")
    : courseMeta.description || "A software development bootcamp";

  const systemPrompt = `You are a senior software architect mentoring bootcamp students. Generate 5 practical capstone project ideas based on the course content. Each project should be achievable within ${totalWeeks} weeks for a bootcamp student.

Output JSON ONLY — no markdown. The JSON must be:
{
  "suggestions": [
    {
      "name": "Short project name",
      "type": "Web App | Mobile App | Data Pipeline | API Service | Dashboard | Research Paper",
      "description": "2-3 sentences describing what the project does",
      "why": "1 sentence explaining how it connects to the course topics",
      "difficulty": "beginner | intermediate | advanced",
      "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"]
    }
  ]
}

Rules:
1. Projects should use the skills taught in the course (match the weekly topics).
2. Mix difficulty levels — 2 beginner, 2 intermediate, 1 advanced.
3. Each project should be buildable as a capstone (portfolio-worthy).
4. Names should be specific (not "Todo App" — "Team Task Manager with Real-time Updates").
5. Output in Roman (Latin) script only.`;

  const userPrompt = `Course: ${courseMeta.name}
Domain: ${courseMeta.domain}
Level: ${courseMeta.level}
Duration: ${totalWeeks} weeks

Course outline:
${courseSummary}

Generate 5 project suggestions:`;

  try {
    const result = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      feature: "project-summary-gen",
      temperature: 0.6,
      maxTokens: 1500,
      userId: user.id,
    });

    // Parse JSON
    let parsed: { suggestions: Array<Record<string, unknown>> };
    try {
      const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text || "{}");
    } catch {
      logger.warn("Project suggestions: failed to parse AI JSON", { userId: user.id });
      return NextResponse.json({
        suggestions: [],
        message: "Unable to generate suggestions right now. Try defining your own project.",
      });
    }

    return NextResponse.json({
      suggestions: parsed.suggestions || [],
      courseName: courseMeta.name,
    });
  } catch (err) {
    logger.error("Project suggestions failed", { userId: user.id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      suggestions: [],
      message: "Unable to generate suggestions. Try defining your own project.",
    });
  }
}
