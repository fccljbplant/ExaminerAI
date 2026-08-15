/**
 * scripts/seed-portal-demo.ts — W1 learner-portal demo data (REDESIGN-P5)
 *
 * Idempotent seed for the v2 learner portal:
 *  - demo seats matching the login form (learner/instructor/org_admin @demo.ai)
 *  - 3 domain-neutral published courses + 1 default course, weeks & days
 *  - learner enrollment with progress, streak, XP ledger, badges,
 *    daily/weekly tests, notifications and a certificate
 *
 * Run: node scripts/seed-portal-demo.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile();
} catch {
  /* env may already be loaded */
}

const db = new PrismaClient();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function upsertUser(email: string, name: string, role: string, passwordHash: string) {
  // Always reset the password too (same contract as ensure-accounts.js):
  // demo seats must be reachable with demo123 no matter how the row
  // drifted (audit 9.7 — orgadmin@demo.ai had an unknown password).
  return db.user.upsert({
    where: { email },
    update: { name, passwordHash, role, status: "active" },
    create: {
      email,
      name,
      passwordHash,
      role,
      status: "active",
      approvedAt: new Date(),
    },
  });
}

async function ensureCourse(
  name: string,
  data: Omit<Prisma.CourseCreateInput, "name">,
  weeks: { phase: string; days: { title: string; objective: string }[] }[]
) {
  const course = await db.course.upsert({
    where: { name },
    update: {},
    create: { name, ...data },
  });

  // Repair drifted weeks (audit 9.5): these courses are seed-owned, but
  // AI-generation or manual edits can overwrite their curriculum (the
  // HSE course ended up teaching "Building a homepage with WordPress
  // blocks"). If week/day content no longer matches the spec, rebuild.
  const existingWeeks = await db.courseWeek.findMany({
    where: { courseId: course.id },
    orderBy: { weekNumber: "asc" },
    include: { days: { orderBy: { day: "asc" } } },
  });
  const matches =
    existingWeeks.length === weeks.length &&
    weeks.every(
      (w, i) =>
        existingWeeks[i].phase === w.phase &&
        existingWeeks[i].days.length === w.days.length &&
        w.days.every((d, j) => existingWeeks[i].days[j]?.title === d.title),
    );
  if (matches) return course;

  if (existingWeeks.length > 0) {
    console.log(`↻ rebuilding drifted curriculum for "${name}"`);
    await db.courseDay.deleteMany({
      where: { courseWeekId: { in: existingWeeks.map((w) => w.id) } },
    });
    await db.courseWeek.deleteMany({ where: { courseId: course.id } });
  }
  {
    for (let w = 0; w < weeks.length; w++) {
      const week = await db.courseWeek.create({
        data: {
          courseId: course.id,
          weekNumber: w + 1,
          phase: weeks[w].phase,
          milestone: w === weeks.length - 1 ? "Final assessment" : "",
        },
      });
      for (let d = 0; d < weeks[w].days.length; d++) {
        await db.courseDay.create({
          data: {
            courseWeekId: week.id,
            day: d + 1,
            title: weeks[w].days[d].title,
            objective: weeks[w].days[d].objective,
            activity: "Practice exercise",
            deliverable: d === weeks[w].days.length - 1 ? "Week deliverable" : "",
          },
        });
      }
    }
  }
  return course;
}

