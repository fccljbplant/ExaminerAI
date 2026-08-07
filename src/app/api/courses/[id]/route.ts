import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getAuthUser } from "@/lib/auth";
import { validateCourseWeeks } from "@/lib/course-validation";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/courses/[id] — get a course with all weeks + days. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: { days: { orderBy: { day: "asc" } } },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Parse ALL JSON fields
  const parseJSON = (str: string | null, fallback: unknown = null) => {
    try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
  };

  const courseWithParsed = {
    ...course,
    toolsUsed: parseJSON(course.toolsUsed, []),
    deliverableTypes: parseJSON(course.deliverableTypes, []),
    assessmentConfig: parseJSON(course.assessmentConfigJson),
    weeks: course.weeks.map((w) => ({
      ...w,
      days: w.days.map((d) => ({
        ...d,
        resources: parseJSON(d.resources, []),
        topicsCovered: parseJSON(d.topicsCovered, []),
        // Phase 3: SlideViewer fields — video slide, code examples, web images
        videoUrl: d.videoUrl,
        videoTitle: d.videoTitle,
        codeExamples: parseJSON(d.codeExamples, []),
        webImages: parseJSON(d.webImages, []),
      })),
    })),
    journeySteps: parseJSON(course.journeyStepsJson),
    projectTemplate: parseJSON(course.projectTemplateJson),
    aiPrompts: parseJSON(course.aiPromptsJson),
    testConfig: parseJSON(course.testConfigJson),
    reportCardTemplate: parseJSON(course.reportCardTemplateJson),
    // Project config (plain booleans/int — already on the Course row, no JSON parsing needed)
    projectEnabled: course.projectEnabled,
    projectRequired: course.projectRequired,
    projectDefaultDurationWeeks: course.projectDefaultDurationWeeks,
    // Default-course flag — marks this course as the default for new students
    isDefault: course.isDefault,
  };

  return NextResponse.json({ course: courseWithParsed });
}

