"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/modules/ui/button";
import { Card, CardContent } from "@/modules/ui/card";
import { Badge } from "@/modules/ui/badge";
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
// 4 ROLES — every role now has its own dedicated dashboard
// ============================================================
const ROLES = [
  {
    id: "learner",
    label: "Learner",
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
    id: "instructor",
    label: "Instructor",
    icon: BookOpen,
    accent: "from-emerald-500 to-teal-500",
    chip: "bg-growth-sage-soft text-growth-sage-foreground dark:text-emerald-300",
    screenshot: "/screenshots/dashboard-teacher.png",
    tagline: "See every student. Know what to do next.",
    desc: "Batch dashboard with attention-scored triage queue, per-student academic portfolio, AI Assistant for natural-language batch queries, and automated alerts for inactivity and score drops.",
    stats: [
      { label: "Attention score", value: "Auto" },
      { label: "AI Assistant", value: "Batch" },
      { label: "Triage", value: "Ranked" },
    ],
  },
  {
    id: "org_admin",
    label: "Org Admin",
    icon: Building2,
    accent: "from-purple-500 to-indigo-500",
    chip: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    screenshot: "/screenshots/dashboard-principal.png",
    tagline: "Run the institution on signal, not gut.",
    desc: "Organization-wide analytics: academic performance distribution, instructor load, audit log, cohort trends. Org Admin oversees course alignment and instructor coverage.",
    stats: [
      { label: "Instructor load", value: "Tiered" },
      { label: "Audit log", value: "Full" },
      { label: "Cohorts", value: "All" },
    ],
  },
  {
    id: "platform_admin",
    label: "Platform Admin",
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
// AI ASSISTANT — systems that scope data and answer questions
// ============================================================
const AI_SECTIONS = [
  {
    num: "01",
    icon: Compass,
    title: "Scope Resolver",
    desc: "Every AI query is scoped BEFORE the call. Teachers see only their batch. Coordinators see institution-wide academics. The AI never receives data outside the caller's scope.",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  },
  {
    num: "02",
    icon: Gauge,
    title: "Data Efficiency",
    desc: "Per-entity summaries cached 7 days. Aggregate-first queries return counts and distributions, never raw records. Soft query budget per role. Max 50 raw records per AI call.",
    color: "text-growth-sage bg-growth-sage-soft dark:bg-emerald-950/30",
  },
  {
    num: "03",
    icon: TrendingUp,
    title: "Attention Score",
    desc: "Students auto-ranked by who needs help most: inactivity (3d = +30), score drop (+20), low practice (+20), blocked tasks (+10). The batch tells you who to talk to today.",
    color: "text-growth-amber bg-growth-amber-soft dark:bg-amber-950/30",
  },
  {
    num: "04",
    icon: MessageSquare,
    title: "Action Dialog",
    desc: "One reusable dialog for every alert type. AI-drafted headline, why, suggested action, 3 one-tap note presets. Confirm disabled until note provided. Cancel always available.",
    color: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30",
  },
  {
    num: "05",
    icon: Scale,
    title: "Instructor Load",
    desc: "loadScore = students × 1 + batches × 15 + alerts × 5 + overdue × 3. Green < 50, warning 50-99, red ≥ 100. Co-teacher suggestions NEVER propose warning/red candidates.",
    color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
  },
  {
    num: "06",
    icon: Lightbulb,
    title: "In-Action Teaching",
    desc: "Per-alert-type guidance: inactivity → 'Reach out and check in'. Score drop → 'Review missed concepts together'. Blocked task → 'Pair them with a peer'. Always actionable.",
    color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
  },
];

// ============================================================
// HUMAN MENTORING AT SCALE — AI surfaces signal. Humans provide judgment.
// ============================================================
const MENTOR_LOOP_STAGES = [
  {
    num: "1",
    icon: MessageCircle,
    title: "Observe",
    short: "Every interaction",
    desc: "AI Tutor chat, daily tests, weekly tests, project reports — every student interaction is a data point. Real-time engagement analysis runs in <1ms with no AI call.",
    color: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-600",
  },
  {
    num: "2",
    icon: Activity,
    title: "Triage",
    short: "Attention-scored queue",
    desc: "Students auto-ranked by who needs help most. Attention score = inactivity (3d = +30) + score drop (+20) + low practice (+20) + blocked tasks (+10). The batch tells you who to talk to today.",
    color: "from-amber-500/10 to-rose-500/10",
    iconColor: "text-growth-amber",
  },
  {
    num: "3",
    icon: Bell,
    title: "Alert",
    short: "Actionable notifications",
    desc: "Inactivity, score drops, and blocked tasks trigger alerts. AI Assistant drafts the check-in message. Teacher confirms, edits, and sends. Every action recorded.",
    color: "from-rose-500/10 to-pink-500/10",
    iconColor: "text-destructive",
  },
  {
    num: "4",
    icon: Target,
    title: "Mentor",
    short: "AI-drafted, human-sent",
    desc: "AI Assistant drafts: headline, why, suggested action, 3 one-tap note presets. Confirm disabled until teacher writes a note. Every intervention auditable.",
    color: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-growth-sage",
  },
];

const PLATFORM_FEATURES = [
  { icon: Bot, title: "Multi-Provider AI", desc: "DeepSeek V4 Flash (primary, cheap + fast), Z.ai (fallback). Automatic failover. Token cache for repeat calls." },
  { icon: ShieldCheck, title: "Role-Based RBAC", desc: "Granular permissions with IDOR protection, AccessGrant scoping (full / read-only / coordinator), and rate limiting per role." },
  { icon: Database, title: "Lightweight Telemetry", desc: "1 DB upsert per AI Tutor message (not 15-20). Scales to 10,000+ students without DB flooding. Best-effort pipelines never block UX." },
  { icon: Bell, title: "Automated Alert Engine", desc: "Academic alerts fire automatically on threshold crossings: inactivity, score drops, blocked tasks. AI-drafted notes per alert." },
  { icon: ScrollText, title: "Audit & Compliance", desc: "Every sensitive action logged: role changes, approvals, blocks, grants, AI key changes. Full audit trail for institutional compliance." },
  { icon: Palette, title: "Live Theme System", desc: "4 preset themes switchable from the sidebar — applied instantly via CSS variables. Modern Slate, Ocean Blue, Forest Sage, Sunset Rose." },
];

const THEMES = [
  { name: "Modern Slate", desc: "Slate-900 primary, amber accents.", colors: ["#0f172a", "#f59e0b", "#f8fafc"] },
  { name: "Ocean Blue", desc: "Google-blue primary, teal accents.", colors: ["#1a73e8", "#0d9488", "#f0f9ff"] },
  { name: "Forest Sage", desc: "Sage green primary, earth tones.", colors: ["#4d7c0f", "#92400e", "#f7fee7"] },
  { name: "Sunset Rose", desc: "Rose primary, amber accents.", colors: ["#e11d48", "#f59e0b", "#fff1f2"] },
];

const STUDENT_FEATURES = [
  { icon: GitBranch, title: "Capstone Project Planning", desc: "Define your project on day one. AI generates N weeks × 5 tasks/week with milestones, daily schedule, and time estimates. Gantt chart + per-week summaries + final capstone analysis." },
  { icon: Bot, title: "AI Tutor", desc: "Friendly chatbot that teaches today's topic in your language, connects every concept to your capstone project, and meets you where you are." },
  { icon: ClipboardCheck, title: "Socratic Daily Test", desc: "3-question check-in on today's topic. Per-question explanations revealed immediately, not at end-of-test." },
  { icon: FileText, title: "Weekly Test + Project Report", desc: "15-question Socratic exam with plagiarism analysis. Plus weekly project report analyzed on 4 dimensions: understanding, depth, progress, clarity." },
  { icon: Lightbulb, title: "Per-Question Explanations", desc: "Correct answer, why it's correct, specific encouragement — immediately after every question. Learn from every question." },
  { icon: GanttChartSquare, title: "Gantt + Milestones", desc: "Visual timeline of all project tasks. Milestones highlighted. Always know where you are vs. where you should be." },
  { icon: Award, title: "Report Cards & Certificates", desc: "Auto-generated from test scores (80% weekly + 20% practice) + final capstone analysis. Certificates are publicly verifiable via shareable URL." },
  { icon: Calendar, title: "Daily Check-in + Ask My Teacher", desc: "Daily learning reflection + what confused you. Floating button for quick questions to your assigned teacher." },
];

const TEACHER_FEATURES = [
  { icon: GitBranch, title: "Project Progress Visibility", desc: "See every student's capstone progress at a glance. Tasks completed, milestones hit, blocked items, weekly report scores. No more 'are they on track?' guesswork." },
  { icon: Users, title: "Attention-Scored Triage", desc: "Students auto-ranked by who needs help most: inactivity, score drops, low practice volume, blocked tasks. The batch tells you who to talk to today." },
  { icon: Activity, title: "Skill Mastery Tracking", desc: "Per-topic mastery computed from practice + test data — turns 'week 3: 68%' into 'database queries: developing, custom post types: proficient'. Actionable specificity." },
  { icon: Target, title: "Actionable Interventions", desc: "Alert-driven actions with outcome tracking, follow-up scheduling, and AI-drafted check-in messages. Every intervention documented." },
  { icon: Bot, title: "AI Assistant", desc: "Natural-language batch queries: 'Who's likely to drop off?' — answered from existing data with cited student evidence. Scope-aware: teachers only see their batch." },
  { icon: Bell, title: "Automated Alerts", desc: "Academic alerts fire automatically when students cross thresholds: inactivity, score drops, blocked tasks. Action dialog with AI-drafted notes." },
  { icon: BookOpen, title: "Course Planner", desc: "Course CRUD, batch assignment, AI course generation. Full curriculum control with weekly phase + daily topic structure." },
  { icon: BarChart3, title: "Final Project Analysis", desc: "Trigger comprehensive AI capstone evaluation: execution, technical competence, quality, career readiness. Auto-generates strengths, weaknesses, recommendations." },
];

const TRUST_STATS = [
  { value: "4", label: "Role dashboards" },
  { value: "0", label: "MCQs (Socratic)" },
  { value: "44+", label: "Data models" },
  { value: "6mo", label: "Max cohort length" },
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
    iconColor: "text-growth-amber",
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
    iconColor: "text-growth-sage",
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
    iconColor: "text-destructive",
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
// Three test types, one Socratic method, plagiarism + voice analysis per test
// ============================================================
const TEST_TYPES = [
  {
    icon: Lightbulb,
    name: "Practice Test",
    cadence: "On demand",
    questions: "1 question, 4 pillars rotated",
    desc: "Low-stakes formative practice. Four Socratic pillars rotate: Why Probe, Break-It, Client Translation, Edge Case. No scoring pressure — just learning.",
    accent: "from-amber-500/10 to-rose-500/10",
    iconColor: "text-growth-amber",
  },
  {
    icon: ClipboardCheck,
    name: "Daily Test",
    cadence: "Every day",
    questions: "3 Socratic questions",
    desc: "3-question check-in on today's topic. Per-question explanations revealed immediately so students learn from every answer.",
    accent: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-600",
  },
  {
    icon: FileText,
    name: "Weekly Test",
    cadence: "End of week",
    questions: "15 Socratic questions, max 5 replies each",
    desc: "The full academic snapshot. AI probes reasoning, evaluates with plagiarism analysis, and produces a score plus an AI-generated examiner comment.",
    accent: "from-fuchsia-500/10 to-purple-500/10",
    iconColor: "text-fuchsia-600",
  },
];

const SOCRATIC_PRINCIPLES = [
  { icon: MessageCircle, title: "AI probes, never tells", desc: "The chatbot never gives the answer. It asks 'Why?', 'How would you explain this to a peer?', 'What if the requirement changed?'" },
  { icon: Lightbulb, title: "Per-question explanations", desc: "Correct answer + why it's correct + specific encouragement — revealed immediately after every question, not at end-of-test." },
  { icon: Eye, title: "Plagiarism + voice analysis", desc: "Voice-inconsistency detection flags AI-generated answers. Vocabulary jumps + AI-typical phrasing patterns caught on every weekly test." },
  { icon: TrendingUp, title: "Skill mastery tracking", desc: "Every test feeds the per-topic mastery model — turns raw scores into actionable 'database queries: developing, custom post types: proficient' insights." },
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
    <div className={`relative rounded-xl overflow-hidden border shadow-2xl bg-bg ${className}`}>
      <div className="h-9 bg-slate-100 dark:bg-slate-800 border-b flex items-center px-4 gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="ml-3 text-xs text-fg-muted font-mono truncate">{url}</div>
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
    <div className="min-h-screen bg-bg antialiased">
      {/* ============================================ */}
      {/* NAV */}
      {/* ============================================ */}
      <header className="sticky top-0 z-40 w-full border-b bg-bg/80 backdrop-blur-md">
        <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center transition-transform group-hover:scale-105">
              <GraduationCap className="w-5 h-5 text-growth-amber" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight tracking-tight">TraineesAI</div>
              <div className="text-[10px] text-fg-muted leading-tight">AI-Powered Bootcamp Management</div>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#big-idea" className="text-fg-muted hover:text-fg transition-colors">Why</a>
            <a href="#projects" className="text-fg-muted hover:text-fg transition-colors">Projects</a>
            <a href="#testing" className="text-fg-muted hover:text-fg transition-colors">Testing</a>
            <a href="#dashboards" className="text-fg-muted hover:text-fg transition-colors">Roles</a>
            <a href="#mentorship" className="text-fg-muted hover:text-fg transition-colors">Mentoring</a>
            <a href="#psychology" className="text-fg-muted hover:text-fg transition-colors">Mastery</a>
            <a href="#tech" className="text-fg-muted hover:text-fg transition-colors">Platform</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
            </Link>
            <Link href="/app">
              <Button size="sm" className="bg-growth-amber hover:bg-amber-600 text-white shadow-sm">
                <Sparkles className="w-4 h-4 mr-1.5" /> Try Demo
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {mobileNav && (
          <div className="md:hidden border-t bg-bg px-4 py-3 space-y-2 text-sm">
            <a href="#big-idea" onClick={() => setMobileNav(false)} className="block py-1.5">Why</a>
            <a href="#projects" onClick={() => setMobileNav(false)} className="block py-1.5">Projects</a>
            <a href="#testing" onClick={() => setMobileNav(false)} className="block py-1.5">Testing</a>
            <a href="#dashboards" onClick={() => setMobileNav(false)} className="block py-1.5">Roles</a>
            <a href="#mentorship" onClick={() => setMobileNav(false)} className="block py-1.5">Mentoring</a>
            <a href="#psychology" onClick={() => setMobileNav(false)} className="block py-1.5">Mastery</a>
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
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-growth-amber/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-growth-sage-soft rounded-full blur-3xl" />

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
                TraineesAI is the AI-powered bootcamp platform where students learn software by building real capstone projects. The AI teaches, the Socratic test chatbot probes reasoning — <span className="text-growth-amber font-medium">never MCQs</span> — and every interaction feeds per-topic skill mastery plus attention-scored triage. Teachers mentor at scale. Institutions see signal, not noise.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <Link href="/app">
                  <Button size="lg" className="bg-growth-amber hover:bg-amber-600 text-white text-base h-12 px-6 shadow-lg shadow-amber-500/20">
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
                    <div className="text-2xl md:text-3xl font-bold text-growth-amber">{s.value}</div>
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
      <section className="border-b bg-bg-subtle/30 py-10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center md:text-left">
            <span className="text-xs uppercase tracking-wider text-fg-muted font-medium">Built &amp; operated by</span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-growth-amber font-bold text-lg shadow-sm">
                iE
              </div>
              <div>
                <div className="text-sm font-semibold">Inzet Enterprises</div>
                <div className="text-xs text-fg-muted">Software bootcamp platform · 6-month cohorts · Socratic assessment + AI mentorship</div>
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
            <Badge variant="outline" className="mb-3">Why TraineesAI exists</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Software skills are learned by building.<br />
              <span className="text-fg-muted">Not by watching videos.</span>
            </h2>
            <p className="text-fg-muted text-lg leading-relaxed">
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
                iconColor: "text-growth-amber",
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
                desc: "Four role-specific dashboards. Automated alerts that surface who needs help. A natural-language AI Assistant that answers 'who's likely to drop off?' in seconds. Every role gets exactly the signal they need — without drowning in data or flooding the database.",
                gradient: "from-fuchsia-500/10 to-purple-500/10",
                iconColor: "text-fuchsia-600",
              },
            ].map(p => (
              <div key={p.num} className={`relative p-6 rounded-2xl bg-gradient-to-br ${p.gradient} border`}>
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-12 h-12 rounded-xl bg-bg flex items-center justify-center ${p.iconColor} shadow-sm`}>
                    <p.icon className="w-6 h-6" />
                  </div>
                  <div className="text-4xl font-bold text-fg-muted/20">{p.num}</div>
                </div>
                <h3 className="text-xl font-bold mb-2">{p.title}</h3>
                <p className="text-sm text-fg-muted leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SOCRATIC TESTING — not MCQs, never */}
      {/* ============================================ */}
      <section id="testing" className="py-20 lg:py-28 bg-bg-subtle/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 items-start mb-14">
            <div className="lg:col-span-6">
              <Badge variant="outline" className="mb-3"><MessageCircle className="w-3 h-3 mr-1" /> Socratic Assessment</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                No MCQs. No fill-in-the-blanks.<br />
                <span className="text-fg-muted">Just Socratic dialogue.</span>
              </h2>
              <p className="text-fg-muted text-lg leading-relaxed">
                Multiple-choice tests tell you a student picked the right letter. They tell you nothing about how the student reasons, whether they know what they don't know, or whether the answer was even theirs. TraineesAI uses the Socratic method instead — the AI probes with follow-up questions, the student articulates their reasoning, and the conversation itself becomes the evidence of understanding.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mt-8">
                {SOCRATIC_PRINCIPLES.map(p => (
                  <div key={p.title} className="p-4 rounded-lg border bg-bg">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-subtle flex items-center justify-center flex-shrink-0">
                        <p.icon className="w-4 h-4 text-brand" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{p.title}</div>
                        <div className="text-xs text-fg-muted mt-0.5 leading-relaxed">{p.desc}</div>
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
                  <div className={`w-12 h-12 rounded-xl bg-bg flex items-center justify-center ${t.iconColor} shadow-sm`}>
                    <t.icon className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{t.cadence}</Badge>
                </div>
                <h3 className="text-lg font-bold mb-1">{t.name}</h3>
                <div className="text-xs text-fg-muted mb-3 font-mono">{t.questions}</div>
                <p className="text-sm text-fg-muted leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>

          {/* Why Socratic, not MCQ */}
          <div className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-rose-500/10 border">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-growth-amber/20 flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-growth-amber dark:text-growth-amber" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-growth-amber dark:text-growth-amber font-bold mb-1">Why Socratic, not MCQ</div>
                <h3 className="text-lg font-semibold mb-2">A score without reasoning is just a number.</h3>
                <p className="text-sm text-fg-muted leading-relaxed">
                  Multiple-choice tests measure recognition, not understanding. They can't detect overconfidence, surface answers, AI-generated responses, or fading recall. Socratic dialogue can. Every conversation becomes evidence — feeding per-topic mastery, the attention score, the AI Assistant's action dialog, and the mentoring loop that follows.
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
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-growth-amber-soft rounded-full blur-3xl" />
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
                    <m.icon className="w-4 h-4 text-growth-amber mb-1.5" />
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
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-bg ${step.iconColor}`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-growth-amber font-bold">Step {step.num}</div>
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
              <div className="w-12 h-12 rounded-xl bg-growth-amber/20 flex items-center justify-center flex-shrink-0">
                <Presentation className="w-6 h-6 text-growth-amber" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-growth-amber font-bold mb-1">Final capstone analysis</div>
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
      <section id="dashboards" className="py-20 lg:py-28 bg-bg-subtle/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="mb-3">Four dashboards</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Every role. Their own cockpit.
            </h2>
            <p className="text-fg-muted text-lg">
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
                    : "bg-bg border hover:bg-bg-subtle"
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
              <p className="text-fg-muted mb-6 leading-relaxed">{ROLES[activeRole].desc}</p>

              {/* Per-role stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {ROLES[activeRole].stats.map(s => (
                  <div key={s.label} className="p-3 rounded-lg bg-bg border text-center">
                    <div className="text-sm font-bold">{s.value}</div>
                    <div className="text-[10px] text-fg-muted mt-0.5 leading-tight">{s.label}</div>
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
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-growth-amber-soft rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-fuchsia-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-start mb-14">
            <div className="lg:col-span-6">
              <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">AI Assistant · 6 systems</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Not a chatbot.<br />
                <span className="bg-gradient-to-r from-amber-300 to-fuchsia-300 bg-clip-text text-transparent">A mentorship operating system.</span>
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed">
                Six coordinated systems that scope data, cache aggressively, score attention, draft actions, balance teacher load, and teach the teacher how to intervene — all per role, all auditable.
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
                    <div className="text-[10px] uppercase tracking-wider text-growth-amber font-bold">System {s.num}</div>
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
              <Quote className="w-5 h-5 text-growth-amber flex-shrink-0 mt-1" />
              <div>
                <div className="text-xs uppercase tracking-wider text-growth-amber font-bold mb-1">Real example</div>
                <p className="text-lg text-white font-medium mb-3">"Who's likely to drop off in the next two weeks?"</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Sam Ali and Maria Cruz appear most likely to drop off. Both have low progress and low latest scores. Sam hasn&apos;t logged in for 14 days and has a blocked task; Maria has the longest gap (21 days), declining database queries, and a recent score drop on the Week 3 test.
                </p>
                <div className="mt-3 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">References:</span> Sam Ali (progress: 28%, daysSinceContact: 14, blockedTasks: 1) · Maria Cruz (progress: 22%, daysSinceContact: 21, week3ScoreDrop: -18)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* HUMAN MENTORING AT SCALE — the human loop */}
      {/* ============================================ */}
      <section id="mentorship" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mb-14">
            <Badge variant="outline" className="mb-3"><HeartPulse className="w-3 h-3 mr-1" /> Human Mentoring at Scale</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              AI surfaces signal.<br />
              <span className="text-fg-muted">Humans provide judgment.</span>
            </h2>
            <p className="text-fg-muted text-lg leading-relaxed">
              Every student interaction feeds a 4-stage loop that turns activity into attention scores, attention scores into alerts, alerts into a drafted check-in message — with the AI drafting the action and the human confirming it. Every step is auditable. Every intervention is documented. The AI never acts alone.
            </p>
          </div>

          {/* The 4-stage loop */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
            {MENTOR_LOOP_STAGES.map(stage => (
              <div key={stage.num} className={`p-5 rounded-xl bg-gradient-to-br ${stage.color} border`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-bg ${stage.iconColor}`}>
                    <stage.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-fg-muted font-bold">Stage {stage.num} · {stage.short}</div>
                    <h3 className="font-semibold text-sm">{stage.title}</h3>
                  </div>
                </div>
                <p className="text-xs text-fg-muted leading-relaxed">{stage.desc}</p>
              </div>
            ))}
          </div>

          {/* Two parallel tracks: student + teacher */}
          <div className="grid md:grid-cols-2 gap-6 mb-14">
            <div className="p-6 rounded-2xl border bg-surface">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-950/30 text-blue-600">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-fg-muted font-bold">Track 1</div>
                  <h3 className="font-semibold">Student academic mentoring</h3>
                </div>
              </div>
              <p className="text-sm text-fg-muted mb-4 leading-relaxed">
                Teacher is the first responder. Coordinator sees institution-wide academics. The AI Assistant surfaces who needs help today and drafts the check-in message — the teacher sends it.
              </p>
              <ul className="space-y-2 text-xs text-fg-muted">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-growth-sage flex-shrink-0 mt-0.5" /> Attention-scored triage queue ranks who needs help today</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-growth-sage flex-shrink-0 mt-0.5" /> AI-drafted check-in messages with one-tap note presets</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-growth-sage flex-shrink-0 mt-0.5" /> Per-topic skill mastery highlights exactly what to review</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-growth-sage flex-shrink-0 mt-0.5" /> Every action recorded with note + outcome + follow-up</li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl border bg-surface">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-growth-sage-soft dark:bg-emerald-950/30 text-growth-sage">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-fg-muted font-bold">Track 2</div>
                  <h3 className="font-semibold">Teacher load management</h3>
                </div>
              </div>
              <p className="text-sm text-fg-muted mb-4 leading-relaxed">
                Teachers are people too. Burned-out teachers fail students. Load score = students × 1 + batches × 15 + alerts × 5 + overdue × 3. Green &lt; 50, amber 50–99, red ≥ 100.
              </p>
              <ul className="space-y-2 text-xs text-fg-muted">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-growth-sage flex-shrink-0 mt-0.5" /> Teacher sees their own load tier — full transparency</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-growth-sage flex-shrink-0 mt-0.5" /> Coordinator sees staff load distribution + can reassign</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-growth-sage flex-shrink-0 mt-0.5" /> AI suggests co-teachers — never proposes warning/red candidates</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-growth-sage flex-shrink-0 mt-0.5" /> Red-tier load auto-escalates — no 7-day timer</li>
              </ul>
            </div>
          </div>

          {/* What this is NOT */}
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: "Not surveillance", desc: "Observes learning activity. No off-platform tracking, no location, no device monitoring." },
              { title: "Not punishment", desc: "Triggers support, not discipline. Alerts are framed as 'reach out and check in'." },
              { title: "Not a replacement for teachers", desc: "AI drafts, humans decide. Teachers provide judgment the AI never will." },
              { title: "Not a black box", desc: "Every alert has a cited reason. Every action is logged. Every intervention is auditable." },
            ].map(item => (
              <div key={item.title} className="p-3 rounded-lg border bg-bg-subtle/30">
                <div className="text-xs font-bold mb-1 flex items-center gap-1.5">
                  <X className="w-3 h-3 text-fg-muted" />
                  {item.title}
                </div>
                <div className="text-[11px] text-fg-muted leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>

          {/* Deep-dive link */}
          <div className="mt-10 text-center">
            <p className="text-xs text-fg-muted mb-3">
              The full loop — including the AI Tutor teaching rules, Socratic test chatbot logic, attention score, and the action dialog — is documented in:
            </p>
            <div className="inline-flex items-center gap-3 text-sm">
              <Badge variant="secondary" className="font-mono">docs/architecture.md</Badge>
              <Badge variant="secondary" className="font-mono">docs/frontend.md</Badge>
              <Badge variant="secondary" className="font-mono">docs/api.md</Badge>
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
              <p className="text-fg-muted text-lg mb-6 leading-relaxed">
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
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-brand-subtle text-brand">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* TEACHER FEATURES */}
      {/* ============================================ */}
      <section id="instructor" className="py-20 lg:py-28 bg-bg-subtle/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-14">
            <div className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 rounded-2xl blur-xl" />
                <BrowserFrame
                  src="/screenshots/student-portfolio.png"
                  alt="Student portfolio with project progress and skill mastery"
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
              <p className="text-fg-muted text-lg mb-6 leading-relaxed">
                The AI does the teaching. You do the mentoring. Attention-scored triage queue tells you who needs help most. Per-student portfolio shows project progress, skill mastery, and test history. AI Assistant answers batch questions in natural language. One teacher can now mentor 50–500+ students.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs"><GitBranch className="w-3 h-3 mr-1" /> Project Visibility</Badge>
                <Badge variant="secondary" className="text-xs"><Activity className="w-3 h-3 mr-1" /> Skill Mastery</Badge>
                <Badge variant="secondary" className="text-xs"><Target className="w-3 h-3 mr-1" /> Actionable Interventions</Badge>
                <Badge variant="secondary" className="text-xs"><Bot className="w-3 h-3 mr-1" /> AI Assistant</Badge>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TEACHER_FEATURES.map(f => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-brand-subtle text-brand">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SKILL MASTERY — actionable per-topic insight */}
      {/* ============================================ */}
      <section id="psychology" className="py-20 lg:py-28 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">Per-Topic Mastery</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Understand every student,<br />topic by topic.
            </h2>
            <p className="text-slate-300 text-lg">
              Every test and practice question feeds the per-topic mastery model. Each topic has a level (not-started → developing → proficient → mastered) and a trend (improving / stable / declining) — with concrete teacher actions per topic.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">Educational Tab</Badge>
              <h3 className="text-2xl font-bold mb-3">Trajectory, mastery, attention — all in one view.</h3>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Teachers see per-week trajectory (improving/stable/declining), per-topic mastery with weak sub-topics called out, attention flags with cited reasons, and the student&apos;s full assessment history.
              </p>
              <div className="space-y-2">
                {["Per-topic mastery levels", "Trend tracking per topic", "Attention flags with reasons", "Per-week trajectory analysis", "Full assessment history"].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-growth-sage flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-r from-fuchsia-500/30 to-purple-500/30 rounded-2xl blur-xl" />
              <BrowserFrame
                src="/screenshots/educational-tab.png"
                alt="Educational Tab"
                url="examiner.ai/app · teacher · portfolio · educational"
                className="relative ring-1 ring-white/20"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* ACTIONABLE INTERVENTIONS */}
      {/* ============================================ */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <BrowserFrame
                src="/screenshots/mentorship-tab.png"
                alt="Actionable Interventions"
                url="examiner.ai/app · teacher · portfolio · interventions"
              />
            </div>
            <div className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-3">Actionable Interventions</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Structured mentoring<br />that actually works.
              </h2>
              <p className="text-fg-muted text-lg mb-6 leading-relaxed">
                Every intervention follows a clear structure: alert → AI-drafted check-in → teacher edits → send → outcome tracked → follow-up scheduled. The AI never sends anything on its own — it drafts, the teacher confirms.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { letter: "1", title: "Alert surfaces", desc: "Inactivity, score drop, or blocked task triggers a notification with cited evidence.", color: "bg-growth-amber-soft text-growth-amber-foreground dark:bg-amber-950/40 dark:text-growth-amber" },
                  { letter: "2", title: "AI drafts check-in", desc: "Suggested message + 3 one-tap note presets, grounded in the student's actual data.", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
                  { letter: "3", title: "Teacher confirms", desc: "Confirm disabled until teacher writes a note. Every action is logged with reason.", color: "bg-growth-sage-soft text-growth-sage-foreground dark:text-emerald-300" },
                  { letter: "4", title: "Outcome + follow-up", desc: "Teacher records outcome + optional follow-up date. Closes the loop.", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
                ].map(item => (
                  <div key={item.letter} className="flex items-start gap-3 p-3 rounded-lg border bg-surface">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${item.color} flex-shrink-0`}>
                      {item.letter}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{item.title}</div>
                      <div className="text-xs text-fg-muted">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="text-xs"><Target className="w-3 h-3 mr-1" /> Alert-driven</Badge>
                <Badge variant="secondary" className="text-xs"><Bot className="w-3 h-3 mr-1" /> AI-drafted</Badge>
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
      <section className="py-20 lg:py-28 bg-bg-subtle/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-3">Educational Tab</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Skill mastery,<br />not just scores.
              </h2>
              <p className="text-fg-muted text-lg mb-6 leading-relaxed">
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
                    <div className="w-9 h-9 rounded-lg bg-brand-subtle flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-brand" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{item.title}</div>
                      <div className="text-xs text-fg-muted">{item.desc}</div>
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
            <p className="text-fg-muted text-lg">
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
                  <div className="p-3 bg-bg">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-fg-muted mt-0.5">{t.desc}</div>
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-growth-amber-soft rounded-full blur-3xl" />
        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">Platform</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built to scale.<br />Built to be safe.
            </h2>
            <p className="text-slate-300 text-lg">
              DeepSeek V4 Flash as primary AI (cheap + fast). Z.ai as fallback. Role-based RBAC with IDOR protection. Lightweight telemetry that scales to 10,000+ students.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
            {PLATFORM_FEATURES.map(f => (
              <div key={f.title} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-growth-amber/20 text-growth-amber">
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
                <div className="text-3xl md:text-4xl font-bold text-growth-amber mb-1">{s.value}</div>
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
            Run your bootcamp on TraineesAI.
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
                <span className="text-white font-bold">TraineesAI</span>
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
                <li><a href="#psychology" className="hover:text-white">Mastery</a></li>
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
            <div>© 2026 TraineesAI · Inzet Enterprises. All rights reserved.</div>
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
