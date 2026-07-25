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
  ChevronRight, Quote,
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
    tagline: "Learn by reasoning, not memorising.",
    desc: "Socratic daily/weekly tests, AI Tutor that adapts to your language, project planning with AI-generated tasks, progress tracking, and verifiable certificates.",
    stats: [
      { label: "Test types", value: "3" },
      { label: "AI tutor languages", value: "∞" },
      { label: "Project tasks", value: "AI-gen" },
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
  { icon: Bot, title: "AI Tutor", desc: "Friendly chatbot that teaches today's topic, connects to the student's capstone project, and handles disengagement with empathy." },
  { icon: ClipboardCheck, title: "Socratic Daily Test", desc: "3-question check-in with confidence self-rating. Per-question explanations revealed immediately, not at end-of-test." },
  { icon: FileText, title: "Weekly Test", desc: "15-question Socratic exam with plagiarism analysis, per-question explanations, and full 7-dimension psychological assessment." },
  { icon: Lightbulb, title: "Per-Question Explanations", desc: "Correct answer, why it's correct, specific encouragement — immediately after every question. Learn from every question." },
  { icon: GitBranch, title: "Project Planning", desc: "AI-generated tasks, Gantt chart, week plan, project reports with AI analysis. Full capstone tracking from day 1 to final review." },
  { icon: Award, title: "Report Cards & Certificates", desc: "Auto-generated from test scores (80% weekly + 20% practice). Certificates are publicly verifiable via shareable URL." },
  { icon: Calendar, title: "Daily Check-in", desc: "Confidence rating + learning reflection: what did you learn, what confused you, your next question for tomorrow." },
  { icon: MessageCircle, title: "Ask My Teacher", desc: "Floating button for quick questions to the assigned teacher. Daily task reminder popup keeps students on track." },
];

const TEACHER_FEATURES = [
  { icon: Users, title: "Attention-Scored Triage", desc: "Students auto-ranked by who needs help most: inactivity, score drops, low confidence, blocked tasks, high cognitive load." },
  { icon: Brain, title: "7-Dimension Psychology", desc: "Calibration, explanatory depth, gaming pattern, attribution, cognitive load, SRL phase, fluency — with concrete teacher actions." },
  { icon: Target, title: "GROW Mentorship", desc: "Structured coaching: Goal, Reality, Options, Will. Alert-driven actions, outcome tracking, follow-up scheduling." },
  { icon: Activity, title: "Student Health Summary", desc: "Mood score, engagement score, avg test score, engagement streak — color-coded with signal badges per student." },
  { icon: Bell, title: "Automated Alerts", desc: "Psych / educational / mentorship alerts fire automatically when students cross thresholds. Action dialog with AI-drafted notes." },
  { icon: Bot, title: "AI Assistant", desc: "Natural-language batch queries: 'Who's likely to drop off?' — answered from existing data with cited student evidence." },
  { icon: BookOpen, title: "Course Planner", desc: "Course CRUD, batch assignment, AI course generation. Full curriculum control with weekly phase + daily topic structure." },
  { icon: BarChart3, title: "Project Analysis", desc: "Comprehensive final project evaluation: execution, technical competence, quality, career readiness. AI-generated strengths and weaknesses." },
];

