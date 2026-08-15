/**
 * scripts/seed-demo-data.ts — FULL demo dataset for the local SQLite DB.
 *
 * Builds a self-contained, production-safe demo environment:
 *   • 1 B2C instructor (independent, marketplace) with 4 courses
 *   • 1 B2B org (Demo Training Co) with 3 instructors and 6 courses
 *   • every course: complete 5-day-per-week daily outline, 2–6 weeks,
 *     ≥10 enrolled students
 *   • realistic variety: multi-course students, co-taught courses,
 *     projects, payments, reviews, certificates, submissions, messages
 *   • engagement archetypes: active / newly enrolled / left early /
 *     never logged in / rarely active — so every dashboard (learner,
 *     instructor, org, platform) is full of believable data
 *
 * DESTRUCTIVE for local data by design: wipes every table except the
 * platform admin + demo@examiner.ai accounts and the Setting (feature
 * flag) rows, then rebuilds the demo dataset deterministically.
 *
 * Run: node scripts/seed-demo-data.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

try {
  process.loadEnvFile();
} catch {
  /* env already loaded */
}

const db = new PrismaClient();

const DAY_MS = 86_400_000;
const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * DAY_MS);
const daysFromNow = (n: number) => new Date(NOW + n * DAY_MS);

const ADMIN_EMAIL = "admin@examiner.ai";
const DEMO_EMAIL = "demo@examiner.ai";

