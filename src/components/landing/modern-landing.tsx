"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, Sparkles, ArrowRight, ShieldCheck, Users, Brain,
  BarChart3, MessageSquare, Bell, BookOpen, Target, Zap, CheckCircle2,
  Menu, X, Clock, TrendingUp, Building2, AlertTriangle, HeartPulse,
  FileText, Award, Bot, Lightbulb, LineChart, ClipboardCheck,
  GitBranch, Lock, Database, Cpu, Eye, MessageCircle, Calendar,
  CheckSquare, Star, Activity, Layers, ScrollText, Scale, Gauge,
  Compass, ShieldAlert, Repeat, Workflow, Palette, Moon, Sun,
  ChevronRight, Quote, Rocket, Flag, GanttChartSquare, KanbanSquare,
  Code2, Briefcase, Presentation,
} from "lucide-react";

// ============================================================
// 6 ROLES — every role now has its own dedicated dashboard
// (the previous landing page was missing Counselor + Guardian)
// ============================================================
const ROLES = [
  {
    id: "student",
    label: "Student",
    icon: GraduationCap,
    accent: "from-blue-500 to-cyan-500",
    chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    screenshot: "/screenshots/dashboard-student.png",
    tagline: "Build a real project. Learn by doing.",
    desc: "Define a capstone project on day one. AI generates weekly tasks + milestones. Daily check-ins, Socratic tests, AI Tutor that teaches today's topic in your language. Gantt chart, weekly reports, certificates.",
    stats: [
      { label: "Capstone", value: "Mandatory" },
      { label: "AI tutor", value: "Multi-lang" },
      { label: "Tasks/week", value: "5 AI-gen" },
    ],
  },
  {
    id: "teacher",
    label: "Teacher",
    icon: BookOpen,
    accent: "from-emerald-500 to-teal-500",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    screenshot: "/screenshots/dashboard-teacher.png",
    tagline: "See every student. Know what to do next.",
    desc: "Batch dashboard with attention-scored triage queue, 7-dimension psychology per student, GROW coaching tools, AI Assistant for natural-language batch queries, automated alerts.",
    stats: [
      { label: "Attention score", value: "Auto" },
      { label: "Psych dimensions", value: "7" },
      { label: "Coaching model", value: "GROW" },
    ],
  },
  {
    id: "counselor",
    label: "Counsellor",
    icon: Brain,
    accent: "from-rose-500 to-pink-500",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    screenshot: "/screenshots/dashboard-counselor.png",
    tagline: "A command center for wellbeing.",
    desc: "Institution-wide caseload with green/amber/red wellbeing tiers, crisis flag management, mentorship touchpoints, case reviews, and scoped access (wellbeing only, no curriculum leak).",
    stats: [
      { label: "Wellbeing tiers", value: "3" },
      { label: "Crisis response", value: "Now" },
      { label: "Scope", value: "Strict" },
    ],
  },
  {
    id: "guardian",
    label: "Guardian",
    icon: HeartPulse,
    accent: "from-fuchsia-500 to-purple-500",
    chip: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
    screenshot: "/screenshots/dashboard-guardian.png",
    tagline: "Parents see progress. Not noise.",
    desc: "A clean, parent-friendly view of their child's academic progress, attendance, report cards, and wellbeing signals — without exposing internal psych evidence or teacher notes.",
    stats: [
      { label: "Report cards", value: "Auto" },
      { label: "Wellbeing signal", value: "Tier" },
      { label: "Internal notes", value: "Hidden" },
    ],
  },
  {
    id: "principal",
    label: "Principal",
    icon: Building2,
    accent: "from-purple-500 to-indigo-500",
    chip: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    screenshot: "/screenshots/dashboard-principal.png",
    tagline: "Run the institution on signal, not gut.",
    desc: "Institution-wide analytics: academic performance distribution, teacher load tiers, safeguarding flags, audit log, wellbeing trends. The only role that sees safeguarding flags against teachers.",
    stats: [
      { label: "Teacher load", value: "Tiered" },
      { label: "Audit log", value: "Full" },
      { label: "Safeguarding", value: "Exclusive" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    accent: "from-slate-600 to-slate-800",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
    screenshot: "/screenshots/dashboard-admin.png",
    tagline: "Total platform control.",
    desc: "User management, course CRUD, feature flags, AI provider config, access grants, password resets, cache management, system health, audit log — everything operations needs.",
    stats: [
      { label: "Feature flags", value: "Toggle" },
      { label: "AI providers", value: "Multi" },
      { label: "Audit", value: "All" },
    ],
  },
];

// ============================================================
// AI ASSISTANT — 7 sections (was missing from old landing page)
// ============================================================
const AI_SECTIONS = [
  {
    num: "01",
    icon: Compass,
    title: "Scope Resolver",
    desc: "Every AI query is scoped BEFORE the call. Teachers see only their batch. Counselors see wellbeing only. Principals see everything. The AI never receives data outside the caller's scope.",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  },
  {
    num: "02",
    icon: Gauge,
    title: "Data Efficiency",
    desc: "Per-entity summaries cached 7 days. Aggregate-first queries return counts and distributions, never raw records. Soft query budget per role. Max 50 raw records per AI call.",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    num: "03",
    icon: TrendingUp,
    title: "Escalation Engine",
    desc: "Amber flags unresolved 7+ days auto-escalate to red. Repeat occurrences escalate faster (3rd = immediate, 2nd = 2-day timer). Runs as scheduled job + on-write check.",
    color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  },
  {
    num: "04",
    icon: MessageSquare,
    title: "Action Dialog",
    desc: "One reusable dialog for every flag type. AI-drafted headline, why, suggested action, 3 one-tap note presets. Confirm disabled until note provided. Cancel always available.",
    color: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30",
  },
  {
    num: "05",
    icon: ShieldAlert,
    title: "Safeguarding Mode",
    desc: "Deterministic pre-filter first, AI explains candidates. Requires 2+ corroborating signals — never a single message. Flags go to principal scope only. Teacher is NOT notified. Dismissed, not deleted.",
    color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
  },
  {
    num: "06",
    icon: Scale,
    title: "Teacher Load",
    desc: "loadScore = students × 1 + batches × 15 + alerts × 5 + crisis × 25 + overdue × 3. Green < 50, amber 50-99, red ≥ 100. Co-teacher suggestions NEVER propose amber/red candidates.",
    color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
  },
  {
    num: "07",
    icon: Lightbulb,
    title: "In-Action Teaching",
    desc: "Per-flag-type guidance: psychological → 'Ask don't tell'. Educational → 'Process not outcome'. Mentorship → 'Reality before Goal'. Safeguarding → 'Review evidence'. Crisis → 'Act now, document after'.",
    color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
  },
];

// ============================================================
// MENTORSHIP & MENTAL HEALTH — the human cycle that closes the loop
// AI surfaces signal. Humans provide judgment. Every action is audited.
// See docs/PSYCHOLOGICAL-CYCLE.md and docs/MENTORSHIP-CYCLE.md.
// ============================================================
const PSYCH_CYCLE_STAGES = [
  {
    num: "1",
    icon: MessageCircle,
    title: "Observe",
    short: "Every interaction",
    desc: "AI Tutor chat, daily tests, weekly tests, project reports — every student interaction is a data point. Real-time heuristic analysis (mood, engagement, frustration, avoidance) runs in <1ms with no AI call.",
    color: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-600",
  },
  {
    num: "2",
    icon: Brain,
    title: "Analyze",
    short: "7 dimensions, every test",
    desc: "After every test, the pipeline writes 7 PsychEvidence rows — calibration, explanatory depth, gaming pattern, attribution, cognitive load, SRL phase, fluency. Grounded in Dunning-Kruger, Sweller, Zimmerman, Dweck, Fredericks.",
    color: "from-fuchsia-500/10 to-purple-500/10",
    iconColor: "text-fuchsia-600",
  },
  {
    num: "3",
    icon: Activity,
    title: "Tier",
    short: "Green / amber / red",
    desc: "14-day rolling window of evidence is reduced to a single wellbeing tier. >60% concerning signals = red. Any open crisis flag = red. Trajectory, not snapshot — a single bad day doesn't trigger anything.",
    color: "from-amber-500/10 to-rose-500/10",
    iconColor: "text-amber-600",
  },
  {
    num: "4",
    icon: Bell,
    title: "Alert",
    short: "Attention-scored triage",
    desc: "Students auto-ranked by who needs help most. Attention score = inactivity (3d = +30) + score drop (+20) + low confidence (+20) + blocked tasks (+10) + high cognitive load (+15). Tier transitions auto-create touchpoints.",
    color: "from-rose-500/10 to-pink-500/10",
    iconColor: "text-rose-600",
  },
  {
    num: "5",
    icon: TrendingUp,
    title: "Escalate",
    short: "Amber → red, intelligently",
    desc: "One engine, two triggers: amber unresolved 7+ days → red. 3rd repeat occurrence → immediate red. 2nd repeat → shortened 2-day timer. Applies to wellbeing, safeguarding, teacher load — all flag sources.",
    color: "from-purple-500/10 to-indigo-500/10",
    iconColor: "text-purple-600",
  },
  {
    num: "6",
    icon: Target,
    title: "Mentor",
    short: "GROW coaching + AI-drafted action",
    desc: "AI Assistant drafts: headline, why, suggested action, 3 one-tap note presets. Confirm disabled until teacher writes a note. Session recorded as MentorshipTouchpoint with outcome + follow-up. Every intervention auditable.",
    color: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-600",
  },
];

const SAFEGUARDING_PRINCIPLES = [
  {
    icon: ShieldAlert,
    title: "Deterministic pre-filter first",
    desc: "Regex patterns scan every teacher-to-student message. The AI never raises a flag on its own — the regex must match first. False negatives acceptable; false positives not.",
  },
  {
    icon: Users,
    title: "Two-plus corroboration required",
    desc: "A single message never produces a flag. Two corroborating signals in a 14-day window, same category, same teacher — only then is a flag created. Prevents reactive flags from heated exchanges.",
  },
  {
    icon: Lock,
    title: "Principal-only visibility",
    desc: "Safeguarding flags about a teacher go to principal scope only. The teacher is NOT notified. The one deliberate exception to 'insight stays with caller' — student safety outranks teacher transparency.",
  },
  {
    icon: ScrollText,
    title: "Dismissed, not deleted",
    desc: "A principal who reviews and dismisses a flag marks it dismissed with a required note. The flag persists in the audit trail permanently. Patterns can be reviewed historically.",
  },
];

const PSYCH_DIMENSIONS = [
  { num: "1", name: "Calibration", desc: "Does the student know what they know? (Dunning-Kruger gap.)", icon: Target, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  { num: "2", name: "Explanatory Depth", desc: "Surface answers vs. step-by-step reasoning.", icon: Lightbulb, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
  { num: "3", name: "Gaming Pattern", desc: "Voice-inconsistency detection flags AI-generated answers.", icon: Eye, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30" },
  { num: "4", name: "Attribution / Mindset", desc: "Growth vs. fixed mindset, with avoidance detection.", icon: Brain, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
  { num: "5", name: "Cognitive Load", desc: "Is the material at the edge of ability (Sweller)?", icon: Cpu, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30" },
  { num: "6", name: "SRL Phase", desc: "Forethought → Performance → Reflection (Zimmerman).", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  { num: "7", name: "Fluency / Retention", desc: "Improving, stable, or declining recall during a test.", icon: Activity, color: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30" },
];

const THEMES = [
  { name: "Modern Slate", desc: "Slate-900 primary, amber accents.", colors: ["#0f172a", "#f59e0b", "#f8fafc"] },
  { name: "Ocean Blue", desc: "Google-blue primary, teal accents.", colors: ["#1a73e8", "#0d9488", "#f0f9ff"] },
  { name: "Forest Sage", desc: "Sage green primary, earth tones.", colors: ["#4d7c0f", "#92400e", "#f7fee7"] },
  { name: "Sunset Rose", desc: "Rose primary, amber accents.", colors: ["#e11d48", "#f59e0b", "#fff1f2"] },
];

const PLATFORM_FEATURES = [
  { icon: Bot, title: "Multi-Provider AI", desc: "DeepSeek V4 Flash (primary, cheap + fast), Z.ai (fallback), z-ai-web-dev-sdk (sandbox). Automatic failover. Token cache for repeat calls." },
  { icon: ShieldCheck, title: "7-Role RBAC", desc: "Granular permissions with IDOR protection, AccessGrant scoping (full / wellbeing_only / crisis_only / content_only), and rate limiting per role." },
  { icon: Database, title: "Lightweight Telemetry", desc: "1 DB upsert per AI Tutor message (not 15-20). Scales to 10,000+ students without DB flooding. Best-effort pipelines never block UX." },
  { icon: Bell, title: "Automated Alert Engine", desc: "Psychological, educational, and mentorship alerts fire automatically on threshold crossings. 7-day amber timer + repeat-occurrence escalation." },
  { icon: ScrollText, title: "Audit & Compliance", desc: "Every sensitive action logged: role changes, approvals, blocks, grants, AI key changes. Full audit trail for institutional compliance." },
  { icon: Palette, title: "Live Theme System", desc: "4 preset themes switchable from the sidebar — applied instantly via CSS variables. Modern Slate, Ocean Blue, Forest Sage, Sunset Rose." },
];

const STUDENT_FEATURES = [
  { icon: GitBranch, title: "Capstone Project Planning", desc: "Define your project on day one. AI generates N weeks × 5 tasks/week with milestones, daily schedule, and time estimates. Gantt chart + per-week summaries + final capstone analysis." },
  { icon: Bot, title: "AI Tutor", desc: "Friendly chatbot that teaches today's topic in your language, connects every concept to your capstone project, and handles disengagement with empathy." },
  { icon: ClipboardCheck, title: "Socratic Daily Test", desc: "3-question check-in on today's topic with confidence self-rating. Per-question explanations revealed immediately, not at end-of-test." },
  { icon: FileText, title: "Weekly Test + Project Report", desc: "15-question Socratic exam with plagiarism analysis + 7-dimension psychology. Plus weekly project report analyzed on 4 dimensions: understanding, depth, progress, clarity." },
  { icon: Lightbulb, title: "Per-Question Explanations", desc: "Correct answer, why it's correct, specific encouragement — immediately after every question. Learn from every question." },
  { icon: GanttChartSquare, title: "Gantt + Milestones", desc: "Visual timeline of all project tasks. Milestones highlighted. Always know where you are vs. where you should be." },
  { icon: Award, title: "Report Cards & Certificates", desc: "Auto-generated from test scores (80% weekly + 20% practice) + final capstone analysis. Certificates are publicly verifiable via shareable URL." },
  { icon: Calendar, title: "Daily Check-in + Ask My Teacher", desc: "Confidence rating + learning reflection every day. Floating button for quick questions to your assigned teacher." },
];

const TEACHER_FEATURES = [
  { icon: GitBranch, title: "Project Progress Visibility", desc: "See every student's capstone progress at a glance. Tasks completed, milestones hit, blocked items, weekly report scores. No more 'are they on track?' guesswork." },
  { icon: Users, title: "Attention-Scored Triage", desc: "Students auto-ranked by who needs help most: inactivity, score drops, low confidence, blocked tasks, high cognitive load. The batch tells you who to talk to today." },
  { icon: Brain, title: "7-Dimension Psychology", desc: "Calibration, explanatory depth, gaming pattern, attribution, cognitive load, SRL phase, fluency — with concrete teacher actions per dimension." },
  { icon: Target, title: "GROW Mentorship", desc: "Structured coaching: Goal, Reality, Options, Will. Alert-driven actions, outcome tracking, follow-up scheduling. AI-drafted check-in messages." },
  { icon: Bot, title: "AI Assistant", desc: "Natural-language batch queries: 'Who's likely to drop off?' — answered from existing data with cited student evidence. Scope-aware: teachers only see their batch." },
  { icon: Bell, title: "Automated Alerts", desc: "Psych / educational / mentorship alerts fire automatically when students cross thresholds. Action dialog with AI-drafted notes. 7-day amber timer + escalation engine." },
  { icon: BookOpen, title: "Course Planner", desc: "Course CRUD, batch assignment, AI course generation. Full curriculum control with weekly phase + daily topic structure." },
  { icon: BarChart3, title: "Final Project Analysis", desc: "Trigger comprehensive AI capstone evaluation: execution, technical competence, quality, career readiness. Auto-generates strengths, weaknesses, recommendations." },
];

const TRUST_STATS = [
  { value: "6", label: "Role dashboards" },
  { value: "7", label: "Psych dimensions" },
  { value: "0", label: "MCQs (Socratic)" },
  { value: "44+", label: "Data models" },
];

// ============================================================
// PROJECT-BASED LEARNING — the differentiator
// Bootcamps teach by building. This is what an LMS can't do.
// ============================================================
const PROJECT_LOOP = [
  {
    num: "01",
    icon: Briefcase,
    title: "Day 1: Define the capstone",
    desc: "Student describes their project — name, type (web app / mobile / data pipeline / research paper), scope, objectives, requirements, business case. The AI generates a project summary + key features.",
    color: "from-amber-500/10 to-rose-500/10",
    iconColor: "text-amber-600",
  },
  {
    num: "02",
    icon: Bot,
    title: "AI generates the plan",
    desc: "The AI reads the project definition and generates N weeks × 5 tasks/week — each with description, scheduled day (Mon-Fri), estimated time, and a `isMilestone` flag for key deliverables. Plus per-week titles + summaries + milestones.",
    color: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-600",
  },
  {
    num: "03",
    icon: Calendar,
    title: "Daily task execution",
    desc: "Every day the student sees today's task alongside today's topic. They move tasks through planned → in-progress → completed | blocked. Status updates feed the teacher's attention-score algorithm.",
    color: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-600",
  },
  {
    num: "04",
    icon: GanttChartSquare,
    title: "Gantt + milestones",
    desc: "Visual timeline of all tasks across all weeks. Milestone tasks are highlighted. Students always see where they are vs. where they should be — no more 'am I on track?' anxiety.",
    color: "from-purple-500/10 to-indigo-500/10",
    iconColor: "text-purple-600",
  },
  {
    num: "05",
    icon: FileText,
    title: "Weekly project reports",
    desc: "Student submits a short weekly report: what they did, what blocked them, what's next. The AI analyzes it on 4 dimensions — project understanding, technical depth, progress, clarity — and returns score + strengths + weaknesses + feedback.",
    color: "from-rose-500/10 to-pink-500/10",
    iconColor: "text-rose-600",
  },
  {
    num: "06",
    icon: Award,
    title: "Final capstone analysis",
    desc: "At course end, the teacher triggers a comprehensive AI analysis: project execution, technical competence, project quality, career readiness. This becomes the basis for the certificate and the student's portfolio.",
    color: "from-fuchsia-500/10 to-purple-500/10",
    iconColor: "text-fuchsia-600",
  },
];

const PROJECT_METRICS = [
  { icon: KanbanSquare, label: "Tasks per project", value: "N × 5" },
  { icon: Flag, label: "Milestone tracking", value: "Built-in" },
  { icon: GanttChartSquare, label: "Visual timeline", value: "Gantt" },
  { icon: Bot, label: "AI-analyzed reports", value: "Weekly" },
];

// ============================================================
// SOCRATIC TESTING — the anti-MCQ assessment philosophy
// Three test types, one Socratic method, 7-dimension psych per test
// ============================================================
const TEST_TYPES = [
  {
    icon: Lightbulb,
    name: "Practice Test",
    cadence: "On demand",
    questions: "1 question, 4 pillars rotated",
    desc: "Low-stakes formative practice. Four Socratic pillars rotate: Why Probe, Break-It, Client Translation, Edge Case. No scoring pressure — just learning.",
    accent: "from-amber-500/10 to-rose-500/10",
    iconColor: "text-amber-600",
  },
  {
    icon: ClipboardCheck,
    name: "Daily Test",
    cadence: "Every day",
    questions: "3 Socratic questions",
    desc: "3-question check-in on today's topic with per-question confidence self-rating. The calibration signal flows directly into the 7-dimension pipeline.",
    accent: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-600",
  },
  {
    icon: FileText,
    name: "Weekly Test",
    cadence: "End of week",
    questions: "15 Socratic questions, max 5 replies each",
    desc: "The full psychological snapshot. AI probes reasoning, evaluates with plagiarism analysis, and produces psychAnalysis + examinerComment + 7-dimension evidence.",
    accent: "from-fuchsia-500/10 to-purple-500/10",
    iconColor: "text-fuchsia-600",
  },
];

const SOCRATIC_PRINCIPLES = [
  { icon: MessageCircle, title: "AI probes, never tells", desc: "The chatbot never gives the answer. It asks 'Why?', 'How would you explain this to a peer?', 'What if the requirement changed?'" },
  { icon: Lightbulb, title: "Per-question explanations", desc: "Correct answer + why it's correct + specific encouragement — revealed immediately after every question, not at end-of-test." },
  { icon: Eye, title: "Plagiarism + voice analysis", desc: "Voice-inconsistency detection flags AI-generated answers. Vocabulary jumps + AI-typical phrasing patterns caught on every weekly test." },
  { icon: Brain, title: "7 dimensions per test", desc: "Every test writes 7 PsychEvidence rows — calibration, depth, gaming, attribution, cognitive load, SRL phase, fluency. Always." },
];

const GROW_STEPS = [
  { letter: "G", title: "Goal", desc: "What does the student want to achieve?", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { letter: "R", title: "Reality", desc: "Where are they now? What is the current situation?", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  { letter: "O", title: "Options", desc: "What approaches, strategies, and resources are available?", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  { letter: "W", title: "Will", desc: "What will the student commit to doing next?", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
];

// ============================================================
// Browser mockup frame — wraps every screenshot for that
// "real product" feel.
// ============================================================
function BrowserFrame({
  src,
  alt,
  url = "examiner.ai/app",
  className = "",
}: {
  src: string;
  alt: string;
  url?: string;
  className?: string;
}) {
  return (
    <div className={`relative rounded-xl overflow-hidden border shadow-2xl bg-background ${className}`}>
      <div className="h-9 bg-slate-100 dark:bg-slate-800 border-b flex items-center px-4 gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="ml-3 text-xs text-muted-foreground font-mono truncate">{url}</div>
      </div>
      <img src={src} alt={alt} className="w-full h-auto block" />
    </div>
  );
}

// ============================================================
// Animated counter — counts up when scrolled into view
// ============================================================
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { threshold: 0.2 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export function ModernLanding() {
  const [activeRole, setActiveRole] = useState(1); // start on Teacher (most impressive)
  const [mobileNav, setMobileNav] = useState(false);
  const { ref: heroRef, inView: heroIn } = useInView<HTMLDivElement>();

  // Auto-rotate role showcase every 6 seconds (pauses on hover handled by user click)
  useEffect(() => {
    const t = setInterval(() => {
      setActiveRole(r => (r + 1) % ROLES.length);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-background antialiased">
      {/* ============================================ */}
      {/* NAV */}
      {/* ============================================ */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center transition-transform group-hover:scale-105">
              <GraduationCap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight tracking-tight">ExaminerAI</div>
              <div className="text-[10px] text-muted-foreground leading-tight">AI-Powered Bootcamp Management</div>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#big-idea" className="text-muted-foreground hover:text-foreground transition-colors">Why</a>
            <a href="#projects" className="text-muted-foreground hover:text-foreground transition-colors">Projects</a>
            <a href="#testing" className="text-muted-foreground hover:text-foreground transition-colors">Testing</a>
            <a href="#dashboards" className="text-muted-foreground hover:text-foreground transition-colors">Roles</a>
            <a href="#mentorship" className="text-muted-foreground hover:text-foreground transition-colors">Mentorship</a>
            <a href="#psychology" className="text-muted-foreground hover:text-foreground transition-colors">Psychology</a>
            <a href="#tech" className="text-muted-foreground hover:text-foreground transition-colors">Platform</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
            </Link>
            <Link href="/app">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm">
                <Sparkles className="w-4 h-4 mr-1.5" /> Try Demo
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {mobileNav && (
          <div className="md:hidden border-t bg-background px-4 py-3 space-y-2 text-sm">
            <a href="#big-idea" onClick={() => setMobileNav(false)} className="block py-1.5">Why</a>
            <a href="#projects" onClick={() => setMobileNav(false)} className="block py-1.5">Projects</a>
            <a href="#testing" onClick={() => setMobileNav(false)} className="block py-1.5">Testing</a>
            <a href="#dashboards" onClick={() => setMobileNav(false)} className="block py-1.5">Roles</a>
            <a href="#mentorship" onClick={() => setMobileNav(false)} className="block py-1.5">Mentorship</a>
            <a href="#psychology" onClick={() => setMobileNav(false)} className="block py-1.5">Psychology</a>
            <a href="#themes" onClick={() => setMobileNav(false)} className="block py-1.5">Themes</a>
            <a href="#tech" onClick={() => setMobileNav(false)} className="block py-1.5">Platform</a>
            <Link href="/app" className="block">
              <Button variant="outline" size="sm" className="w-full">Sign in</Button>
            </Link>
          </div>
        )}
      </header>

      {/* ============================================ */}
      {/* HERO — split layout, mockup on right */}
      {/* ============================================ */}
      <section id="top" className="relative overflow-hidden bg-slate-950 text-white">
        {/* Aurora background */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 lg:px-8 py-16 lg:py-24 relative">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left: copy */}
            <div ref={heroRef} className="lg:col-span-6 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                For software bootcamps &amp; short courses · Up to 6 months
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
                AI teaches.
                <span className="block bg-gradient-to-r from-amber-300 via-rose-300 to-fuchsia-300 bg-clip-text text-transparent">
                  Students build.
                </span>
                <span className="block">We understand every mind.</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed">
                ExaminerAI is the AI-powered bootcamp platform where students learn software by building real capstone projects. The AI teaches, the Socratic test chatbot probes reasoning — <span className="text-amber-300 font-medium">never MCQs</span> — and a 7-dimension psychological cycle turns every interaction into mentorship-grade insight. Teachers mentor at scale. Institutions see signal, not noise.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <Link href="/app">
                  <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white text-base h-12 px-6 shadow-lg shadow-amber-500/20">
                    <Sparkles className="w-5 h-5 mr-2" /> Launch Live Demo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="#projects">
                  <Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white text-base h-12 px-6">
                    See how projects work
                  </Button>
                </Link>
              </div>

              {/* Stats — counted up */}
              <div className="grid grid-cols-4 gap-4 pt-8 border-t border-white/10">
                {TRUST_STATS.map((s, i) => (
                  <div key={s.label} className={heroIn ? "transition-all duration-700" : "opacity-0"} style={{ transitionDelay: `${i * 100}ms` }}>
                    <div className="text-2xl md:text-3xl font-bold text-amber-300">{s.value}</div>
                    <div className="text-[10px] md:text-xs text-slate-400 mt-1 leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: rotating role screenshot */}
            <div className="lg:col-span-6 relative">
              <div className="absolute -inset-6 bg-gradient-to-r from-amber-500/30 via-rose-500/20 to-fuchsia-500/30 rounded-3xl blur-3xl" />
              <div className="relative">
                <BrowserFrame
                  src={ROLES[activeRole].screenshot}
                  alt={`${ROLES[activeRole].label} dashboard`}
                  url={`examiner.ai/app · ${ROLES[activeRole].id}`}
                  className="ring-1 ring-white/20"
                />
                {/* Floating role chip */}
                <div className="absolute -top-4 -right-4 hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold shadow-xl">
                  {(() => { const Icon = ROLES[activeRole].icon; return <Icon className="w-4 h-4" />; })()}
                  {ROLES[activeRole].label} view
                </div>
                {/* Floating AI badge */}
                <div className="absolute -bottom-4 -left-4 hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400 text-amber-950 text-xs font-semibold shadow-xl">
                  <Code2 className="w-3.5 h-3.5" /> AI teaches · Students build
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom marquee of role tabs */}
        <div className="border-t border-white/10 bg-slate-950/50 backdrop-blur">
          <div className="container mx-auto px-4 lg:px-8 py-4 overflow-x-auto">
            <div className="flex items-center gap-3 min-w-max">
              <span className="text-xs text-slate-500 uppercase tracking-wider mr-2">Switch role:</span>
              {ROLES.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRole(i)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm transition-all ${
                    activeRole === i
                      ? `bg-gradient-to-r ${r.accent} text-white shadow-md`
                      : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <r.icon className="w-3.5 h-3.5" />
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* TRUSTED BY */}
      {/* ============================================ */}
      <section className="border-b bg-muted/30 py-10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center md:text-left">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Built &amp; operated by</span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-amber-400 font-bold text-lg shadow-sm">
                iE
              </div>
              <div>
                <div className="text-sm font-semibold">Inzet Enterprises</div>
                <div className="text-xs text-muted-foreground">Software bootcamp platform · 6-month cohorts · Socratic assessment + AI mentorship</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* BIG IDEA — 3 convictions */}
      {/* ============================================ */}
      <section id="big-idea" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mb-14">
            <Badge variant="outline" className="mb-3">Why ExaminerAI exists</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Software skills are learned by building.<br />
              <span className="text-muted-foreground">Not by watching videos.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Three convictions define the platform. Together they let one teacher mentor 50–500+ students without burning out — and let bootcamp owners see exactly what's happening across every cohort, in real time.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                icon: Rocket,
                title: "Build first. Always.",
                desc: "Every student defines a capstone project on day one. The AI generates a custom week-by-week task plan with milestones, daily tasks, and a Gantt chart. No more 'watch this video, take this quiz'. Students learn software by building software — and we track every step.",
                gradient: "from-amber-500/10 to-rose-500/10",
                iconColor: "text-amber-600",
              },
              {
                num: "02",
                icon: Bot,
                title: "AI is the teacher. Humans mentor.",
                desc: "The AI Tutor teaches today's topic in the student's own language, connects every concept to their capstone project, and handles disengagement with empathy. Teachers don't deliver content — they triage, coach, and unblock. One teacher can now support cohorts that would have been impossible before.",
                gradient: "from-blue-500/10 to-cyan-500/10",
                iconColor: "text-blue-600",
              },
              {
                num: "03",
                icon: LineChart,
                title: "Institutions need signal, not noise.",
                desc: "Six role-specific dashboards. Automated alerts that escalate intelligently. A natural-language AI Assistant that answers 'who's likely to drop off?' in seconds. Every role gets exactly the signal they need — without drowning in data or flooding the database.",
                gradient: "from-fuchsia-500/10 to-purple-500/10",
                iconColor: "text-fuchsia-600",
              },
            ].map(p => (
              <div key={p.num} className={`relative p-6 rounded-2xl bg-gradient-to-br ${p.gradient} border`}>
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-12 h-12 rounded-xl bg-background flex items-center justify-center ${p.iconColor} shadow-sm`}>
                    <p.icon className="w-6 h-6" />
                  </div>
                  <div className="text-4xl font-bold text-muted-foreground/20">{p.num}</div>
                </div>
                <h3 className="text-xl font-bold mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SOCRATIC TESTING — not MCQs, never */}
      {/* ============================================ */}
      <section id="testing" className="py-20 lg:py-28 bg-muted/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 items-start mb-14">
            <div className="lg:col-span-6">
              <Badge variant="outline" className="mb-3"><MessageCircle className="w-3 h-3 mr-1" /> Socratic Assessment</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                No MCQs. No fill-in-the-blanks.<br />
                <span className="text-muted-foreground">Just Socratic dialogue.</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Multiple-choice tests tell you a student picked the right letter. They tell you nothing about how the student reasons, whether they know what they don't know, or whether the answer was even theirs. ExaminerAI uses the Socratic method instead — the AI probes with follow-up questions, the student articulates their reasoning, and the conversation itself becomes the psychological evidence.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mt-8">
                {SOCRATIC_PRINCIPLES.map(p => (
                  <div key={p.title} className="p-4 rounded-lg border bg-background">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <p.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{p.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-6">
              <BrowserFrame
                src="/screenshots/student-study.png"
                alt="Socratic test chatbot in action"
                url="examiner.ai/app · student · study"
              />
            </div>
          </div>

          {/* Three test types */}
          <div className="grid md:grid-cols-3 gap-5">
            {TEST_TYPES.map(t => (
              <div key={t.name} className={`p-6 rounded-2xl bg-gradient-to-br ${t.accent} border`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-background flex items-center justify-center ${t.iconColor} shadow-sm`}>
                    <t.icon className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{t.cadence}</Badge>
                </div>
                <h3 className="text-lg font-bold mb-1">{t.name}</h3>
                <div className="text-xs text-muted-foreground mb-3 font-mono">{t.questions}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>

          {/* Why Socratic, not MCQ */}
          <div className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-rose-500/10 border">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-amber-600 dark:text-amber-300" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-300 font-bold mb-1">Why Socratic, not MCQ</div>
                <h3 className="text-lg font-semibold mb-2">A score without reasoning is just a number.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Multiple-choice tests measure recognition, not understanding. They can't detect overconfidence, surface answers, AI-generated responses, fixed mindset, cognitive overload, or fading recall. Socratic dialogue can. Every conversation becomes evidence on <span className="font-medium text-foreground">7 dimensions, every test, every time</span> — feeding the wellbeing tier, the attention score, the AI Assistant's action dialog, and the mentorship cycle that follows.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* PROJECT-BASED LEARNING — the differentiator */}
      {/* ============================================ */}
      <section id="projects" className="py-20 lg:py-28 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-start mb-14">
            <div className="lg:col-span-6">
              <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white"><Rocket className="w-3 h-3 mr-1" /> Project-Based Learning</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Every student ships a capstone.<br />
                <span className="bg-gradient-to-r from-amber-300 to-fuchsia-300 bg-clip-text text-transparent">The AI tracks every milestone.</span>
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed">
                This is what an LMS can't do. Every student defines a real project on day one — the AI generates the full task plan, tracks milestones on a Gantt chart, analyzes weekly reports, and produces a final capstone evaluation. Teachers see exactly where each student is. Students always know what to build next.
              </p>

              {/* Quick metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
                {PROJECT_METRICS.map(m => (
                  <div key={m.label} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <m.icon className="w-4 h-4 text-amber-300 mb-1.5" />
                    <div className="text-sm font-semibold">{m.value}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-6">
              <BrowserFrame
                src="/screenshots/student-project.png"
                alt="Student project view with Gantt chart and milestones"
                url="examiner.ai/app · student · project"
                className="ring-1 ring-white/20"
              />
            </div>
          </div>

          {/* The 6-step project lifecycle */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROJECT_LOOP.map(step => (
              <div key={step.num} className={`p-5 rounded-xl bg-gradient-to-br ${step.color} border border-white/10 hover:border-white/20 transition-all`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-background ${step.iconColor}`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Step {step.num}</div>
                    <h3 className="font-semibold text-sm text-white">{step.title}</h3>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Final analysis callout */}
          <div className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Presentation className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-300 font-bold mb-1">Final capstone analysis</div>
                <h3 className="text-lg font-semibold text-white mb-2">Career-ready portfolio piece, graded by AI.</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  At course end, the teacher triggers a comprehensive AI analysis across 4 dimensions: <span className="text-white font-medium">project execution, technical competence, project quality, career readiness</span>. The result becomes the basis for the student's auto-generated certificate and their portfolio — ready to show employers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* ROLE DASHBOARDS SHOWCASE — all 6 roles */}
      {/* ============================================ */}
      <section id="dashboards" className="py-20 lg:py-28 bg-muted/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="mb-3">Six dashboards</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Every role. Their own cockpit.
            </h2>
            <p className="text-muted-foreground text-lg">
              No shared dashboard views. Each role sees exactly what they need — and nothing they shouldn't.
            </p>
          </div>

          {/* Role tab strip */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {ROLES.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setActiveRole(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeRole === i
                    ? `bg-gradient-to-r ${r.accent} text-white shadow-md`
                    : "bg-background border hover:bg-accent"
                }`}
              >
                <r.icon className="w-4 h-4" />
                {r.label}
              </button>
            ))}
          </div>

          {/* Active role showcase */}
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            {/* Left: role description */}
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 bg-gradient-to-br ${ROLES[activeRole].accent} text-white shadow-lg`}>
                {(() => {
                  const Icon = ROLES[activeRole].icon;
                  return <Icon className="w-7 h-7" />;
                })()}
              </div>
              <Badge variant="secondary" className={`mb-3 ${ROLES[activeRole].chip}`}>{ROLES[activeRole].label}</Badge>
              <h3 className="text-2xl font-bold mb-2">{ROLES[activeRole].tagline}</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">{ROLES[activeRole].desc}</p>

              {/* Per-role stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {ROLES[activeRole].stats.map(s => (
                  <div key={s.label} className="p-3 rounded-lg bg-background border text-center">
                    <div className="text-sm font-bold">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>

              <Link href="/app">
                <Button className={`bg-gradient-to-r ${ROLES[activeRole].accent} text-white border-0`}>
                  <Sparkles className="w-4 h-4 mr-2" /> Open this dashboard
                </Button>
              </Link>
            </div>

            {/* Right: screenshot */}
            <div className="lg:col-span-8">
              <div className="relative">
                <div className={`absolute -inset-4 bg-gradient-to-r ${ROLES[activeRole].accent} opacity-20 rounded-2xl blur-2xl`} />
                <BrowserFrame
                  src={ROLES[activeRole].screenshot}
                  alt={`${ROLES[activeRole].label} dashboard`}
                  url={`examiner.ai/app · ${ROLES[activeRole].id}`}
                  className="relative"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* AI ASSISTANT — the 7 systems (NEW section) */}
      {/* ============================================ */}
      <section id="ai-assistant" className="py-20 lg:py-28 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-fuchsia-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-start mb-14">
            <div className="lg:col-span-6">
              <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">AI Assistant · 7 systems</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Not a chatbot.<br />
                <span className="bg-gradient-to-r from-amber-300 to-fuchsia-300 bg-clip-text text-transparent">A mentorship operating system.</span>
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed">
                Seven coordinated systems that scope data, cache aggressively, escalate intelligently, draft actions, safeguard students, balance teacher load, and teach the teacher how to intervene — all per role, all auditable.
              </p>
            </div>
            <div className="lg:col-span-6">
              <BrowserFrame
                src="/screenshots/ai-assistant.png"
                alt="AI Assistant"
                url="examiner.ai/app · teacher · ai-assistant"
                className="ring-1 ring-white/20"
              />
            </div>
          </div>

          {/* 7 systems bento grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AI_SECTIONS.map((s, i) => (
              <div
                key={s.num}
                className={`p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group ${
                  i === 0 ? "sm:col-span-2 lg:col-span-1" : ""
                } ${i === 6 ? "sm:col-span-2 lg:col-span-1" : ""}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">System {s.num}</div>
                    <h3 className="font-semibold text-sm">{s.title}</h3>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Real example */}
          <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-white/10">
            <div className="flex items-start gap-3 mb-4">
              <Quote className="w-5 h-5 text-amber-300 flex-shrink-0 mt-1" />
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-300 font-bold mb-1">Real example</div>
                <p className="text-lg text-white font-medium mb-3">"Who's likely to drop off in the next two weeks?"</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Sam Ali and Maria Cruz appear most likely to drop off. Both are in the red tier (highest risk) with low progress and low latest scores. Sam has a crisis flag, low engagement, and 14 days since contact; Maria has the longest gap (21 days), declining database queries, and low confidence.
                </p>
                <div className="mt-3 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">References:</span> Sam Ali (red tier, crisisFlags: 1, daysSinceContact: 14) · Maria Cruz (red tier, daysSinceContact: 21, confidence: low)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* MENTORSHIP & MENTAL HEALTH — the human cycle */}
      {/* ============================================ */}
      <section id="mentorship" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mb-14">
            <Badge variant="outline" className="mb-3"><HeartPulse className="w-3 h-3 mr-1" /> Mentorship &amp; Mental Health</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              AI surfaces signal.<br />
              <span className="text-muted-foreground">Humans provide judgment.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              This is the heart of the platform. Every student interaction feeds a 6-stage cycle that turns behavior into evidence, evidence into tier, tier into alert, alert into mentorship session — with the AI drafting the action and the human confirming it. Every step is auditable. Every intervention is documented. The AI never acts alone.
            </p>
          </div>

          {/* The 6-stage cycle */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
            {PSYCH_CYCLE_STAGES.map(stage => (
              <div key={stage.num} className={`p-5 rounded-xl bg-gradient-to-br ${stage.color} border`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-background ${stage.iconColor}`}>
                    <stage.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Stage {stage.num} · {stage.short}</div>
                    <h3 className="font-semibold text-sm">{stage.title}</h3>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{stage.desc}</p>
              </div>
            ))}
          </div>

          {/* Two parallel tracks: student + teacher */}
          <div className="grid md:grid-cols-2 gap-6 mb-14">
            <div className="p-6 rounded-2xl border bg-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-950/30 text-blue-600">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Track 1</div>
                  <h3 className="font-semibold">Student mentorship &amp; mental health</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Teacher is the first responder. Counsellor escalates for psychological concerns. Principal oversees institution-wide. Guardian sees a sanitized view — never the mentorship notes.
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Wellbeing tier (green/amber/red) auto-computed from 14-day evidence window</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Attention-scored triage queue ranks who needs help today</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> GROW coaching sessions: Goal → Reality → Options → Will</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Crisis flag bypasses tier system — immediate counsellor + principal alert</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Every touchpoint recorded with note + outcome + follow-up</li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl border bg-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Track 2</div>
                  <h3 className="font-semibold">Teacher mentorship &amp; load management</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Teachers are people too. Burned-out teachers fail students. Load score = students × 1 + batches × 15 + alerts × 5 + crisis × 25 + overdue × 3. Green &lt; 50, amber 50–99, red ≥ 100.
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Teacher sees their own load tier — full transparency</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Principal sees staff load distribution + can reassign</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> AI suggests co-teachers — never proposes amber/red candidates</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Wellbeing touchpoints for staff, separate from student notes</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Red-tier load auto-escalates — no 7-day timer</li>
              </ul>
            </div>
          </div>

          {/* Safeguarding callout */}
          <div className="p-6 rounded-2xl bg-slate-950 text-white border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-start gap-3 mb-4">
                <ShieldAlert className="w-6 h-6 text-rose-300 flex-shrink-0 mt-1" />
                <div>
                  <Badge variant="outline" className="mb-2 bg-rose-500/20 border-rose-500/30 text-rose-200">Safeguarding Mode · Principal-only</Badge>
                  <h3 className="text-xl font-bold mb-2">The one exception to "insight stays with caller".</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Safeguarding flags about a teacher go to the principal scope only. The teacher is never notified. This is the deliberate exception — student safety outranks teacher transparency. The system requires 2+ corroborating signals, never a single message. Deterministic regex pre-filters first; the AI explains candidates but cannot invent flags.
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                {SAFEGUARDING_PRINCIPLES.map(p => (
                  <div key={p.title} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p.icon className="w-4 h-4 text-rose-300 mb-2" />
                    <div className="text-xs font-semibold text-white mb-1">{p.title}</div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What this is NOT */}
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: "Not therapy", desc: "Surfaces signals, structures mentorship. Students in crisis need human professionals." },
              { title: "Not surveillance", desc: "Observes learning behavior. No off-platform tracking, no location, no device monitoring." },
              { title: "Not punishment", desc: "Triggers support, not discipline. Even safeguarding is framed as 'requires judgment'." },
              { title: "Not a replacement for teachers", desc: "AI drafts, humans decide. Teachers provide judgment the AI never will." },
            ].map(item => (
              <div key={item.title} className="p-3 rounded-lg border bg-muted/30">
                <div className="text-xs font-bold mb-1 flex items-center gap-1.5">
                  <X className="w-3 h-3 text-muted-foreground" />
                  {item.title}
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>

          {/* Deep-dive link */}
          <div className="mt-10 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              The full cycle — including the AI Tutor teaching rules, Socratic test chatbot logic, 7-dimension pipeline, escalation engine, and safeguarding pathway — is documented in:
            </p>
            <div className="inline-flex items-center gap-3 text-sm">
              <Badge variant="secondary" className="font-mono">docs/PSYCHOLOGICAL-CYCLE.md</Badge>
              <Badge variant="secondary" className="font-mono">docs/MENTORSHIP-CYCLE.md</Badge>
              <Badge variant="secondary" className="font-mono">docs/SEVEN-DIMENSIONS.md</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* STUDENT FEATURES */}
      {/* ============================================ */}
      <section id="student" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-14">
            <div>
              <Badge variant="outline" className="mb-3">For Students</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Build a capstone.<br />Get a certificate. Get a job.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                From day-one project definition to final capstone analysis, every student builds a real portfolio piece. The AI Tutor teaches today's topic in your language, Socratic tests probe reasoning, and per-question explanations land immediately. Milestones, Gantt chart, weekly reports — all auto-tracked.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs"><GitBranch className="w-3 h-3 mr-1" /> Capstone Project</Badge>
                <Badge variant="secondary" className="text-xs"><GanttChartSquare className="w-3 h-3 mr-1" /> Gantt + Milestones</Badge>
                <Badge variant="secondary" className="text-xs"><Bot className="w-3 h-3 mr-1" /> AI Tutor</Badge>
                <Badge variant="secondary" className="text-xs"><Award className="w-3 h-3 mr-1" /> Certificate</Badge>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-r from-blue-500/20 to-emerald-500/20 rounded-2xl blur-xl" />
              <BrowserFrame
                src="/screenshots/ai-tutor.png"
                alt="AI Tutor chat"
                url="examiner.ai/app · student · ai-tutor"
                className="relative"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STUDENT_FEATURES.map(f => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-primary/10 text-primary">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* TEACHER FEATURES */}
      {/* ============================================ */}
      <section id="teacher" className="py-20 lg:py-28 bg-muted/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-14">
            <div className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 rounded-2xl blur-xl" />
                <BrowserFrame
                  src="/screenshots/student-portfolio.png"
                  alt="Student portfolio with project progress + 7-dimension psychology"
                  url="examiner.ai/app · teacher · students/[id]"
                  className="relative"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-3">For Teachers</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                See every capstone.<br />Know who to mentor today.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                The AI does the teaching. You do the mentoring. Attention-scored triage queue tells you who needs help most. Per-student portfolio shows project progress, 7-dimension psychology, GROW coaching history. AI Assistant answers batch questions in natural language. One teacher can now mentor 50–500+ students.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs"><GitBranch className="w-3 h-3 mr-1" /> Project Visibility</Badge>
                <Badge variant="secondary" className="text-xs"><Brain className="w-3 h-3 mr-1" /> 7-Dimension Psychology</Badge>
                <Badge variant="secondary" className="text-xs"><Target className="w-3 h-3 mr-1" /> GROW Coaching</Badge>
                <Badge variant="secondary" className="text-xs"><Bot className="w-3 h-3 mr-1" /> AI Assistant</Badge>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TEACHER_FEATURES.map(f => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-primary/10 text-primary">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* 7 PSYCHOLOGICAL DIMENSIONS */}
      {/* ============================================ */}
      <section id="psychology" className="py-20 lg:py-28 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">7-Dimension Psychology</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Understand every student,<br />dimension by dimension.
            </h2>
            <p className="text-slate-300 text-lg">
              Every test completion runs a full analysis pipeline — all 7 dimensions written every time, not just when conditions are met. Each value comes with a teacher-facing explanation and a concrete recommended action.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
            {PSYCH_DIMENSIONS.map(d => (
              <div key={d.num} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${d.color}`}>
                    <d.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Dimension {d.num}</div>
                    <h3 className="font-semibold text-sm">{d.name}</h3>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">Psychological Tab</Badge>
              <h3 className="text-2xl font-bold mb-3">Trajectory, evidence, calibration — all in one view.</h3>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Teachers see per-week trajectory (improving/stable/declining), every evidence entry with source, a calibration scatter chart (self-rated vs actual score), crisis flags, and the student's current wellbeing tier (green/amber/red).
              </p>
              <div className="space-y-2">
                {["Confidence ratings scatter chart", "Crisis flag management", "Wellbeing state (green/amber/red)", "Attention flags with reasons", "Per-week trajectory analysis"].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-r from-fuchsia-500/30 to-purple-500/30 rounded-2xl blur-xl" />
              <BrowserFrame
                src="/screenshots/psychological-tab.png"
                alt="Psychological Tab"
                url="examiner.ai/app · teacher · portfolio · psychological"
                className="relative ring-1 ring-white/20"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* GROW MENTORSHIP */}
      {/* ============================================ */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <BrowserFrame
                src="/screenshots/mentorship-tab.png"
                alt="Mentorship Tab"
                url="examiner.ai/app · teacher · portfolio · mentorship"
              />
            </div>
            <div className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-3">GROW Coaching Model</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Structured mentorship<br />that actually works.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Every mentor session follows the proven GROW framework. Track both psychological and educational mentorship with outcome tracking, follow-up scheduling, and an AI-drafted check-in message button.
              </p>

              <div className="space-y-3 mb-8">
                {GROW_STEPS.map(item => (
                  <div key={item.letter} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${item.color} flex-shrink-0`}>
                      {item.letter}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="text-xs"><HeartPulse className="w-3 h-3 mr-1" /> Psychological sessions</Badge>
                <Badge variant="secondary" className="text-xs"><Target className="w-3 h-3 mr-1" /> Educational sessions</Badge>
                <Badge variant="secondary" className="text-xs"><Clock className="w-3 h-3 mr-1" /> Follow-up tracking</Badge>
                <Badge variant="secondary" className="text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Outcome tracking</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* EDUCATIONAL TAB */}
      {/* ============================================ */}
      <section className="py-20 lg:py-28 bg-muted/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-3">Educational Tab</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Skill mastery,<br />not just scores.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Per-topic mastery computed from interaction data — turns "week 3: 68%" into "database queries: developing, custom post types: proficient". Actionable specificity a teacher can act on.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  { icon: TrendingUp, title: "Mastery levels", desc: "not-started → developing → proficient → mastered" },
                  { icon: Activity, title: "Trend tracking", desc: "improving / stable / declining per topic" },
                  { icon: BarChart3, title: "Competency scores", desc: "Per-topic scores with weak sub-topics identified" },
                  { icon: FileText, title: "Weekly tests + report cards", desc: "Full assessment history with strengths/weaknesses" },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-r from-amber-500/20 to-rose-500/20 rounded-2xl blur-xl" />
              <BrowserFrame
                src="/screenshots/educational-tab.png"
                alt="Educational Tab"
                url="examiner.ai/app · teacher · portfolio · educational"
                className="relative"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* THEME SYSTEM — NEW section */}
      {/* ============================================ */}
      <section id="themes" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3"><Palette className="w-3 h-3 mr-1" /> Theme System</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Four themes. Switch live.
            </h2>
            <p className="text-muted-foreground text-lg">
              Pick the palette that fits your institution. Themes apply instantly via CSS variables — no reload, no flash, no locked-in look.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {THEMES.map((t, i) => (
              <div key={t.name} className="group cursor-pointer">
                <div className="rounded-xl border overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Theme preview */}
                  <div className="h-32 relative" style={{ background: `linear-gradient(135deg, ${t.colors[2]} 0%, ${t.colors[0]} 100%)` }}>
                    <div className="absolute inset-3 rounded-md bg-white/90 dark:bg-slate-900/90 p-3 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: t.colors[1] }} />
                        <div className="h-1.5 w-12 rounded-full" style={{ background: t.colors[0], opacity: 0.7 }} />
                      </div>
                      <div className="space-y-1">
                        <div className="h-1 w-16 rounded-full" style={{ background: t.colors[0], opacity: 0.4 }} />
                        <div className="h-1 w-10 rounded-full" style={{ background: t.colors[0], opacity: 0.3 }} />
                      </div>
                      <div className="flex gap-1">
                        <div className="h-3 w-8 rounded" style={{ background: t.colors[0] }} />
                        <div className="h-3 w-8 rounded border" style={{ borderColor: t.colors[0], opacity: 0.4 }} />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-background">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/app">
              <Button size="lg">
                <Palette className="w-4 h-4 mr-2" /> Try themes in the app
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* PLATFORM / TECH FEATURES */}
      {/* ============================================ */}
      <section id="tech" className="py-20 lg:py-28 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">Platform</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built to scale.<br />Built to be safe.
            </h2>
            <p className="text-slate-300 text-lg">
              DeepSeek V4 Flash as primary AI (cheap + fast). Z.ai as fallback. 7-role RBAC with IDOR protection. Safeguarding mode that protects students from staff. Lightweight telemetry that scales to 10,000+ students.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
            {PLATFORM_FEATURES.map(f => (
              <div key={f.title} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-amber-500/20 text-amber-300">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Stats banner */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 p-8 rounded-2xl bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 border border-white/10">
            {TRUST_STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-amber-300 mb-1">{s.value}</div>
                <div className="text-xs text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* DEMO CTA */}
      {/* ============================================ */}
      <section id="demo" className="py-20 lg:py-24 bg-gradient-to-br from-amber-500 via-rose-500 to-fuchsia-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
        <div className="container mx-auto px-4 lg:px-8 text-center relative">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Run your bootcamp on ExaminerAI.
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            One click. No signup. Watch the AI teach, students build, milestones track, and the teacher's dashboard light up with signal. The demo is read-only — try every role, nothing breaks.
          </p>
          <Link href="/app">
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-100 h-14 px-8 text-base font-semibold shadow-xl"
            >
              <Sparkles className="w-5 h-5 mr-2" /> Launch Demo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <div className="mt-6 text-sm text-white/80">
            Demo login: <code className="bg-white/20 px-2 py-0.5 rounded">demo@examiner.ai</code> · <code className="bg-white/20 px-2 py-0.5 rounded">demo123</code>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* FOOTER */}
      {/* ============================================ */}
      <footer className="bg-slate-950 text-slate-400 py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-slate-900" />
                </div>
                <span className="text-white font-bold">ExaminerAI</span>
              </div>
              <p className="text-sm max-w-md leading-relaxed">
                AI-powered bootcamp management for software training programmes up to 6 months. Students learn by building real capstone projects — the AI teaches, tracks milestones, and gives institutions the signal they need to mentor at scale.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">Next.js 16</Badge>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">Prisma + Postgres</Badge>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">DeepSeek V4 Flash</Badge>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">shadcn/ui</Badge>
              </div>
            </div>

            <div>
              <div className="text-white font-semibold text-sm mb-3">Platform</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#big-idea" className="hover:text-white">Why</a></li>
                <li><a href="#projects" className="hover:text-white">Projects</a></li>
                <li><a href="#dashboards" className="hover:text-white">Roles</a></li>
                <li><a href="#ai-assistant" className="hover:text-white">AI Assistant</a></li>
                <li><a href="#psychology" className="hover:text-white">Psychology</a></li>
                <li><a href="#themes" className="hover:text-white">Themes</a></li>
                <li><a href="#tech" className="hover:text-white">Platform</a></li>
                <li><Link href="/app" className="hover:text-white">Live Demo</Link></li>
              </ul>
            </div>

            <div>
              <div className="text-white font-semibold text-sm mb-3">Operator</div>
              <ul className="space-y-2 text-sm">
                <li>Inzet Enterprises</li>
                <li>inzet.enterprises@gmail.com</li>
                <li>Software bootcamp platform</li>
                <li>Socratic assessment + AI mentorship</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 my-6" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div>© 2026 ExaminerAI · Inzet Enterprises. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <span>v1.0.0</span>
              <span>·</span>
              <span>Bootcamp edition</span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> All systems operational
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