const TRUST_STATS = [
  { value: "44+", label: "Data models" },
  { value: "6", label: "Role dashboards" },
  { value: "7", label: "Psych dimensions" },
  { value: "7", label: "AI Assistant systems" },
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
              <div className="text-[10px] text-muted-foreground leading-tight">Socratic Assessment &amp; Mentorship</div>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#big-idea" className="text-muted-foreground hover:text-foreground transition-colors">Why</a>
            <a href="#dashboards" className="text-muted-foreground hover:text-foreground transition-colors">Roles</a>
            <a href="#ai-assistant" className="text-muted-foreground hover:text-foreground transition-colors">AI Assistant</a>
            <a href="#psychology" className="text-muted-foreground hover:text-foreground transition-colors">Psychology</a>
            <a href="#themes" className="text-muted-foreground hover:text-foreground transition-colors">Themes</a>
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
            <a href="#dashboards" onClick={() => setMobileNav(false)} className="block py-1.5">Roles</a>
            <a href="#ai-assistant" onClick={() => setMobileNav(false)} className="block py-1.5">AI Assistant</a>
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
                Live demo available · No signup required
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
                Socratic assessment.
                <span className="block bg-gradient-to-r from-amber-300 via-rose-300 to-fuchsia-300 bg-clip-text text-transparent">
                  AI mentorship.
                </span>
                <span className="block">Real insight.</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed">
                ExaminerAI unifies Socratic testing, AI tutoring, 7-dimension psychology, GROW coaching, and automated safeguarding — built for bootcamps and vocational programs, not repurposed from a university LMS.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <Link href="/app">
                  <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white text-base h-12 px-6 shadow-lg shadow-amber-500/20">
                    <Sparkles className="w-5 h-5 mr-2" /> Launch Live Demo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="#big-idea">
                  <Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white text-base h-12 px-6">
                    See how it works
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
                  <Sparkles className="w-3.5 h-3.5" /> Powered by DeepSeek V4 Flash
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
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Deployed in production at</span>
            <div className="flex items-center gap-3">
              <img
                src="https://fccl.com.pk/eng/wp-content/uploads/2025/01/cropped-SITE-IDENTITY-ICON-270x270.webp"
                alt="FCCL Logo"
                className="w-10 h-10 rounded object-contain bg-white border"
              />
              <div>
                <div className="text-sm font-semibold">FCCL JB Plant Institute of Technology</div>
                <div className="text-xs text-muted-foreground">Jhang Bahtar, Attock, Punjab · Fall 2025 cohort · 50+ active students</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* BIG IDEA — 3 pillars */}
      {/* ============================================ */}
      <section id="big-idea" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mb-14">
            <Badge variant="outline" className="mb-3">The big idea</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Most LMS platforms grade work.<br />
              <span className="text-muted-foreground">ExaminerAI understands the worker.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Three systems work together to turn every interaction into mentorship-grade insight — without drowning teachers in data or flooding the database.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                icon: MessageSquare,
                title: "Socratic by default",
                desc: "Every test — practice, daily, weekly — uses the Socratic method. The AI doesn't grade answers; it probes reasoning. Per-question explanations land immediately, not at end-of-test, so students learn from every question.",
                gradient: "from-blue-500/10 to-cyan-500/10",
                iconColor: "text-blue-600",
              },
              {
                num: "02",
                icon: Brain,
                title: "7-dimension psychology",
                desc: "Every test completion runs a full analysis pipeline that writes 7 PsychEvidence rows — calibration, explanatory depth, gaming pattern, attribution, cognitive load, SRL phase, fluency. Teachers see trajectory, not snapshots.",
                gradient: "from-fuchsia-500/10 to-purple-500/10",
                iconColor: "text-fuchsia-600",
              },
              {
                num: "03",
                icon: Bot,
                title: "AI that actually mentors",
                desc: "The AI Assistant doesn't just answer questions — it scopes data per role, escalates amber flags after 7 days, drafts action notes, monitors teacher-to-student safeguarding, and teaches the teacher how to intervene.",
                gradient: "from-amber-500/10 to-rose-500/10",
                iconColor: "text-amber-600",
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
      {/* STUDENT FEATURES */}
      {/* ============================================ */}
      <section id="student" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-14">
            <div>
              <Badge variant="outline" className="mb-3">For Students</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Learn by reasoning,<br />not memorising.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Every question uses the Socratic method. Per-question explanations reveal immediately — students learn from every question, not just at end-of-test. The AI Tutor adapts to their language and handles disengagement with empathy.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs"><Bot className="w-3 h-3 mr-1" /> AI Tutor</Badge>
                <Badge variant="secondary" className="text-xs"><ClipboardCheck className="w-3 h-3 mr-1" /> Socratic Tests</Badge>
                <Badge variant="secondary" className="text-xs"><GitBranch className="w-3 h-3 mr-1" /> Project Planning</Badge>
                <Badge variant="secondary" className="text-xs"><Award className="w-3 h-3 mr-1" /> Certificates</Badge>
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
                  alt="Student portfolio with 7-dimension psychology"
                  url="examiner.ai/app · teacher · students/[id]"
                  className="relative"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-3">For Teachers</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                See every student.<br />Know what to do next.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Full batch visibility with attention-scored triage queue. Student portfolios with Psychological, Educational, and Mentorship tabs. GROW coaching tools, automated alerts, and a natural-language AI Assistant for batch queries — everything a teacher needs to actually mentor, not just grade.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs"><Brain className="w-3 h-3 mr-1" /> 7-Dimension Psychology</Badge>
                <Badge variant="secondary" className="text-xs"><Target className="w-3 h-3 mr-1" /> GROW Coaching</Badge>
                <Badge variant="secondary" className="text-xs"><Bell className="w-3 h-3 mr-1" /> Automated Alerts</Badge>
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
            Ready to see it in action?
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            One click. No signup. Explore every dashboard, every feature, every role. The demo account is read-only — try every action, nothing breaks.
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
                Socratic assessment &amp; mentorship platform. Built for institutions that take student development seriously — not repurposed from a university LMS.
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
                <li><a href="#dashboards" className="hover:text-white">Roles</a></li>
                <li><a href="#ai-assistant" className="hover:text-white">AI Assistant</a></li>
                <li><a href="#psychology" className="hover:text-white">Psychology</a></li>
                <li><a href="#themes" className="hover:text-white">Themes</a></li>
                <li><a href="#tech" className="hover:text-white">Platform</a></li>
                <li><Link href="/app" className="hover:text-white">Live Demo</Link></li>
              </ul>
            </div>

            <div>
              <div className="text-white font-semibold text-sm mb-3">Institution</div>
              <ul className="space-y-2 text-sm">
                <li>FCCL JB Plant IT</li>
                <li>Jhang Bahtar, Attock</li>
                <li>Punjab, Pakistan</li>
                <li>info@fccl.com.pk</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 my-6" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div>© 2026 ExaminerAI · FCCL JB Plant IT. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <span>v1.0.0</span>
              <span>·</span>
              <span>Fall 2025 Semester</span>
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