/** Deterministic RNG so re-runs produce the same demo world. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260815);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)] as T;
const range = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const chance = (p: number) => rng() < p;

// ────────────────────────────────────────────────────────────────────────────
// Course content — every course has a complete 5-day-per-week outline
// ────────────────────────────────────────────────────────────────────────────

interface WeekSpec {
  phase: string;
  days: [string, string, string, string, string];
}

interface CourseSpec {
  key: string;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  level: string;
  domain: string;
  price: number;
  instructorName: string;
  weeks: WeekSpec[];
  skillsVerified: string[];
  whatYouWillLearn: string[];
  prerequisites: string[];
  instructorBio: string;
}

const COURSES: CourseSpec[] = [
  // ── B2C — Ali Raza, independent marketplace instructor ──────────────
  {
    key: "ebay",
    name: "eBay Dropshipping Launchpad",
    subtitle: "Research, list and scale your first profitable eBay store",
    description:
      "A two-week, hands-on launchpad: pick a niche with real demand, source trustworthy suppliers, and get your first sales with listings that convert.",
    category: "business",
    level: "beginner",
    domain: "business",
    price: 19,
    instructorName: "Ali Raza",
    instructorBio:
      "Independent e-commerce coach with 8 years of eBay and Amazon selling. Ali has helped 200+ solo sellers launch their first store.",
    weeks: [
      {
        phase: "Store setup",
        days: [
          "Dropshipping basics & eBay policy guardrails",
          "Choosing your first niche",
          "Market research with sold listings",
          "Supplier sourcing & vetting",
          "Week 1 recap: pick your 5 products",
        ],
      },
      {
        phase: "First sales",
        days: [
          "Listings that convert",
          "Pricing & shipping strategy",
          "Customer messages that close sales",
          "Scaling past your first 10 orders",
          "Final project: launch your store",
        ],
      },
    ],
    skillsVerified: ["Niche research", "Supplier sourcing", "eBay listing"],
    whatYouWillLearn: ["Validate a niche in one afternoon", "Build listings that rank", "Handle your first customer disputes"],
    prerequisites: ["None — open to all sellers"],
  },
  {
    key: "seo",
    name: "SEO Fundamentals: Rank on Google",
    subtitle: "Keyword research, on-page optimization and measurable growth",
    description:
      "Learn the SEO loop that works for any website: find keywords you can actually win, optimize pages to match intent, and track rankings with free tools.",
    category: "business",
    level: "intermediate",
    domain: "technology",
    price: 29,
    instructorName: "Ali Raza",
    instructorBio:
      "Independent e-commerce coach with 8 years of eBay and Amazon selling. Ali has helped 200+ solo sellers launch their first store.",
    weeks: [
      {
        phase: "Keyword research",
        days: [
          "How Google ranks pages in 2026",
          "Seed keywords from your customer's words",
          "Search intent: informational vs transactional",
          "Competitor gap analysis",
          "Week 1 recap: your keyword map",
        ],
      },
      {
        phase: "On-page optimization",
        days: [
          "Title tags & meta descriptions that get clicks",
          "Headers, structure and internal links",
          "Content that matches intent",
          "Technical basics: speed, mobile, indexing",
          "Week 2 recap: audit your own page",
        ],
      },
      {
        phase: "Off-page & measurement",
        days: [
          "Backlinks that still matter",
          "Local SEO for physical businesses",
          "Google Search Console mastery",
          "A 90-day SEO calendar",
          "Final project: rank one page",
        ],
      },
    ],
    skillsVerified: ["Keyword research", "On-page SEO", "Search Console"],
    whatYouWillLearn: ["Find winnable keywords", "Optimize pages end-to-end", "Prove growth with free tools"],
    prerequisites: ["A website or blog you control"],
  },
  {
    key: "phone-repair",
    name: "Mobile Phone Repair Masterclass",
    subtitle: "Screens, batteries, board-level diagnostics and a repair business",
    description:
      "From opening tools to board-level troubleshooting: repair screens and batteries safely, diagnose faults systematically, and price repairs like a pro.",
    category: "technology",
    level: "intermediate",
    domain: "technology",
    price: 49,
    instructorName: "Ali Raza",
    instructorBio:
      "Independent e-commerce coach with 8 years of eBay and Amazon selling. Ali has helped 200+ solo sellers launch their first store.",
    weeks: [
      {
        phase: "Tools & safety",
        days: [
          "Workshop setup & ESD safety",
          "Opening techniques: adhesives & clips",
          "Screw mapping and parts organization",
          "Testing equipment: multimeters & power supplies",
          "Week 1 recap: safe teardown drill",
        ],
      },
      {
        phase: "Screens & batteries",
        days: [
          "Screen assembly anatomy",
          "Screen replacement step-by-step",
          "Battery removal & adhesive safety",
          "Water damage first response",
          "Week 2 recap: full screen swap",
        ],
      },
      {
        phase: "Board-level basics",
        days: [
          "Reading schematics for phones",
          "Common board faults: charging & boot",
          "Micro-soldering essentials",
          "Component-level diagnostics flow",
          "Week 3 recap: boot-loop diagnosis",
        ],
      },
      {
        phase: "Diagnostics & business",
        days: [
          "Systematic fault-finding workflow",
          "Parts sourcing & warranty handling",
          "Pricing repairs profitably",
          "Running a repair counter",
          "Final project: certified repair of a donor device",
        ],
      },
    ],
    skillsVerified: ["Screen replacement", "Board diagnostics", "ESD safety"],
    whatYouWillLearn: ["Replace screens and batteries safely", "Diagnose boot faults", "Price repairs profitably"],
    prerequisites: ["Patience and steady hands — no prior electronics needed"],
  },
  {
    key: "freelance",
    name: "Freelancing on Fiverr & Upwork",
    subtitle: "Win your first clients and turn a skill into income",
    description:
      "Position a service clients search for, write proposals that win, and manage scope so every project ends in a five-star review.",
    category: "business",
    level: "beginner",
    domain: "business",
    price: 0,
    instructorName: "Ali Raza",
    instructorBio:
      "Independent e-commerce coach with 8 years of eBay and Amazon selling. Ali has helped 200+ solo sellers launch their first store.",
    weeks: [
      {
        phase: "Profile that wins",
        days: [
          "Choosing a service clients actually buy",
          "Profile & portfolio positioning",
          "Packaging your first gig",
          "Pricing psychology for new sellers",
          "Week 1 recap: publish your gig",
        ],
      },
      {
        phase: "Clients & reviews",
        days: [
          "Proposals that get replies",
          "Discovery calls without fear",
          "Scope, deadlines & revision limits",
          "Getting five-star reviews",
          "Final project: win your first client",
        ],
      },
    ],
    skillsVerified: ["Gig positioning", "Proposal writing", "Client scoping"],
    whatYouWillLearn: ["Package a sellable service", "Write winning proposals", "Turn clients into repeat buyers"],
    prerequisites: ["Any skill you can deliver remotely"],
  },

  // ── B2B — Demo Training Co (industrial training) ───────────────────
  {
    key: "hse",
    name: "Workplace Safety Essentials (HSE)",
    subtitle: "Hazard spotting, incident reporting, safe-work permits",
    description:
      "Hands-on health, safety and environment training: hazard spotting, incident reporting and safe-work permits for industrial teams.",
    category: "healthcare",
    level: "beginner",
    domain: "safety",
    price: 0,
    instructorName: "Sir Saeed Khan",
    instructorBio:
      "Senior HSE trainer with 15 years across power and manufacturing plants. Saeed leads Demo Training Co's safety curriculum.",
    weeks: [
      {
        phase: "Fundamentals",
        days: [
          "Why safety culture matters",
          "Hazard vs risk",
          "The hierarchy of controls",
          "Reading a risk assessment",
          "Week 1 recap: hazard walk drill",
        ],
      },
      {
        phase: "In practice",
        days: [
          "Running a safety walk",
          "Incident reporting done right",
          "PPE selection & inspection",
          "Lockout-tagout basics",
          "Week 2 recap: mock incident report",
        ],
      },
      {
        phase: "Certification",
        days: [
          "Permit-to-work systems",
          "Emergency response basics",
          "Fire safety & evacuation",
          "Safety communication",
          "Final assessment",
        ],
      },
    ],
    skillsVerified: ["Hazard spotting", "Incident reporting", "PPE selection"],
    whatYouWillLearn: ["Spot and classify workplace hazards", "Write a factual incident report", "Follow permit workflows"],
    prerequisites: ["None — open to all staff"],
  },
  {
    key: "electrical",
    name: "Industrial Electrical Systems",
    subtitle: "Switchgear, motor control and safe troubleshooting",
    description:
      "Read industrial single-line diagrams, understand motor control circuits, and troubleshoot electrical faults safely inside a live plant.",
    category: "engineering",
    level: "intermediate",
    domain: "electrical",
    price: 0,
    instructorName: "Fatima Noor",
    instructorBio:
      "Electrical engineer with 12 years in power distribution and plant maintenance. Fatima trains maintenance teams across Pakistan's industrial sector.",
    weeks: [
      {
        phase: "Electrical fundamentals",
        days: [
          "Voltage, current & power in AC systems",
          "Three-phase systems explained",
          "Reading single-line diagrams",
          "Protection devices: breakers & fuses",
          "Week 1 recap: diagram reading test",
        ],
      },
      {
        phase: "Switchgear & distribution",
        days: [
          "Switchgear types & ratings",
          "Transformers in industrial plants",
          "Earthing & bonding safety",
          "Panel inspection checklist",
          "Week 2 recap: switchgear walkthrough",
        ],
      },
      {
        phase: "Motor control",
        days: [
          "Induction motor basics",
          "DOL and star-delta starters",
          "VFD fundamentals",
          "Motor protection settings",
          "Week 3 recap: starter circuit lab",
        ],
      },
      {
        phase: "Safe troubleshooting",
        days: [
          "Isolation & test-before-touch",
          "Systematic fault finding",
          "Using a multimeter safely",
          "Documenting electrical work",
          "Final project: panel fault diagnosis",
        ],
      },
    ],
    skillsVerified: ["SLD reading", "Motor starters", "Electrical isolation"],
    whatYouWillLearn: ["Read single-line diagrams", "Wire and check starters", "Troubleshoot safely"],
    prerequisites: ["Basic electrical awareness"],
  },
  {
    key: "mechanical",
    name: "Mechanical Maintenance & Pumps",
    subtitle: "Alignment, bearings, seals and pump overhauls",
    description:
      "Preventive maintenance that actually prevents failure: alignment, bearing handling, seal replacement and a full pump overhaul sequence.",
    category: "manufacturing",
    level: "intermediate",
    domain: "mechanical",
    price: 0,
    instructorName: "Fatima Noor & Bilal Ahmed",
    instructorBio:
      "Co-taught by Demo Training Co's rotating-equipment specialists — 25+ years of combined plant maintenance experience.",
    weeks: [
      {
        phase: "Maintenance strategy",
        days: [
          "Breakdown vs preventive vs predictive",
          "Reading maintenance schedules",
          "Lubrication done right",
          "Fasteners, torque & lockout",
          "Week 1 recap: maintenance route plan",
        ],
      },
      {
        phase: "Alignment & bearings",
        days: [
          "Shaft alignment fundamentals",
          "Dial-indicator alignment method",
          "Bearing types & handling",
          "Bearing failure analysis",
          "Week 2 recap: alignment exercise",
        ],
      },
      {
        phase: "Seals & pumps",
        days: [
          "Pump types: centrifugal & positive displacement",
          "Mechanical seals explained",
          "Seal replacement step-by-step",
          "Cavitation & its causes",
          "Week 3 recap: seal change drill",
        ],
      },
      {
        phase: "Overhaul & reliability",
        days: [
          "Pump overhaul sequence",
          "Vibration basics for operators",
          "Root-cause analysis intro",
          "Spares planning",
          "Final project: pump overhaul plan",
        ],
      },
    ],
    skillsVerified: ["Shaft alignment", "Bearing handling", "Pump overhaul"],
    whatYouWillLearn: ["Align shafts with a dial indicator", "Replace mechanical seals", "Plan an overhaul"],
    prerequisites: ["Comfort with hand tools"],
  },
  {
    key: "hr",
    name: "HR Fundamentals for Supervisors",
    subtitle: "Feedback, discipline and leading a shift",
    description:
      "The people side of running a shift: giving feedback that sticks, handling conflict early, and building a team that shows up.",
    category: "hr",
    level: "beginner",
    domain: "business",
    price: 0,
    instructorName: "Bilal Ahmed",
    instructorBio:
      "Former plant operations lead turned people-coach. Bilal trains supervisors on the leadership skills plants forget to teach.",
    weeks: [
      {
        phase: "Leading people",
        days: [
          "What new supervisors get wrong",
          "Giving feedback that sticks",
          "Handling conflict early",
          "Motivating without money",
          "Week 1 recap: feedback role-play",
        ],
      },
      {
        phase: "Managing performance",
        days: [
          "Setting clear expectations",
          "The discipline conversation",
          "Absenteeism & its root causes",
          "Building a dependable shift",
          "Final project: your team plan",
        ],
      },
    ],
    skillsVerified: ["Feedback delivery", "Conflict resolution", "Performance management"],
    whatYouWillLearn: ["Give feedback that sticks", "Handle conflict early", "Run a dependable shift"],
    prerequisites: ["None — for current and aspiring supervisors"],
  },
  {
    key: "finance",
    name: "Finance for Non-Finance Managers",
    subtitle: "Budgets, variance and cost control without the jargon",
    description:
      "Read a P&L, explain variances to your manager, and defend your department's budget — no accounting background required.",
    category: "finance",
    level: "beginner",
    domain: "business",
    price: 0,
    instructorName: "Bilal Ahmed",
    instructorBio:
      "Former plant operations lead turned people-coach. Bilal trains supervisors on the leadership skills plants forget to teach.",
    weeks: [
      {
        phase: "The numbers",
        days: [
          "P&L, balance sheet & cash in plain words",
          "Cost types: fixed, variable, direct",
          "Reading a budget line",
          "KPIs managers actually track",
          "Week 1 recap: explain your P&L",
        ],
      },
      {
        phase: "Cost control",
        days: [
          "Variance analysis without panic",
          "Building a defensible budget",
          "Capital vs operating spend",
          "Talking to finance",
          "Week 2 recap: budget Q&A drill",
        ],
      },
      {
        phase: "Decisions",
        days: [
          "Make-or-buy decisions",
          "Justifying an investment",
          "Pricing a product or service",
          "Presenting numbers to leadership",
          "Final project: defend a budget",
        ],
      },
    ],
    skillsVerified: ["Budget reading", "Variance analysis", "Cost control"],
    whatYouWillLearn: ["Read a P&L confidently", "Explain variances", "Defend a budget"],
    prerequisites: ["None — numbers for non-accountants"],
  },
  {
    key: "power-plant",
    name: "Power Plant Operations Bootcamp",
    subtitle: "From cold start to full load — operating a plant safely",
    description:
      "The complete operator's bootcamp: plant systems, startup sequences, abnormal condition handling and shift handover discipline.",
    category: "engineering",
    level: "advanced",
    domain: "power",
    price: 0,
    instructorName: "Sir Saeed Khan & Fatima Noor",
    instructorBio:
      "Co-taught by Demo Training Co's power-plant veterans — operations and electrical expertise in one bootcamp.",
    weeks: [
      {
        phase: "Plant systems",
        days: [
          "Plant overview: boiler, turbine, generator",
          "Water-steam cycle in depth",
          "Fuel & combustion systems",
          "Cooling systems & auxiliaries",
          "Week 1 recap: system walkthrough",
        ],
      },
      {
        phase: "Startup & shutdown",
        days: [
          "Cold start sequence",
          "Warm & hot start differences",
          "Synchronizing to the grid",
          "Controlled shutdown procedure",
          "Week 2 recap: startup drill",
        ],
      },
      {
        phase: "Normal operations",
        days: [
          "Load following & ramping",
          "Efficiency monitoring",
          "Water chemistry essentials",
          "Reading trends & logs",
          "Week 3 recap: log review exercise",
        ],
      },
      {
        phase: "Abnormal conditions",
        days: [
          "Trips & emergency shutdown",
          "Common alarms and first response",
          "Boiler water level emergencies",
          "Communication during incidents",
          "Week 4 recap: trip simulation",
        ],
      },
      {
        phase: "Reliability & maintenance",
        days: [
          "Operator rounds & inspection",
          "Working with maintenance crews",
          "Overhauls from the operator's seat",
          "Spares & material awareness",
          "Week 5 recap: outage checklist",
        ],
      },
      {
        phase: "Capstone",
        days: [
          "Shift handover discipline",
          "Writing operating instructions",
          "Mentoring junior operators",
          "Full plant simulation review",
          "Final assessment & certification",
        ],
      },
    ],
    skillsVerified: ["Plant startup", "Abnormal handling", "Shift handover"],
    whatYouWillLearn: ["Run startup and shutdown sequences", "Handle trips calmly", "Keep a disciplined shift log"],
    prerequisites: ["HSE essentials or equivalent awareness"],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// People — B2C instructor, org team, learners
// ────────────────────────────────────────────────────────────────────────────

interface PersonSpec {
  email: string;
  name: string;
  role: "learner" | "instructor" | "org_admin";
}

const B2C_INSTRUCTOR: PersonSpec = { email: "ali.raza@demo.ai", name: "Ali Raza", role: "instructor" };

const ORG_ADMIN: PersonSpec = { email: "orgadmin@demo.ai", name: "Dr. Asma Rauf", role: "org_admin" };

const ORG_INSTRUCTORS: PersonSpec[] = [
  { email: "instructor@demo.ai", name: "Sir Saeed Khan", role: "instructor" },
  { email: "fatima.noor@demo.ai", name: "Fatima Noor", role: "instructor" },
  { email: "bilal.ahmed@demo.ai", name: "Bilal Ahmed", role: "instructor" },
];

const B2C_LEARNER_NAMES = [
  "Sarah Ahmed", "Rehan Sheikh", "Maham Nadeem", "Bilawal Memon",
  "Zoya Irfan", "Adeel Chaudhry", "Hira Sultan", "Shayan Karim",
  "Anum Tariq", "Faisal Abbasi", "Emaan Qazi", "Yousuf Malik",
];

const ORG_LEARNER_NAMES = [
  "Aisha Khan", "Hamza Ali", "Zainab Bibi", "Usman Tariq",
  "Maryam Javed", "Hassan Raza", "Sana Khalid", "Omar Farooq",
  "Iqra Saleem", "Fahad Mehmood", "Nimra Akhtar", "Danish Iqbal",
  "Ayesha Siddiqui", "Waqas Anwar", "Rabia Nasir", "Taimoor Malik",
  "Sadia Rehman", "Kamran Yusuf", "Mahnoor Haider", "Saad Qureshi",
  "Laiba Shahid", "Arslan Baig", "Amna Riaz", "Zubair Cheema",
];

function emailFor(name: string, prefix: string): string {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
  return name === "Aisha Khan" ? "learner@demo.ai" : `${prefix}${slug}@demo.ai`;
}

// Which org courses each org instructor leads / co-leads
const ORG_COURSE_INSTRUCTORS: Record<string, string[]> = {
  hse: ["instructor@demo.ai"],
  electrical: ["fatima.noor@demo.ai"],
  mechanical: ["fatima.noor@demo.ai", "bilal.ahmed@demo.ai"],
  hr: ["bilal.ahmed@demo.ai"],
  finance: ["bilal.ahmed@demo.ai"],
  "power-plant": ["instructor@demo.ai", "fatima.noor@demo.ai"],
};

type Archetype = "active" | "newly" | "left" | "never" | "rare";

const gradeOf = (score: number) =>
  score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
const levelOf = (xp: number) =>
  xp < 250 ? "Rookie" : xp < 1000 ? "Scholar" : xp < 2500 ? "Expert" : "Master";

// ────────────────────────────────────────────────────────────────────────────
// Reset — wipe everything except admin/demo accounts + feature flags
// ────────────────────────────────────────────────────────────────────────────

async function resetDb() {
  const leaves = [
    "signOff", "gradeEntry", "feedbackMsg", "feedbackThread", "submissionPart",
    "submission", "examSession", "userBadge", "xPLedger", "learnNote",
    "engagementEvent", "projectHelpSession", "projectMilestone", "learnProject",
    "learnDailyTest", "learnWeeklyTest", "weeklyTest", "dailyTestAnswer",
    "dailyTest", "drillCard", "interaction", "dailyLog", "curriculumProgress",
    "projectReport", "projectWeek", "projectTask", "groupTaskSubmission",
    "groupTask", "peerAssessment", "message", "notification", "certificate",
    "payment", "passwordResetRequest", "comment", "chatSession", "tutorMessage",
    "tutorSession", "journeyStep", "journeyPlan", "learnSlide", "learnNarration",
    "reportCard", "competency", "skillMastery", "accessGrant", "event",
    "auditLog", "aICache", "aIUsageLog", "milestone", "courseReviewHelpfulVote",
    "courseReview", "courseFAQ", "courseDay", "courseWeek", "courseEnrollment",
    "learnProfile", "orgCourse", "orgMember", "assignment", "rubricCriterion",
    "rubric", "learningPathCourse", "learningPath", "registryRow",
    "roleNavConfig", "instructorRule", "institution", "organization", "course",
    "badgeDefinition",
  ];
  for (const name of leaves) {
    await (db as unknown as Record<string, { deleteMany: (args?: unknown) => Promise<unknown> }>)[name].deleteMany();
  }
  await db.user.deleteMany({
    where: { email: { notIn: [ADMIN_EMAIL, DEMO_EMAIL] } },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Builders
// ────────────────────────────────────────────────────────────────────────────

async function makeUser(
  p: PersonSpec,
  opts: { createdAt?: Date; lastLogin?: Date | null } = {},
) {
  const passwordHash = await bcrypt.hash("demo123", 10);
  return db.user.create({
    data: {
      email: p.email,
      name: p.name,
      role: p.role,
      status: "active",
      passwordHash,
      approvedAt: daysAgo(30),
      createdAt: opts.createdAt ?? daysAgo(range(14, 60)),
      lastLogin: opts.lastLogin === null ? null : (opts.lastLogin ?? daysAgo(0)),
    },
  });
}

async function makeCourse(spec: CourseSpec, published: boolean) {
  const course = await db.course.create({
    data: {
      name: spec.name,
      subtitle: spec.subtitle,
      description: spec.description,
      category: spec.category,
      level: spec.level,
      domain: spec.domain,
      price: spec.price,
      currency: "USD",
      durationWeeks: spec.weeks.length,
      language: "en",
      published,
      featured: chance(0.25),
      instructorName: spec.instructorName,
      instructorBio: spec.instructorBio,
      skillsVerified: JSON.stringify(spec.skillsVerified),
      whatYouWillLearn: JSON.stringify(spec.whatYouWillLearn),
      prerequisites: JSON.stringify(spec.prerequisites),
      toolsUsed: JSON.stringify([]),
      deliverableTypes: JSON.stringify(["report", "photo"]),
      projectEnabled: true,
      projectRequired: chance(0.5),
      projectDefaultDurationWeeks: Math.min(spec.weeks.length, 4),
      isActive: true,
    },
  });

  for (let w = 0; w < spec.weeks.length; w++) {
    const week = await db.courseWeek.create({
      data: {
        courseId: course.id,
        weekNumber: w + 1,
        phase: spec.weeks[w].phase,
        milestone: w === spec.weeks.length - 1 ? "Final assessment" : `Week ${w + 1} deliverable`,
      },
    });
    for (let d = 0; d < 5; d++) {
      const title = spec.weeks[w].days[d];
      await db.courseDay.create({
        data: {
          courseWeekId: week.id,
          day: d + 1,
          title,
          objective: `Be able to demonstrate: ${title.toLowerCase()}.`,
          activity: d % 2 === 0 ? "Watch & apply" : "Practice exercise",
          deliverable: d === 4 ? `Week ${w + 1} deliverable — ${spec.weeks[w].phase}` : "",
        },
      });
    }
  }
  return course;
}

interface CourseRow {
  id: string;
  durationWeeks: number;
  price: number;
  name: string;
}

function masteryJson(week: number, day: number, completedDays: number) {
  const history: { week: number; day: number; completedAt: string }[] = [];
  for (let i = 0; i < completedDays; i++) {
    const w = Math.floor(i / 5) + 1;
    const d = (i % 5) + 1;
    if (w > week || (w === week && d > day)) break;
    history.push({ week: w, day: d, completedAt: daysAgo(Math.max(0, completedDays - i)).toISOString() });
  }
  return {
    topicProgress: {
      current: week > 0 ? { week, day } : null,
      history,
      slidesViewed: completedDays * 4,
      resourcesShown: completedDays > 0,
    },
  };
}

const XP_REASONS = ["daily_test_completed", "weekly_test_completed", "slide_viewed", "checkin", "streak_bonus", "project_milestone"];

async function seedLearnerCourseData(
  user: { id: string; name: string },
  course: CourseRow,
  arch: Archetype,
  opts: { finisher?: boolean; primary?: boolean } = {},
) {
  const finisher = opts.finisher ?? false;
  const startedDaysAgo = arch === "newly" ? range(1, 3) : arch === "never" ? range(4, 10) : range(10, 45);
  const week = finisher ? course.durationWeeks : Math.min(course.durationWeeks, Math.max(1, Math.floor(startedDaysAgo / 7) + (arch === "left" ? 1 : 2)));
  const day = finisher ? 5 : range(1, 5);
  const completedDays = finisher ? course.durationWeeks * 5 : (week - 1) * 5 + day;

  const lastActivity =
    arch === "never" ? null
      : arch === "left" ? daysAgo(range(6, 12))
        : arch === "rare" ? daysAgo(range(2, 6))
          : daysAgo(range(0, 1));

  const xp = finisher ? range(1500, 2400)
    : arch === "never" ? 0
      : arch === "newly" ? range(40, 160)
        : arch === "left" ? range(200, 500)
          : arch === "rare" ? range(250, 700)
            : range(400, 1600);

  await db.learnProfile.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    update: {},
    create: {
      userId: user.id,
      courseId: course.id,
      totalXP: xp,
      learnerLevel: levelOf(xp),
      streakCurrent: arch === "never" ? 0 : arch === "left" ? 0 : arch === "rare" ? range(1, 3) : arch === "newly" ? range(0, 2) : range(3, 14),
      streakLongest: arch === "never" ? 0 : arch === "left" ? range(2, 6) : arch === "rare" ? range(2, 5) : range(4, 21),
      lastActivityDate: lastActivity,
      masteryMap: masteryJson(finisher ? 0 : week, finisher ? 0 : day, completedDays) as unknown as Prisma.InputJsonValue,
      leaderboardOptIn: chance(0.6),
    },
  });

  if (arch === "never") return;

  // Daily tests — recent history for engaged archetypes
  const dailyDays = arch === "newly" ? 1 : arch === "rare" ? 3 : arch === "left" ? 4 : range(6, 10);
  for (let i = 0; i < dailyDays; i++) {
    const score = range(55, 96);
    await db.learnDailyTest.create({
      data: {
        userId: user.id,
        courseId: course.id,
        date: daysAgo(i),
        questions: [{ question: "Explain the key concept in your own words.", format: "short", conceptId: `c-${i}`, isSpacedRepetition: false }],
        answers: [{ answer: "Student's answer", evaluation: "understood", score }],
        status: "completed",
        score,
        xpAwarded: 30,
        startedAt: daysAgo(i),
        completedAt: daysAgo(i),
      },
    });
  }

  // Weekly tests — per completed week
  const weeksDone = finisher ? course.durationWeeks : Math.max(1, week - (arch === "left" ? 2 : 1));
  for (let w = 1; w <= weeksDone && w <= course.durationWeeks; w++) {
    const score = range(58, 95);
    await db.learnWeeklyTest.create({
      data: {
        userId: user.id,
        courseId: course.id,
        week: w,
        questions: [{ question: `Week ${w} concept check.`, format: "short", conceptId: `w-${w}`, difficulty: "medium" }],
        answers: [{ answer: "Student's answer", evaluation: "good", score }],
        status: "completed",
        score,
        xpAwarded: 100,
        startedAt: daysAgo((course.durationWeeks - w) * 7 + 2),
        completedAt: daysAgo((course.durationWeeks - w) * 7),
      },
    });
  }

  // Legacy WeeklyTest — only for the PRIMARY course (unique per user+week)
  if (opts.primary) {
    for (let w = 1; w <= (finisher ? course.durationWeeks : Math.max(1, week - 1)); w++) {
      const score = range(58, 95);
      await db.weeklyTest.create({
        data: {
          userId: user.id,
          week: w,
          courseId: course.id,
          status: "completed",
          score,
          strengths: JSON.stringify(["Concept retention", "Application"]),
          weaknesses: JSON.stringify(["Edge cases"]),
          startedAt: daysAgo((course.durationWeeks - w) * 7 + 3),
          completedAt: daysAgo((course.durationWeeks - w) * 7),
          currentQuestion: 1,
          replyCount: range(4, 10),
        },
      });
    }
  }

  // XP ledger
  const ledgerEntries = arch === "left" ? 6 : arch === "rare" ? 8 : arch === "newly" ? 2 : range(10, 20);
  for (let i = 0; i < ledgerEntries; i++) {
    const reason = pick(XP_REASONS);
    await db.xPLedger.create({
      data: {
        userId: user.id,
        courseId: course.id,
        amount: reason === "weekly_test_completed" ? 100 : reason === "daily_test_completed" ? 30 : range(5, 20),
        reason,
        createdAt: daysAgo(range(0, 30)),
      },
    });
  }

  // Notes
  if (chance(0.6)) {
    await db.learnNote.createMany({
      data: Array.from({ length: range(1, 3) }, (_, i) => ({
        userId: user.id,
        courseId: course.id,
        content: pick([
          "Ask the tutor about this during the next session.",
          "Practice this again tomorrow — it's still fuzzy.",
          "Great analogy from the mentor, wrote it down.",
        ]),
        createdAt: daysAgo(range(1, 20)),
      })),
    });
  }

  // Project — most engaged org learners build one
  if (chance(arch === "active" || finisher ? 0.75 : 0.25)) {
    const project = await db.learnProject.create({
      data: {
        userId: user.id,
        courseId: course.id,
        title: pick([
          "Permit-to-work site audit",
          "Motor control panel inspection",
          "Pump overhaul checklist",
          "Onboarding plan for new operators",
          "Monthly variance report template",
          "Startup logbook digitization",
          "Store launch playbook",
          "Repair pricing calculator",
        ]),
        goal: "Apply the course in a real deliverable and get it signed off by the mentor.",
        currentState: arch === "left" ? "stalled after the first milestone" : "in progress — milestone 2 of 4",
        deadline: daysFromNow(range(7, 30)),
        status: "active",
      },
    });
    const milestones = ["Plan & scope", "First draft", "Mentor review", "Final sign-off"];
    for (let m = 0; m < milestones.length; m++) {
      await db.projectMilestone.create({
        data: {
          projectId: project.id,
          title: milestones[m],
          order: m + 1,
          status: m === 0 ? "completed" : m === 1 && (arch === "active" || finisher) ? "in_progress" : "pending",
          completedAt: m === 0 ? daysAgo(range(1, 10)) : null,
        },
      });
    }
    if (chance(0.2)) {
      await db.projectHelpSession.create({
        data: {
          projectId: project.id,
          blocker: "Not sure how to scope the first draft",
          hint: "Start from the course's week-1 checklist.",
          hintLevel: 1,
          resolved: chance(0.5),
        },
      });
    }
  }

  // Skill mastery — unique per (userId, topic), so upsert across courses
  const skillTopics = ["Hazard identification", "Control circuits", "Bearing handling", "Feedback delivery", "Variance analysis", "Listing optimization", "Keyword mapping", "Screen replacement", "Cold start sequence", "Seal replacement"];
  const chosenSkills = [...skillTopics].sort(() => rng() - 0.5).slice(0, 3);
  for (const topic of chosenSkills) {
    await db.skillMastery.upsert({
      where: { userId_topic: { userId: user.id, topic } },
      update: {},
      create: {
        userId: user.id,
        topic,
        pillar: pick(["Safety", "Electrical", "Mechanical", "Leadership", "Finance", "Digital"]),
        masteryLevel: pick(["developing", "competent", "strong"]),
        evidenceCount: range(1, 6),
        trend: pick(["up", "stable", "down"]),
      },
    });
  }

  // Notifications
  await db.notification.createMany({
    data: [
      {
        userId: user.id,
        type: "announcement",
        title: `New module in ${course.name}`,
        body: "This week's module is live — your AI tutor is ready.",
        link: `/learner/courses/${course.id}`,
        read: chance(0.4),
        createdAt: daysAgo(range(0, 3)),
      },
      ...(finisher
        ? [{
            userId: user.id,
            type: "course_completed",
            title: `Course complete: ${course.name}`,
            body: "Your certificate is ready — congratulations!",
            link: "/learner/progress",
            read: true,
            createdAt: daysAgo(range(0, 2)),
          }]
        : []),
      ...(arch === "left"
        ? [{
            userId: user.id,
            type: "streak",
            title: "We miss you!",
            body: "Your mentor left a note — jump back in with a 10-minute session.",
            link: "/learner",
            read: false,
            createdAt: daysAgo(2),
          }]
        : []),
    ],
  });

  // Check-in engagement events ("never" already returned above)
  if (arch !== "left") {
    for (let i = 0; i < (arch === "newly" ? 1 : arch === "rare" ? 3 : range(5, 9)); i++) {
      await db.engagementEvent.create({
        data: {
          userId: user.id,
          courseId: course.id,
          eventType: "checkin",
          sentiment: pick(["confident", "ok", "stuck"]),
          metadata: { note: pick(["Feeling good", "Steady progress", "Need more time on this"]) },
          createdAt: daysAgo(range(0, 14)),
        },
      });
    }
  }
  if (arch === "left") {
    await db.engagementEvent.create({
      data: {
        userId: user.id,
        courseId: course.id,
        eventType: "absence.notified",
        metadata: { kind: "short" },
        createdAt: daysAgo(3),
      },
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🧹 Resetting the local DB to a clean demo dataset…");
  await resetDb();
  console.log("✓ wiped (kept platform admin + feature flags)");

  const adminPwd = await bcrypt.hash("admin123", 10);
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminPwd, role: "platform_admin", status: "active" },
    create: {
      email: ADMIN_EMAIL, name: "Platform Administrator",
      passwordHash: adminPwd, role: "platform_admin", status: "active", approvedAt: daysAgo(60),
    },
  });
  console.log("✓ platform admin ensured");

  // ── Badge definitions ──────────────────────────────────────────────
  const badges = [
    { code: "first_lesson", name: "First Steps", description: "Completed your first daily lesson", icon: "rocket", rarity: "common", xpReward: 20 },
    { code: "streak_7", name: "Week Streak", description: "7 days of learning in a row", icon: "flame", rarity: "uncommon", xpReward: 50 },
    { code: "week_complete", name: "Week Crusher", description: "Finished every day in a course week", icon: "check", rarity: "common", xpReward: 40 },
    { code: "project_started", name: "Builder", description: "Started a real project", icon: "hammer", rarity: "uncommon", xpReward: 60 },
    { code: "course_complete", name: "Finisher", description: "Completed a full course", icon: "trophy", rarity: "rare", xpReward: 150 },
  ];
  const badgeRows: Record<string, string> = {};
  for (const b of badges) {
    const row = await db.badgeDefinition.create({ data: b });
    badgeRows[b.code] = row.id;
  }
  console.log("✓ badge definitions");

  // ── B2C side — independent instructor + marketplace courses ────────
  const ali = await makeUser(B2C_INSTRUCTOR, { createdAt: daysAgo(50) });
  const b2cCourses: Record<string, CourseRow> = {};
  for (const spec of COURSES.slice(0, 4)) {
    const course = await makeCourse(spec, true);
    await db.courseEnrollment.create({
      data: { userId: ali.id, courseId: course.id, role: "instructor" },
    });
    b2cCourses[spec.key] = course;
  }
  console.log("✓ B2C instructor Ali Raza + 4 marketplace courses");

  const b2cLearners: { user: { id: string; name: string } }[] = [];
  for (const name of B2C_LEARNER_NAMES) {
    const u = await makeUser(
      { email: emailFor(name, "b2c."), name, role: "learner" },
      { createdAt: daysAgo(range(8, 40)), lastLogin: chance(0.85) ? daysAgo(range(0, 3)) : null },
    );
    b2cLearners.push({ user: { id: u.id, name: u.name } });
  }

  // B2C enrollment plan: every course ≥10 students, overlaps between SEO & Fiverr
  const b2cPlan: Record<string, string[]> = {
    ebay: ["Sarah Ahmed", "Bilawal Memon", "Zoya Irfan", "Shayan Karim", "Faisal Abbasi", "Yousuf Malik", "Hira Sultan", "Adeel Chaudhry", "Emaan Qazi", "Anum Tariq"],
    seo: ["Rehan Sheikh", "Maham Nadeem", "Sarah Ahmed", "Bilawal Memon", "Adeel Chaudhry", "Emaan Qazi", "Hira Sultan", "Shayan Karim", "Zoya Irfan", "Yousuf Malik", "Anum Tariq"],
    "phone-repair": ["Faisal Abbasi", "Yousuf Malik", "Shayan Karim", "Bilawal Memon", "Adeel Chaudhry", "Emaan Qazi", "Hira Sultan", "Anum Tariq", "Zoya Irfan", "Rehan Sheikh", "Maham Nadeem", "Sarah Ahmed"],
    freelance: ["Sarah Ahmed", "Rehan Sheikh", "Maham Nadeem", "Hira Sultan", "Anum Tariq", "Emaan Qazi", "Faisal Abbasi", "Zoya Irfan", "Adeel Chaudhry", "Bilawal Memon"],
  };

  for (const [key, names] of Object.entries(b2cPlan)) {
    const course = b2cCourses[key];
    for (const name of names) {
      const learner = b2cLearners.find((l) => l.user.name === name)!;
      await db.courseEnrollment.create({
        data: { userId: learner.user.id, courseId: course.id, role: "student" },
      });
      const isFinisher = chance(0.06);
      const arch: Archetype = chance(0.08) ? "never" : chance(0.1) ? "newly" : chance(0.12) ? "left" : chance(0.1) ? "rare" : "active";
      await seedLearnerCourseData(learner.user, course, arch, { finisher: isFinisher, primary: key === "ebay" });

      // Payments for paid courses
      if (course.price > 0) {
        await db.payment.create({
          data: {
            userId: learner.user.id,
            courseId: course.id,
            amount: course.price,
            currency: "USD",
            platformFee: Math.round(course.price * 0.2 * 100) / 100,
            instructorShare: Math.round(course.price * 0.8 * 100) / 100,
            status: "completed",
            createdAt: daysAgo(range(1, 35)),
          },
        });
      }
      if (isFinisher) {
        const score = range(78, 96);
        await db.certificate.create({
          data: {
            userId: learner.user.id,
            courseId: course.id,
            courseName: course.name,
            studentName: learner.user.name,
            grade: gradeOf(score),
            score,
            signedBy: ali.name,
            verifyToken: crypto.randomBytes(32).toString("hex"),
            credentialId: `TRN-AI-2026-08-${learner.user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}-${score}`,
            issuedAt: daysAgo(range(0, 5)),
            distinction: score >= 90,
          },
        });
      }
    }
  }
  console.log("✓ B2C learners enrolled with payments, projects and activity");

  // ── B2B side — Demo Training Co ────────────────────────────────────
  const org = await db.organization.create({
    data: {
      name: "Demo Training Co",
      slug: "demo-training-co",
      plan: "team",
      seats: 40,
      logoUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="#1d4ed8"/><text x="64" y="82" font-family="sans-serif" font-size="56" font-weight="700" fill="#ffffff" text-anchor="middle">D</text></svg>',
        ),
      description:
        "Industrial training for engineering teams — HSE, electrical, mechanical and leadership programs built with real plant expertise.",
      address: "Lahore, Pakistan",
      website: "https://example.com",
    },
  });

  const asma = await makeUser(ORG_ADMIN, { createdAt: daysAgo(45) });
  await db.orgMember.create({
    data: { orgId: org.id, userId: asma.id, role: "admin", seat: true, status: "active" },
  });

  const orgInstructors: Record<string, { id: string }> = {};
  for (const p of ORG_INSTRUCTORS) {
    const u = await makeUser(p, { createdAt: daysAgo(range(30, 45)) });
    orgInstructors[p.email] = u;
    await db.orgMember.create({
      data: { orgId: org.id, userId: u.id, role: "mentor", seat: true, status: "active" },
    });
  }

  const orgCourses: Record<string, CourseRow> = {};
  for (const spec of COURSES.slice(4)) {
    const course = await makeCourse(spec, true);
    orgCourses[spec.key] = course;
    await db.orgCourse.create({ data: { orgId: org.id, courseId: course.id } });
    for (const email of ORG_COURSE_INSTRUCTORS[spec.key] ?? []) {
      await db.courseEnrollment.create({
        data: { userId: orgInstructors[email].id, courseId: course.id, role: "instructor" },
      });
    }
  }
  console.log("✓ Demo Training Co — 3 instructors, 6 courses in the org catalog");

  const orgLearners: { user: { id: string; name: string } }[] = [];
  for (const name of ORG_LEARNER_NAMES) {
    const neverLogsIn = chance(0.08);
    const u = await makeUser(
      { email: emailFor(name, ""), name, role: "learner" },
      {
        createdAt: daysAgo(range(10, 50)),
        lastLogin: neverLogsIn ? null : daysAgo(range(0, 6)),
      },
    );
    await db.orgMember.create({
      data: { orgId: org.id, userId: u.id, role: "member", seat: true, status: "active" },
    });
    orgLearners.push({ user: { id: u.id, name: u.name } });
  }

  // Org enrollment plan — every course ≥10 students, several multi-enrolled
  const orgPlan: Record<string, string[]> = {
    hse: ["Aisha Khan", "Hamza Ali", "Zainab Bibi", "Usman Tariq", "Maryam Javed", "Hassan Raza", "Sana Khalid", "Omar Farooq", "Iqra Saleem", "Fahad Mehmood", "Nimra Akhtar", "Danish Iqbal"],
    electrical: ["Ayesha Siddiqui", "Waqas Anwar", "Rabia Nasir", "Taimoor Malik", "Sadia Rehman", "Kamran Yusuf", "Hamza Ali", "Usman Tariq", "Maryam Javed", "Zubair Cheema", "Amna Riaz"],
    mechanical: ["Mahnoor Haider", "Saad Qureshi", "Laiba Shahid", "Arslan Baig", "Amna Riaz", "Zubair Cheema", "Hassan Raza", "Omar Farooq", "Nimra Akhtar", "Danish Iqbal", "Waqas Anwar", "Rabia Nasir"],
    hr: ["Aisha Khan", "Sadia Rehman", "Mahnoor Haider", "Laiba Shahid", "Maryam Javed", "Sana Khalid", "Iqra Saleem", "Fahad Mehmood", "Kamran Yusuf", "Saad Qureshi"],
    finance: ["Hamza Ali", "Zainab Bibi", "Ayesha Siddiqui", "Taimoor Malik", "Kamran Yusuf", "Mahnoor Haider", "Saad Qureshi", "Amna Riaz", "Zubair Cheema", "Arslan Baig"],
    "power-plant": ["Aisha Khan", "Hamza Ali", "Usman Tariq", "Hassan Raza", "Omar Farooq", "Waqas Anwar", "Rabia Nasir", "Danish Iqbal", "Nimra Akhtar", "Fahad Mehmood", "Taimoor Malik", "Ayesha Siddiqui"],
  };

  const finisherNames = new Set(["Aisha Khan", "Hamza Ali", "Zainab Bibi", "Sarah Ahmed", "Rehan Sheikh"]);
  const primaryCourses = new Set<string>();

  for (const [key, names] of Object.entries(orgPlan)) {
    const course = orgCourses[key];
    for (const name of names) {
      const learner = orgLearners.find((l) => l.user.name === name)!;
      await db.courseEnrollment.create({
        data: { userId: learner.user.id, courseId: course.id, role: "student" },
      });
      const primary = !primaryCourses.has(learner.user.id);
      if (primary) primaryCourses.add(learner.user.id);
      const arch: Archetype =
        learner.user.name === "Aisha Khan" ? "active"
          : finisherNames.has(learner.user.name) && key === "hse" ? "active"
            : chance(0.08) ? "never"
              : chance(0.12) ? "newly"
                : chance(0.12) ? "left"
                  : chance(0.1) ? "rare"
                    : "active";
      const finisher = finisherNames.has(learner.user.name) && (key === "hse" || key === "hr");
      await seedLearnerCourseData(learner.user, course, arch, { finisher, primary });
    }
  }

  // Certificates for org finishers (org-signed)
  for (const [name, courseKey] of [
    ["Aisha Khan", "hse"],
    ["Hamza Ali", "hse"],
    ["Zainab Bibi", "hr"],
    ["Usman Tariq", "electrical"],
  ] as const) {
    const learner = orgLearners.find((l) => l.user.name === name)!;
    const course = orgCourses[courseKey];
    const score = range(80, 97);
    await db.certificate.create({
      data: {
        userId: learner.user.id,
        courseId: course.id,
        courseName: course.name,
        studentName: name,
        grade: gradeOf(score),
        score,
        signedBy: org.name,
        orgId: org.id,
        verifyToken: crypto.randomBytes(32).toString("hex"),
        credentialId: `TRN-AI-2026-08-${name.split(" ").map((p) => p[0]).join("").toUpperCase()}-${score}`,
        issuedAt: daysAgo(range(1, 6)),
        distinction: score >= 90,
      },
    });
  }
  console.log("✓ org learners enrolled — active/newly/left/never/rare archetypes + finishers");

  // ── Assignments + submissions (fills the review queues) ─────────────
  const assignmentTitles: Record<string, string> = {
    hse: "Hazard walk report — photo evidence required",
    electrical: "Motor starter circuit exercise",
    mechanical: "Alignment worksheet + tool photos",
    hr: "Feedback conversation script",
    finance: "Monthly variance explanation memo",
    "power-plant": "Cold start checklist walkthrough",
    ebay: "First listing draft",
    seo: "Keyword map for one page",
    "phone-repair": "Screen swap photo log",
    freelance: "Gig description draft",
  };

  let assignmentCounter = 0;
  for (const [key, course] of Object.entries({ ...b2cCourses, ...orgCourses })) {
    const instructorId =
      key in orgCourses
        ? orgInstructors[(ORG_COURSE_INSTRUCTORS[key] ?? [])[0] ?? "instructor@demo.ai"].id
        : ali.id;
    const assignment = await db.assignment.create({
      data: {
        courseId: course.id,
        instructorId,
        title: assignmentTitles[key] ?? `Week deliverable — ${course.name}`,
        description: "Apply this week's lessons and submit evidence for mentor review.",
        instructions: "Submit your deliverable with a short written summary.",
        partTypesJson: ["text", "photo"],
        maxScore: 100,
        status: "published",
        dueDate: daysFromNow(range(2, 12)),
        week: Math.min(course.durationWeeks, 2),
      },
    });

    // Submissions from the engaged students of this course
    const enrolled = await db.courseEnrollment.findMany({
      where: { courseId: course.id, role: "student" },
      select: { userId: true },
    });
    let submitted = 0;
    for (const enr of enrolled) {
      if (submitted >= 8) break;
      if (chance(0.55)) continue;
      submitted++;
      assignmentCounter++;
      const status = chance(0.45) ? "in_review" : chance(0.25) ? "changes_requested" : "approved";
      const score = status === "approved" ? range(65, 96) : null;
      const submission = await db.submission.create({
        data: {
          assignmentId: assignment.id,
          userId: enr.userId,
          status,
          score,
          learnerSummary: pick([
            "Completed the exercise and attached photos of the process.",
            "Here's my deliverable — feedback welcome.",
            "Done the walk and logged the findings.",
          ]),
          submittedAt: daysAgo(range(0, 5)),
          reviewedAt: status === "approved" ? daysAgo(range(0, 3)) : null,
        },
      });
      await db.submissionPart.create({
        data: {
          submissionId: submission.id,
          type: "text",
          payloadJson: { text: "Deliverable summary from the learner." },
        },
      });
      if (status === "approved" || status === "changes_requested") {
        const thread = await db.feedbackThread.create({ data: { submissionId: submission.id } });
        await db.feedbackMsg.create({
          data: {
            threadId: thread.id,
            authorId: instructorId,
            authorName: "Course instructor",
            authorRole: "instructor",
            kind: "text",
            body:
              status === "approved"
                ? "Solid work — clear evidence and good application of the checklist."
                : "Good start — please add photos of the tool before I approve.",
          },
        });
        if (status === "approved") {
          await db.signOff.create({
            data: {
              submissionId: submission.id,
              signerId: instructorId,
              signerName: "Course instructor",
              signerRole: "instructor",
              order: 1,
              note: "Approved",
              decidedAt: daysAgo(range(0, 2)),
            },
          });
          await db.gradeEntry.create({
            data: {
              submissionId: submission.id,
              cycle: 1,
              graderId: instructorId,
              graderRole: "instructor",
              entriesJson: [{ criterionKey: "overall", level: "good", score, note: "Graded against the rubric." }],
              totalScore: score,
            },
          });
        }
      }
    }
  }
  console.log(`✓ ${assignmentCounter} submissions across course assignments (review queues are live)`);

  // ── Reviews ────────────────────────────────────────────────────────
  const reviewTexts = [
    "Practical, hands-on and the tutor answers fast. Recommended.",
    "Exactly what our team needed — the daily structure keeps you moving.",
    "Great content but the weekly test was tough. Worth it.",
    "The project made the difference — I can use this at work immediately.",
    "Clear lessons, real examples. The mentor feedback was the best part.",
    "Took me from zero to confident in a month.",
  ];
  for (const [key, course] of Object.entries({ ...b2cCourses, ...orgCourses })) {
    const enrolled = await db.courseEnrollment.findMany({
      where: { courseId: course.id, role: "student" },
      select: { userId: true },
      take: 6,
    });
    let ratingSum = 0;
    let count = 0;
    for (const enr of enrolled) {
      if (chance(0.4)) continue;
      const rating = range(4, 5);
      await db.courseReview.create({
        data: {
          userId: enr.userId,
          courseId: course.id,
          rating,
          title: pick(["Excellent course", "Very practical", "Exactly what I needed"]),
          content: pick(reviewTexts),
          helpful: range(0, 12),
          createdAt: daysAgo(range(2, 25)),
        },
      });
      ratingSum += rating;
      count++;
    }
    if (count > 0) {
      await db.course.update({
        where: { id: course.id },
        data: { rating: Math.round((ratingSum / count) * 10) / 10, reviewCount: count },
      });
    }
  }
  console.log("✓ course reviews + ratings");

  // ── Enrollment counts + instructor earnings ─────────────────────────
  for (const course of Object.values({ ...b2cCourses, ...orgCourses })) {
    const count = await db.courseEnrollment.count({ where: { courseId: course.id, role: "student" } });
    const payments = await db.payment.aggregate({
      where: { courseId: course.id },
      _sum: { platformFee: true, instructorShare: true },
    });
    await db.course.update({
      where: { id: course.id },
      data: {
        enrollmentCount: count,
        instructorEarnings: payments._sum.instructorShare ?? 0,
        platformFee: payments._sum.platformFee ?? 0,
      },
    });
  }
  console.log("✓ enrollment counts + revenue totals");

  // ── Messages — instructor outreach ─────────────────────────────────
  const welcomeMessages = [
    "Welcome aboard! I'm your course mentor — message me anytime you're stuck.",
    "Quick tip for this week: do the practice exercise right after the slides, before the daily test.",
    "Saw you hit a streak — keep it going, and don't skip the check-in!",
  ];
  for (const [key, course] of Object.entries({ ...b2cCourses, ...orgCourses })) {
    const enrolled = await db.courseEnrollment.findMany({
      where: { courseId: course.id, role: "student" },
      select: { userId: true },
      take: 10,
    });
    for (const enr of enrolled) {
      if (!chance(0.5)) continue;
      const fromId = key in orgCourses ? orgInstructors[(ORG_COURSE_INSTRUCTORS[key] ?? [])[0] ?? "instructor@demo.ai"].id : ali.id;
      const msg = await db.message.create({
        data: {
          fromId,
          toId: enr.userId,
          subject: `Welcome to ${course.name}`,
          body: pick(welcomeMessages),
          sentAt: daysAgo(range(1, 14)),
          isRead: chance(0.7),
        },
      });
      if (chance(0.25)) {
        await db.message.update({
          where: { id: msg.id },
          data: {
            reply: "Thanks! I'll reach out if I get stuck on the weekly test.",
            repliedAt: daysAgo(range(0, 7)),
          },
        });
      }
    }
  }
  console.log("✓ mentor messages with replies");

  // ── Badges for learners ────────────────────────────────────────────
  const allLearners = [...b2cLearners, ...orgLearners];
  for (const l of allLearners) {
    const profiles = await db.learnProfile.findMany({
      where: { userId: l.user.id },
      select: { totalXP: true, streakLongest: true, courseId: true },
    });
    if (profiles.length === 0) continue;
    const xp = Math.max(...profiles.map((p) => p.totalXP));
    const streak = Math.max(...profiles.map((p) => p.streakLongest));
    if (xp > 0) {
      await db.userBadge.create({
        data: { userId: l.user.id, badgeId: badgeRows.first_lesson },
      });
    }
    if (streak >= 7) {
      await db.userBadge.create({
        data: { userId: l.user.id, badgeId: badgeRows.streak_7 },
      });
    }
    if (xp >= 400) {
      await db.userBadge.create({
        data: { userId: l.user.id, badgeId: badgeRows.week_complete },
      });
    }
    const hasProject = await db.learnProject.count({ where: { userId: l.user.id } });
    if (hasProject > 0) {
      await db.userBadge.create({
        data: { userId: l.user.id, badgeId: badgeRows.project_started },
      });
    }
  }
  console.log("✓ learner badges awarded");

  // ── Org audit trail + platform activity ────────────────────────────
  const admin = await db.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
  const audit = [
    { actorId: asma.id, actor: "Dr. Asma Rauf", role: "org_admin", action: "org_settings_updated", target: "org", detail: "branding + organization profile" },
    { actorId: asma.id, actor: "Dr. Asma Rauf", role: "org_admin", action: "org_catalog_course_added", target: "org", detail: "linked 6 courses" },
    { actorId: orgInstructors["instructor@demo.ai"].id, actor: "Sir Saeed Khan", role: "instructor", action: "certificate_generated", target: "user", detail: "Aisha Khan — HSE" },
    { actorId: orgInstructors["fatima.noor@demo.ai"].id, actor: "Fatima Noor", role: "instructor", action: "certificate_generated", target: "user", detail: "Usman Tariq — Electrical" },
    { actorId: orgInstructors["bilal.ahmed@demo.ai"].id, actor: "Bilal Ahmed", role: "instructor", action: "certificate_generated", target: "user", detail: "Zainab Bibi — HR" },
    { actorId: ali.id, actor: "Ali Raza", role: "instructor", action: "course_published", target: "course", detail: "Mobile Phone Repair Masterclass" },
    { actorId: admin.id, actor: "Platform Administrator", role: "platform_admin", action: "user_approved", target: "user", detail: "batch approval" },
  ];
  for (const a of audit) {
    await db.auditLog.create({
      data: {
        actorUserId: a.actorId,
        actorName: a.actor,
        actorRole: a.role,
        action: a.action,
        targetType: a.target,
        targetId: "seed",
        metadata: JSON.stringify({ detail: a.detail }),
        ipAddress: "127.0.0.1",
        createdAt: daysAgo(range(0, 14)),
      },
    });
  }
  // Recent logins so platform "Recent activity" looks alive
  for (const l of allLearners.slice(0, 8)) {
    await db.auditLog.create({
      data: {
        actorUserId: l.user.id,
        actorName: l.user.name,
        actorRole: "learner",
        action: "user_logged_in",
        targetType: "user",
        targetId: l.user.id,
        metadata: "{}",
        ipAddress: "127.0.0.1",
        createdAt: daysAgo(range(0, 2)),
      },
    });
  }
  console.log("✓ audit trail");

  // ── AI usage log — fills the platform AI panel ─────────────────────
  const features = ["daily_test_grading", "tutor_chat", "slide_generation", "weekly_test", "project_help"];
  for (let i = 0; i < 60; i++) {
    const provider = chance(0.7) ? "zai" : "deepseek";
    await db.aIUsageLog.create({
      data: {
        provider,
        model: provider === "zai" ? "z1" : "deepseek-chat",
        feature: pick(features),
        promptTokens: range(200, 2200),
        completionTokens: range(80, 900),
        totalTokens: 0,
        success: chance(0.94),
        durationMs: range(300, 4200),
        createdAt: daysAgo(range(0, 13)),
      },
    }).catch(() => {});
  }
  console.log("✓ AI usage history");

  // ── Summary ─────────────────────────────────────────────────────────
  const totals = {
    users: await db.user.count(),
    courses: await db.course.count(),
    enrollments: await db.courseEnrollment.count({ where: { role: "student" } }),
    submissions: await db.submission.count(),
    projects: await db.learnProject.count(),
    payments: await db.payment.count(),
    certificates: await db.certificate.count(),
  };

  console.log("\n══════════════════════════════════════════════════");
  console.log("  DEMO DATASET READY — local SQLite (prisma/db/custom.db)");
  console.log("══════════════════════════════════════════════════");
  console.log(`  ${totals.users} users · ${totals.courses} courses · ${totals.enrollments} enrollments`);
  console.log(`  ${totals.submissions} submissions · ${totals.projects} projects · ${totals.payments} payments · ${totals.certificates} certificates`);
  console.log("");
  console.log("  B2C — independent instructor (marketplace):");
  console.log("    ali.raza@demo.ai / demo123  (4 paid courses)");
  console.log("    b2c.sarah.ahmed@demo.ai / demo123  (marketplace learner)");
  console.log("  B2B — Demo Training Co (org):");
  console.log("    orgadmin@demo.ai / demo123  (org admin)");
  console.log("    instructor@demo.ai / demo123  (Sir Saeed Khan — HSE + Power Plant)");
  console.log("    fatima.noor@demo.ai / demo123  (Electrical + Mechanical)");
  console.log("    bilal.ahmed@demo.ai / demo123  (HR + Finance)");
  console.log("    learner@demo.ai / demo123  (Aisha Khan — org learner)");
  console.log("  Platform:");
  console.log("    admin@examiner.ai / admin123");
  console.log("══════════════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("seed-demo-data failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