/** PUT /api/courses/[id] — update course name/description AND replace all weeks/days.
 *  Body: { name?, description?, weeks: [{ weekNumber, phase, milestone?, days: [{ day, title, objective?, resources? }] }] }
 *  This is a FULL REPLACE: all existing weeks/days are deleted and recreated. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("editing courses"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, description, weeks, journeySteps, projectTemplate, aiPrompts, testConfig, reportCardTemplate, domain, level, toolsUsed, deliverableTypes, assessmentType, assessmentConfig, subjects, projectEnabled, projectRequired, projectDefaultDurationWeeks, published, featured, price, category, subtitle, instructorName, instructorBio, whatYouWillLearn, prerequisites, skillsVerified, thumbnailUrl, durationWeeks } = body as {
    name?: string;
    description?: string;
    weeks?: { weekNumber: number; phase: string; milestone?: string; days: {
      day: number;
      title: string;
      objective?: string;
      whyItMatters?: string;
      topicsCovered?: string[];
      activity?: string;
      deliverable?: string;
      resources?: { label: string; url: string }[];
      // Phase 3: SlideViewer fields (optional, type-cast)
      videoUrl?: string | null;
      videoTitle?: string | null;
      codeExamples?: { filename: string; language: string; code: string; explanation: string }[];
      webImages?: { url: string; caption: string; source: string }[];
    }[] }[];
    journeySteps?: unknown;
    projectTemplate?: unknown;
    aiPrompts?: unknown;
    testConfig?: unknown;
    reportCardTemplate?: unknown;
    domain?: string;
    level?: string;
    toolsUsed?: string[];
    deliverableTypes?: string[];
    assessmentType?: string;
    assessmentConfig?: unknown;
    subjects?: string[];
    projectEnabled?: boolean;
    projectRequired?: boolean;
    projectDefaultDurationWeeks?: number;
    // Phase 6 — marketplace fields. All optional; only updated when provided.
    published?: boolean;
    featured?: boolean;
    price?: number;
    category?: string;
    subtitle?: string | null;
    instructorName?: string | null;
    instructorBio?: string | null;
    whatYouWillLearn?: string[];
    prerequisites?: string[];
    skillsVerified?: string[];
    thumbnailUrl?: string | null;
    durationWeeks?: number;
  };

  // Verify course exists
  const existing = await db.course.findUnique({
    where: { id },
    include: { weeks: { select: { weekNumber: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Validate weeks/days structure if weeks are being replaced
  if (weeks !== undefined) {
    const v = validateCourseWeeks(weeks);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
  }

  // Project config validation:
  // - projectEnabled can only be true if the course has >= 4 weeks.
  //   Use the NEW weeks array if provided, otherwise the existing week count.
  // - projectDefaultDurationWeeks must be 2..(weekCount-1) when set.
  const effectiveWeekCount = weeks?.length ?? existing.weeks.length;
  if (projectEnabled === true && effectiveWeekCount < 4) {
    return NextResponse.json(
      { error: `Projects cannot be enabled for courses shorter than 4 weeks (this course has ${effectiveWeekCount} week${effectiveWeekCount === 1 ? "" : "s"}).` },
      { status: 400 }
    );
  }
  // Auto-disable projectRequired when projectEnabled is being turned off
  const finalProjectEnabled = projectEnabled === true;
  const finalProjectRequired = finalProjectEnabled && projectRequired === true;
  const finalProjectDuration = (() => {
    if (projectDefaultDurationWeeks === undefined) return undefined;
    const w = Number(projectDefaultDurationWeeks);
    if (!Number.isInteger(w)) return 4;
    const maxAllowed = Math.max(2, effectiveWeekCount - 1);
    return Math.min(Math.max(w, 2), maxAllowed);
  })();

  // Build config + domain update data — only update fields that are provided
  const configData: Record<string, string | null> = {};
  if (journeySteps !== undefined) configData.journeyStepsJson = journeySteps ? JSON.stringify(journeySteps) : null;
  if (projectTemplate !== undefined) configData.projectTemplateJson = projectTemplate ? JSON.stringify(projectTemplate) : null;
  if (aiPrompts !== undefined) configData.aiPromptsJson = aiPrompts ? JSON.stringify(aiPrompts) : null;
  if (testConfig !== undefined) configData.testConfigJson = testConfig ? JSON.stringify(testConfig) : null;
  if (reportCardTemplate !== undefined) configData.reportCardTemplateJson = reportCardTemplate ? JSON.stringify(reportCardTemplate) : null;
  if (assessmentConfig !== undefined) configData.assessmentConfigJson = assessmentConfig ? JSON.stringify(assessmentConfig) : null;
  if (toolsUsed !== undefined) configData.toolsUsed = JSON.stringify(toolsUsed || []);
  if (deliverableTypes !== undefined) configData.deliverableTypes = JSON.stringify(deliverableTypes || []);

  // Transaction: delete old weeks/days, update course + config, create new weeks/days
  try {
    await db.$transaction(async (tx) => {
    // Delete all existing weeks (cascade deletes days) — only if weeks are provided
    if (weeks !== undefined) {
      await tx.courseWeek.deleteMany({ where: { courseId: id } });
    }

    // Update course metadata + config + domain fields
    await tx.course.update({
      where: { id },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(domain !== undefined ? { domain } : {}),
        ...(level !== undefined ? { level } : {}),
        ...(assessmentType !== undefined ? { assessmentType } : {}),
        // Scale Tier 2: subjects updatable
        ...(subjects !== undefined ? { subjects: JSON.stringify(subjects || []) } : {}),
        // Project config — validated above
        ...(projectEnabled !== undefined ? { projectEnabled: finalProjectEnabled } : {}),
        ...(projectRequired !== undefined ? { projectRequired: finalProjectRequired } : {}),
        ...(finalProjectDuration !== undefined ? { projectDefaultDurationWeeks: finalProjectDuration } : {}),
        // Phase 6 — marketplace fields. Only updated when explicitly provided
        // so legacy callers (which don't send these fields) don't accidentally
        // clobber marketplace metadata.
        ...(published !== undefined ? { published } : {}),
        ...(featured !== undefined ? { featured } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(subtitle !== undefined ? { subtitle: subtitle ?? null } : {}),
        ...(instructorName !== undefined ? { instructorName: instructorName ?? null } : {}),
        ...(instructorBio !== undefined ? { instructorBio: instructorBio ?? null } : {}),
        ...(whatYouWillLearn !== undefined ? { whatYouWillLearn: JSON.stringify(whatYouWillLearn || []) } : {}),
        ...(prerequisites !== undefined ? { prerequisites: JSON.stringify(prerequisites || []) } : {}),
        ...(skillsVerified !== undefined ? { skillsVerified: JSON.stringify(skillsVerified || []) } : {}),
        ...(thumbnailUrl !== undefined ? { thumbnailUrl: thumbnailUrl ?? null } : {}),
        ...(durationWeeks !== undefined ? { durationWeeks } : {}),
        ...configData,
      },
    });

    // Create new weeks + days (only if weeks were provided)
    if (weeks?.length) {
      for (const w of weeks) {
        const createdWeek = await tx.courseWeek.create({
          data: {
            courseId: id,
            weekNumber: w.weekNumber,
            phase: w.phase,
            milestone: w.milestone || "",
          },
        });
        if (w.days?.length) {
          await tx.courseDay.createMany({
            data: w.days.map((d) => ({
              courseWeekId: createdWeek.id,
              day: d.day,
              title: d.title,
              objective: d.objective || "",
              whyItMatters: d.whyItMatters || "",
              topicsCovered: JSON.stringify(d.topicsCovered || []),
              activity: d.activity || "",
              deliverable: d.deliverable || "",
              resources: JSON.stringify(d.resources || []),
              // Phase 3: SlideViewer fields — persist video/code/images for the new slide-based viewer
              videoUrl: d.videoUrl || null,
              videoTitle: d.videoTitle || null,
              codeExamples: JSON.stringify(d.codeExamples || []),
              webImages: JSON.stringify(d.webImages || []),
            })),
          });
        }
      }
    }
  });

  } catch (err) {
    logger.error("Failed to update course", { id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }

  // Return updated course
  const updated = await db.course.findUnique({
    where: { id },
    include: {
      weeks: { orderBy: { weekNumber: "asc" }, include: { days: { orderBy: { day: "asc" } } } },
    },
  });

  // L15-fix: handle null (course deleted between transaction and re-fetch)
  if (!updated) {
    return NextResponse.json({ error: "Course not found after update" }, { status: 404 });
  }

  return NextResponse.json({ course: updated });
}

/** DELETE /api/courses/[id] — delete a course (cascade deletes weeks + days).
 *
 *  By default, REFUSES to delete if any students are still enrolled in the
 *  course — this protects students from losing their curriculum.
 *
 *  Pass `?force=true` to override. Use with caution.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("editing courses"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Permission: only ADMIN_ROLES (principal, administrator) can delete a course.
  // No other role — including coordinator, counselor, teacher,
  // may delete a course. Course deletion is a high-impact admin action that
  // can wipe curriculum for an entire course mid-bootcamp.
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Only administrators can delete a course" }, { status: 403 });
  }

  // Verify the course exists (avoid silent 200 on already-deleted)
  const existing = await db.course.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Check for students currently enrolled in this course
  const enrolledStudents = await db.courseEnrollment.count({
    where: { courseId: id, role: "student" },
  });

  const force = new URL(req.url).searchParams.get("force") === "true";

  if (enrolledStudents > 0 && !force) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${enrolledStudents} student(s) are still enrolled in this course. Unenroll them first, or pass ?force=true to delete anyway.`,
        enrolledStudents,
      },
      { status: 409 }
    );
  }

  try {
    await db.course.delete({ where: { id } });
  } catch (err) {
    logger.error("Failed to delete course", { id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete course — it may still have dependent records" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
