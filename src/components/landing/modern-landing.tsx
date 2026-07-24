"use client";

import { useState } from "react";
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
  CheckSquare, Star, Activity, Layers
} from "lucide-react";

const ROLES = [
  { id: "student", label: "Student", icon: GraduationCap, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30", screenshot: "/screenshots/dashboard-student.png", desc: "AI Tutor, Socratic tests, project planning, daily check-ins, progress tracking, and certificates." },
  { id: "teacher", label: "Teacher", icon: BookOpen, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30", screenshot: "/screenshots/dashboard-teacher.png", desc: "Batch dashboard, student portfolios, 7-dimension psychology, GROW coaching, AI assistant." },
  { id: "counselor", label: "Counsellor", icon: Brain, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30", screenshot: "/screenshots/dashboard-counselor.png", desc: "Wellbeing states, crisis flags, mentorship touchpoints, case reviews, scoped access." },
  { id: "principal", label: "Principal", icon: Building2, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30", screenshot: "/screenshots/dashboard-principal.png", desc: "Institution-wide analytics, teacher behavior, audit log, all pastoral (crisis) access." },
  { id: "admin", label: "Admin", icon: ShieldCheck, color: "text-slate-600 bg-slate-100 dark:bg-slate-800/50", screenshot: "/screenshots/dashboard-admin.png", desc: "User management, feature flags, system health, AI config, password resets, maintenance." },
];

const STUDENT_FEATURES = [
  { icon: Bot, title: "AI Tutor", desc: "Friendly, polite chatbot that teaches today's topic, connects it to the student's project, and handles disengagement with empathy." },
  { icon: ClipboardCheck, title: "Socratic Daily Test", desc: "3-question check-in on today's topic with confidence self-rating. Per-question explanations revealed immediately." },
  { icon: FileText, title: "Weekly Test", desc: "15-question Socratic exam with plagiarism analysis, per-question explanations, and psychological assessment." },
  { icon: Lightbulb, title: "Per-Question Explanations", desc: "After every question: correct answer, why it's correct, and specific encouragement — immediately, not at end-of-test." },
  { icon: GitBranch, title: "Project Planning", desc: "AI-generated tasks, Gantt chart, week plan, project reports with AI analysis. Full capstone tracking." },
  { icon: Award, title: "Report Cards & Certificates", desc: "Auto-generated from test scores (80% weekly + 20% practice). Certificates are publicly verifiable." },
  { icon: Calendar, title: "Daily Check-in", desc: "Confidence rating + learning reflection: what did you learn, what confused you, your next question." },
  { icon: MessageCircle, title: "Ask My Teacher", desc: "Floating button for quick questions to the assigned teacher. Daily task reminder popup." },
];

const TEACHER_FEATURES = [
  { icon: Users, title: "Batch Dashboard", desc: "Student list with attention flags, sorted by who needs help most. Amber badge shows open alert count." },
  { icon: Brain, title: "7-Dimension Psychology", desc: "Calibration, explanatory depth, gaming pattern, attribution, cognitive load, SRL phase, fluency — with teacher actions." },
  { icon: Target, title: "GROW Mentorship", desc: "Structured coaching: Goal, Reality, Options, Will. Alert-driven actions, outcome tracking, follow-up scheduling." },
  { icon: Activity, title: "Student Health Summary", desc: "Mood score, engagement score, avg test score, engagement streak — color-coded with signal badges." },
  { icon: Bell, title: "Automated Alerts", desc: "Psych/educational/mentorship alerts fire automatically when students cross thresholds." },
  { icon: Bot, title: "AI Assistant", desc: "Teaching assistance chatbot for lesson prep, case review, rubrics, parent communications." },
  { icon: BookOpen, title: "Course Planner", desc: "Course CRUD, batch assignment, AI course generation. Full curriculum control." },
  { icon: BarChart3, title: "Project Analysis", desc: "Comprehensive final project evaluation: execution, technical competence, quality, career readiness." },
];

const PSYCH_DIMENSIONS = [
  { num: "1", name: "Calibration", desc: "Does the student know what they know? (Dunning-Kruger)", icon: Target, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  { num: "2", name: "Explanatory Depth", desc: "How deeply do they explain reasoning?", icon: Lightbulb, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
  { num: "3", name: "Gaming Pattern", desc: "Is the student using AI to generate answers?", icon: Eye, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30" },
  { num: "4", name: "Attribution / Mindset", desc: "Growth vs. fixed mindset (Dweck)", icon: Brain, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
  { num: "5", name: "Cognitive Load", desc: "How hard is the material right now? (Sweller)", icon: Cpu, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30" },
  { num: "6", name: "SRL Phase", desc: "Self-Regulated Learning phase (Zimmerman)", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  { num: "7", name: "Fluency / Retention", desc: "Knowledge recall stability", icon: Activity, color: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30" },
];

const ADMIN_FEATURES = [
  { icon: Users, title: "User Management", desc: "Approve, block, delete, role change, batch approve." },
  { icon: BookOpen, title: "Course Management", desc: "Full CRUD, batch assignment, AI course generation." },
  { icon: Zap, title: "Feature Flags", desc: "Toggle features on/off: signup, practice, weekly tests, etc." },
  { icon: Lock, title: "Access Grants", desc: "Scoped access for counsellors: full/wellbeing_only/crisis_only/content_only." },
  { icon: ShieldCheck, title: "Audit Log", desc: "All admin actions tracked: role changes, approvals, blocks, grants." },
  { icon: Cpu, title: "System Health", desc: "AI usage stats, connection test, env var status, cache management." },
];

const TECH_STATS = [
  { value: "44", label: "Data models" },
  { value: "9", label: "Role dashboards" },
  { value: "7", label: "Psych dimensions" },
  { value: "134", label: "Tests passing" },
];

const PLATFORM_FEATURES = [
  { icon: Bot, title: "Multi-Provider AI", desc: "Z.ai (primary), DeepSeek (fallback), z-ai-web-dev-sdk (sandbox). Automatic failover." },
  { icon: ShieldCheck, title: "10-Role RBAC", desc: "Granular permissions with IDOR protection, AccessGrant scoping, and rate limiting." },
  { icon: Database, title: "Lightweight Data Collection", desc: "1 DB upsert per AI Tutor message (not 15-20 writes). Scales to 1000+ students." },
  { icon: Cpu, title: "AI Token Cache", desc: "Opt-in response cache reduces AI costs on cacheable calls." },
  { icon: Bell, title: "Automated Alert Engine", desc: "Psychological, educational, and mentorship alerts fire automatically on threshold crossings." },
  { icon: Lock, title: "Audit & Compliance", desc: "Every sensitive action logged. Full audit trail for institutional compliance." },
];

export function ModernLanding() {
  const [activeRole, setActiveRole] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* ============================================ */}
      {/* NAV */}
      {/* ============================================ */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight">ExaminerAI</div>
              <div className="text-[10px] text-muted-foreground leading-tight">Socratic Assessment & Mentorship</div>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#student" className="text-muted-foreground hover:text-foreground transition-colors">Student</a>
            <a href="#teacher" className="text-muted-foreground hover:text-foreground transition-colors">Teacher</a>
            <a href="#psychology" className="text-muted-foreground hover:text-foreground transition-colors">Psychology</a>
            <a href="#admin" className="text-muted-foreground hover:text-foreground transition-colors">Admin</a>
            <a href="#tech" className="text-muted-foreground hover:text-foreground transition-colors">Platform</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
            </Link>
            <Link href="/app">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
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
            <a href="#student" onClick={() => setMobileNav(false)} className="block py-1.5">Student</a>
            <a href="#teacher" onClick={() => setMobileNav(false)} className="block py-1.5">Teacher</a>
            <a href="#psychology" onClick={() => setMobileNav(false)} className="block py-1.5">Psychology</a>
            <a href="#admin" onClick={() => setMobileNav(false)} className="block py-1.5">Admin</a>
            <a href="#tech" onClick={() => setMobileNav(false)} className="block py-1.5">Platform</a>
            <Link href="/app" className="block">
              <Button variant="outline" size="sm" className="w-full">Sign in</Button>
            </Link>
          </div>
        )}
      </header>

      {/* ============================================ */}
      {/* HERO */}
      {/* ============================================ */}
      <section id="top" className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 lg:px-8 py-20 lg:py-28 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live demo available · No signup required
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
              Socratic assessment,
              <span className="block bg-gradient-to-r from-amber-300 via-rose-300 to-fuchsia-300 bg-clip-text text-transparent">
                AI mentorship, real insight.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
              ExaminerAI unifies Socratic testing, AI tutoring, 7-dimension psychology, GROW coaching, and automated alerts — built for bootcamps and vocational programs, not repurposed from a university LMS.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <Link href="/app">
                <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white text-base h-12 px-6">
                  <Sparkles className="w-5 h-5 mr-2" /> Launch Live Demo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/app">
                <Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white text-base h-12 px-6">
                  Sign in
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8 border-t border-white/10">
              {TECH_STATS.map(s => (
                <div key={s.label}>
                  <div className="text-2xl md:text-3xl font-bold text-amber-300">{s.value}</div>
                  <div className="text-xs text-slate-400 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero screenshot */}
          <div className="mt-16 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-fuchsia-500/20 rounded-2xl blur-2xl" />
            <div className="relative rounded-xl border border-white/20 overflow-hidden shadow-2xl bg-white">
              <img
                src="/screenshots/dashboard-student.png"
                alt="ExaminerAI Student Dashboard"
                className="w-full h-auto"
              />
            </div>
            <div className="absolute -top-3 -right-3 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 text-amber-950 text-xs font-semibold shadow-lg">
              <Sparkles className="w-3.5 h-3.5" /> Live demo dashboard
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
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Deployed at</span>
            <div className="flex items-center gap-3">
              <img
                src="https://fccl.com.pk/eng/wp-content/uploads/2025/01/cropped-SITE-IDENTITY-ICON-270x270.webp"
                alt="FCCL Logo"
                className="w-10 h-10 rounded object-contain bg-white border"
              />
              <div>
                <div className="text-sm font-semibold">FCCL JB Plant Institute of Technology</div>
                <div className="text-xs text-muted-foreground">Jhang Bahtar, Attock, Punjab · Fall 2025 cohort</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* DASHBOARDS SHOWCASE */}
      {/* ============================================ */}
      <section id="dashboards" className="py-20 lg:py-28 bg-muted/30 border-y">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="mb-3">Role Dashboards</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Five dashboards. One platform.
            </h2>
            <p className="text-muted-foreground text-lg">
              Every role sees exactly what they need — no more, no less. Click a role to preview the live dashboard.
            </p>
          </div>

          {/* Role tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {ROLES.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setActiveRole(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeRole === i
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-background border hover:bg-accent'
                }`}
              >
                <r.icon className="w-4 h-4" />
                {r.label}
              </button>
            ))}
          </div>

          {/* Active role showcase */}
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 ${ROLES[activeRole].color}`}>
                {(() => {
                  const Icon = ROLES[activeRole].icon
                  return <Icon className="w-7 h-7" />
                })()}
              </div>
              <h3 className="text-2xl font-bold mb-3">{ROLES[activeRole].label} Dashboard</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">{ROLES[activeRole].desc}</p>
              <Link href="/app">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white">
                  <Sparkles className="w-4 h-4 mr-2" /> Preview live
                </Button>
              </Link>
            </div>

            <div className="lg:col-span-8">
              <div className="relative rounded-xl overflow-hidden border shadow-2xl bg-background">
                <div className="absolute top-0 left-0 right-0 h-9 bg-slate-100 dark:bg-slate-800 border-b flex items-center px-4 gap-1.5 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div className="ml-3 text-xs text-muted-foreground font-mono">
                    examiner.ai/app · {ROLES[activeRole].id}
                  </div>
                </div>
                <img
                  src={ROLES[activeRole].screenshot}
                  alt={`${ROLES[activeRole].label} dashboard`}
                  className="w-full h-auto pt-9"
                />
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
              <div className="relative rounded-xl overflow-hidden border shadow-2xl">
                <img src="/screenshots/ai-tutor.png" alt="AI Tutor" className="w-full h-auto" />
              </div>
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
                <div className="relative rounded-xl overflow-hidden border shadow-2xl">
                  <img src="/screenshots/student-portfolio.png" alt="Student Portfolio" className="w-full h-auto" />
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-3">For Teachers</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                See every student.<br />Know what to do next.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Full batch visibility with attention flags. Student portfolios with Psychological, Educational, and Mentorship tabs. GROW coaching tools, automated alerts, and an AI assistant for lesson prep — everything a teacher needs to actually mentor, not just grade.
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
              Every test completion runs a full analysis pipeline. Each dimension value comes with a teacher-facing explanation and a concrete recommended action.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
            {PSYCH_DIMENSIONS.map(d => (
              <div key={d.num} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
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
              <div className="relative rounded-xl overflow-hidden border border-white/20 shadow-2xl">
                <img src="/screenshots/psychological-tab.png" alt="Psychological Tab" className="w-full h-auto" />
              </div>
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
              <div className="relative rounded-xl overflow-hidden border shadow-2xl">
                <img src="/screenshots/mentorship-tab.png" alt="Mentorship Tab" className="w-full h-auto" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-3">GROW Coaching Model</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Structured mentorship<br />that actually works.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Every mentor session follows the proven GROW framework. Track both psychological and educational mentorship with outcome tracking and follow-up scheduling.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { letter: 'G', title: 'Goal', desc: 'What does the student want to achieve?', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
                  { letter: 'R', title: 'Reality', desc: 'Where are they now? What is the current situation?', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
                  { letter: 'O', title: 'Options', desc: 'What approaches, strategies, and resources are available?', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
                  { letter: 'W', title: 'Will', desc: 'What will the student commit to doing next?', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' }
                ].map(item => (
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
              <div className="relative rounded-xl overflow-hidden border shadow-2xl">
                <img src="/screenshots/educational-tab.png" alt="Educational Tab" className="w-full h-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* ADMIN FEATURES */}
      {/* ============================================ */}
      <section id="admin" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3">For Administrators</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Full institutional control.
            </h2>
            <p className="text-muted-foreground text-lg">
              User management, feature flags, system health, audit log, access grants — everything needed to run the platform at scale.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
            {ADMIN_FEATURES.map(f => (
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

          <div className="relative rounded-xl overflow-hidden border shadow-2xl max-w-5xl mx-auto">
            <div className="absolute top-0 left-0 right-0 h-9 bg-slate-100 dark:bg-slate-800 border-b flex items-center px-4 gap-1.5 z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div className="ml-3 text-xs text-muted-foreground font-mono">examiner.ai/app · admin</div>
            </div>
            <img src="/screenshots/dashboard-admin.png" alt="Admin Dashboard" className="w-full h-auto pt-9" />
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
              Multi-provider AI with automatic failover. 10-role RBAC with IDOR protection. Lightweight data collection that scales to 1000+ students without DB flooding.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PLATFORM_FEATURES.map(f => (
              <div key={f.title} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-amber-500/20 text-amber-300">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TECH_STATS.map(s => (
              <div key={s.label} className="text-center p-6 rounded-xl bg-white/5 border border-white/10">
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
      <section id="demo" className="py-20 lg:py-24 bg-gradient-to-br from-amber-500 via-rose-500 to-fuchsia-600 text-white">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Ready to see it in action?
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            One click. No signup. Explore every dashboard, every feature, every role.
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
                Socratic assessment & mentorship platform. Built for institutions that take student development seriously.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">Next.js 16</Badge>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">Prisma + Postgres</Badge>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">Z.ai + DeepSeek</Badge>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">shadcn/ui</Badge>
              </div>
            </div>

            <div>
              <div className="text-white font-semibold text-sm mb-3">Platform</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#student" className="hover:text-white">Student</a></li>
                <li><a href="#teacher" className="hover:text-white">Teacher</a></li>
                <li><a href="#psychology" className="hover:text-white">Psychology</a></li>
                <li><a href="#admin" className="hover:text-white">Admin</a></li>
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