async function main() {
  const pwd = await bcrypt.hash("demo123", 10);

  /* ---- demo seats (match the login form) ---- */
  const learner = await upsertUser("learner@demo.ai", "Aisha Khan", "learner", pwd);
  const instructor = await upsertUser("instructor@demo.ai", "Sir Saeed Khan", "instructor", pwd);
  const orgAdmin = await upsertUser("orgadmin@demo.ai", "Dr. Asma Rauf", "org_admin", pwd);
  console.log("✓ demo seats ensured");

  /* ---- demo organization (audit 9.1/9.7: an org_admin without an
     active OrgMember row hard-loops /org and the org demo shows
     nothing). Idempotent: only creates what's missing. ---- */
  const org = await db.organization.upsert({
    where: { slug: "demo-training-co" },
    update: {},
    create: { name: "Demo Training Co", slug: "demo-training-co", plan: "team", seats: 10 },
  });
  for (const m of [
    { userId: orgAdmin.id, role: "admin", seat: true },
    { userId: instructor.id, role: "mentor", seat: true },
    { userId: learner.id, role: "member", seat: true },
  ]) {
    const existing = await db.orgMember.findFirst({
      where: { orgId: org.id, userId: m.userId },
      select: { id: true },
    });
    if (!existing) {
      await db.orgMember.create({
        data: { orgId: org.id, ...m, status: "active" },
      });
    } else if (existing) {
      await db.orgMember.update({
        where: { id: existing.id },
        data: { status: "active", seat: true },
      });
    }
  }
  // Public storefront profile (2026-08-15): the org's page at
  // /demo-training-co shows its profile + catalog, and its logo
  // appears on member certificates.
  await db.organization.update({
    where: { id: org.id },
    data: {
      logoUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="#1d4ed8"/><text x="64" y="82" font-family="sans-serif" font-size="56" font-weight="700" fill="#ffffff" text-anchor="middle">D</text></svg>',
        ),
      description:
        "Skills training for engineering and industrial teams — HSE, operations and business fundamentals.",
      address: "Lahore, Pakistan",
      website: "https://example.com",
    },
  });
  console.log("✓ demo org storefront profile ensured");

  /* ---- courses ---- */
  const hse = await ensureCourse(
    "Workplace Safety Essentials (HSE)",
    {
      description:
        "Hands-on health, safety and environment training: hazard spotting, incident reporting and safe-work permits.",
      category: "safety",
      domain: "safety",
      level: "beginner",
      subtitle: "Hazard spotting, incident reporting, safe-work permits",
      published: true,
      durationWeeks: 3,
      rating: 4.8,
      reviewCount: 132,
      enrollmentCount: 410,
      skillsVerified: JSON.stringify(["Hazard spotting", "Incident reporting", "PPE selection"]),
      whatYouWillLearn: JSON.stringify([
        "Spot and classify workplace hazards",
        "Write a clear incident report",
        "Select and inspect PPE",
      ]),
      prerequisites: JSON.stringify(["None — open to all staff"]),
      toolsUsed: JSON.stringify(["Checklists", "Safety walks"]),
    },
    [
      {
        phase: "Fundamentals",
        days: [
          { title: "Why safety culture matters", objective: "Understand the cost of incidents" },
          { title: "Hazard vs risk", objective: "Distinguish hazards from risks" },
          { title: "The hierarchy of controls", objective: "Rank control measures" },
        ],
      },
      {
        phase: "In practice",
        days: [
          { title: "Running a safety walk", objective: "Inspect a workspace systematically" },
          { title: "Incident reporting done right", objective: "Write a factual incident report" },
          { title: "PPE selection & inspection", objective: "Match PPE to the hazard" },
        ],
      },
      {
        phase: "Certification",
        days: [
          { title: "Permit-to-work systems", objective: "Follow permit workflows" },
          { title: "Emergency response basics", objective: "React to alarms and evacuations" },
          { title: "Final assessment", objective: "Pass the safety certification" },
        ],
      },
    ]
  );

  await ensureCourse(
    "Customer Service Mastery",
    {
      description: "De-escalation, empathy scripting and service recovery for front-line teams.",
      category: "soft-skills",
      domain: "business",
      level: "beginner",
      subtitle: "De-escalation, empathy scripting, service recovery",
      published: true,
      durationWeeks: 2,
      rating: 4.6,
      reviewCount: 88,
      enrollmentCount: 265,
      skillsVerified: JSON.stringify(["De-escalation", "Active listening"]),
      whatYouWillLearn: JSON.stringify(["De-escalate upset customers", "Turn complaints into loyalty"]),
      prerequisites: JSON.stringify([]),
      toolsUsed: JSON.stringify(["Role-play scenarios"]),
    },
    [
      {
        phase: "Foundations",
        days: [
          { title: "The service mindset", objective: "Adopt a customer-first frame" },
          { title: "Active listening drills", objective: "Paraphrase and confirm" },
        ],
      },
      {
        phase: "Recovery",
        days: [
          { title: "De-escalation scripts", objective: "Calm heated conversations" },
          { title: "Service recovery offers", objective: "Make things right profitably" },
        ],
      },
    ]
  );

  await ensureCourse(
    "Data Analysis with Spreadsheets",
    {
      description: "From raw data to decisions: cleaning, pivot tables and dashboards.",
      category: "data",
      domain: "technology",
      level: "intermediate",
      subtitle: "Cleaning, pivot tables, dashboards",
      published: true,
      durationWeeks: 4,
      rating: 4.7,
      reviewCount: 204,
      enrollmentCount: 620,
      skillsVerified: JSON.stringify(["Data cleaning", "Pivot tables", "Charting"]),
      whatYouWillLearn: JSON.stringify(["Clean messy datasets", "Build pivot summaries", "Present findings"]),
      prerequisites: JSON.stringify(["Basic spreadsheet navigation"]),
      toolsUsed: JSON.stringify(["Google Sheets", "Excel"]),
    },
    [
      {
        phase: "Foundations",
        days: [
          { title: "Thinking in tables", objective: "Structure data for analysis" },
          { title: "Cleaning messy data", objective: "Fix duplicates and blanks" },
        ],
      },
      {
        phase: "Analysis",
        days: [
          { title: "Pivot tables", objective: "Summarise 10k rows in seconds" },
          { title: "Charts that convince", objective: "Pick the right visual" },
        ],
      },
    ]
  );

  await ensureCourse(
    "TraineesAI Foundations",
    {
      description: "The default onboarding course: how the platform works and how to study effectively.",
      category: "onboarding",
      domain: "general",
      level: "beginner",
      isDefault: true,
      durationWeeks: 1,
    },
    [
      {
        phase: "Orientation",
        days: [
          { title: "Welcome to TraineesAI", objective: "Tour the learner portal" },
          { title: "Study-flow basics", objective: "Learn the daily loop" },
        ],
      },
    ]
  );
  console.log("✓ courses ensured (weeks + days)");

  /* ---- org catalog: link HSE + customer-service to the storefront ---- */
  const hseLinked = await db.orgCourse.findUnique({
    where: { orgId_courseId: { orgId: org.id, courseId: hse.id } },
  });
  if (!hseLinked) {
    await db.orgCourse.create({ data: { orgId: org.id, courseId: hse.id } });
    console.log("✓ HSE linked to the demo org catalog");
  }

  /* ---- learner enrollment: HSE course at W2D1 ---- */
  const profile = await db.learnProfile.upsert({
    where: { userId_courseId: { userId: learner.id, courseId: hse.id } },
    update: {},
    create: {
      userId: learner.id,
      courseId: hse.id,
      totalXP: 640,
      learnerLevel: "Explorer",
      streakCurrent: 4,
      streakLongest: 9,
      lastActivityDate: daysAgo(0),
      masteryMap: {
        topicProgress: {
          current: { week: 2, day: 1 },
          history: [],
          slidesViewed: 22,
        },
      },
    },
  });
  await db.courseEnrollment.upsert({
    where: { userId_courseId_role: { userId: learner.id, courseId: hse.id, role: "student" } },
    update: {},
    create: { userId: learner.id, courseId: hse.id, role: "student" },
  });

  /* ---- XP ledger: 14-day activity strip ---- */
  const ledgerCount = await db.xPLedger.count({ where: { userId: learner.id } });
  if (ledgerCount === 0) {
    const pattern = [40, 65, 0, 80, 55, 90, 30, 0, 70, 85, 50, 95, 60, 20];
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === 0) continue;
      await db.xPLedger.create({
        data: {
          userId: learner.id,
          courseId: hse.id,
          amount: pattern[i],
          reason: "Lesson completed",
          createdAt: new Date(Date.now() - (13 - i) * 86_400_000 + 3_600_000),
        },
      });
    }
  }

  /* ---- badges ---- */
  const badgeDefs = [
    { code: "first-steps", name: "First Steps", description: "Complete your first lesson", icon: "footprints", rarity: "common" },
    { code: "week-one", name: "Week One Hero", description: "Finish a full week", icon: "calendar-check", rarity: "common" },
    { code: "streak-7", name: "On Fire", description: "Keep a 7-day streak", icon: "flame", rarity: "rare" },
  ];
  for (const def of badgeDefs) {
    const badge = await db.badgeDefinition.upsert({
      where: { code: def.code },
      update: {},
      create: def,
    });
    await db.userBadge.upsert({
      where: {
        userId_badgeId_courseId: { userId: learner.id, badgeId: badge.id, courseId: hse.id },
      },
      update: {},
      create: { userId: learner.id, badgeId: badge.id, courseId: hse.id, awardedAt: daysAgo(6) },
    }).catch(async () => {
      // courseId is part of the unique key — allow course-less badges too
      const exists = await db.userBadge.findFirst({ where: { userId: learner.id, badgeId: badge.id } });
      if (!exists) {
        await db.userBadge.create({ data: { userId: learner.id, badgeId: badge.id, awardedAt: daysAgo(6) } });
      }
    });
  }

  /* ---- today's daily check-in (in progress → shows on Home + Exams) ---- */
  const todayKey = new Date();
  todayKey.setHours(0, 0, 0, 0);
  await db.learnDailyTest.upsert({
    where: {
      userId_courseId_date: { userId: learner.id, courseId: hse.id, date: todayKey },
    },
    update: {},
    create: {
      userId: learner.id,
      courseId: hse.id,
      date: todayKey,
      questions: [
        { question: "What is the first step of a safety walk?", format: "short" },
        { question: "Name two items from the hierarchy of controls.", format: "short" },
      ],
      status: "in_progress",
    },
  });

  /* ---- one completed weekly test (history) ---- */
  await db.learnWeeklyTest.upsert({
    where: { userId_courseId_week: { userId: learner.id, courseId: hse.id, week: 1 } },
    update: {},
    create: {
      userId: learner.id,
      courseId: hse.id,
      week: 1,
      questions: [{ question: "Define hazard.", format: "short" }],
      status: "completed",
      score: 82,
      xpAwarded: 100,
      startedAt: daysAgo(7),
      completedAt: daysAgo(7),
    },
  });

  /* ---- weak topics ---- */
  for (const t of [
    { topic: "Hierarchy of controls", pillar: "Safety", level: "developing", trend: "up" },
    { topic: "Permit-to-work flow", pillar: "Safety", level: "not-started", trend: "stable" },
  ]) {
    await db.skillMastery.upsert({
      where: { userId_topic: { userId: learner.id, topic: t.topic } },
      update: {},
      create: {
        userId: learner.id,
        topic: t.topic,
        pillar: t.pillar,
        masteryLevel: t.level,
        evidenceCount: 3,
        trend: t.trend,
      },
    });
  }

  /* ---- announcements ---- */
  const notifCount = await db.notification.count({ where: { userId: learner.id } });
  if (notifCount === 0) {
    await db.notification.createMany({
      data: [
        {
          userId: learner.id,
          type: "announcement",
          title: "New course: Data Analysis with Spreadsheets",
          body: "Four weeks from raw data to decision-ready dashboards.",
          createdAt: daysAgo(1),
        },
        {
          userId: learner.id,
          type: "streak",
          title: "4-day streak — keep it alive",
          body: "Complete today's check-in to keep your streak.",
          link: "/learner/exams",
          read: false,
          createdAt: daysAgo(0),
        },
        {
          userId: learner.id,
          type: "grade",
          title: "Week 1 test graded: 82%",
          body: "Nice work on hazard identification.",
          read: true,
          createdAt: daysAgo(7),
        },
      ],
    });
  }

  /* ---- a certificate from an earlier course ---- */
  const certCount = await db.certificate.count({ where: { userId: learner.id } });
  if (certCount === 0) {
    await db.certificate.create({
      data: {
        userId: learner.id,
        courseName: "TraineesAI Foundations",
        studentName: learner.name,
        grade: "A",
        score: 91,
        signedBy: "TraineesAI",
        verifyToken: `seed-${learner.id}-foundations`,
        credentialId: "TRN-2026-08-AK-91",
        distinction: true,
        issuedAt: daysAgo(21),
      },
    });
  }

  console.log("✓ learner state seeded (profile", profile.totalXP, "XP)");
  console.log("\nDone. Login: learner@demo.ai / demo123 → /learner");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
