'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  GraduationCap, Sparkles, Eye, ArrowRight, ShieldCheck, Users, Brain,
  BarChart3, MessageSquare, Bell, BookOpen, Target, Zap, CheckCircle2,
  Menu, X, Clock, TrendingUp, Building2, AlertTriangle, HeartPulse
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-store'
import { useRouter } from 'next/navigation'

const ROLES = [
  { id: 'STUDENT', label: 'Student', icon: GraduationCap, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30', screenshot: '/screenshots/demo-student.png', desc: 'Track grades, attendance, alerts, and mentor sessions in one place.' },
  { id: 'TEACHER', label: 'Teacher', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30', screenshot: '/screenshots/demo-teacher.png', desc: 'Gradebook, attendance, alerts to counsellor, and pending submissions.' },
  { id: 'COUNSELOR', label: 'Counsellor', icon: Brain, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30', screenshot: '/screenshots/demo-counsellor.png', desc: 'Urgent wellbeing queue, alert responses, and assigned student caseload.' },
  { id: 'MENTOR', label: 'Mentor', icon: Users, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30', screenshot: '/screenshots/demo-mentor.png', desc: 'GROW coaching log — psychological & educational sessions with mood tracking.' },
  { id: 'PRINCIPAL', label: 'Principal', icon: Building2, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30', screenshot: '/screenshots/demo-principal.png', desc: 'Institution-wide analytics, course performance, growth reports, audit log.' },
  { id: 'ADMIN', label: 'Admin', icon: ShieldCheck, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800/50', screenshot: '/screenshots/demo-admin.png', desc: 'System-wide oversight, user management, audit trails, and platform health.' }
]

const FEATURES = [
  { icon: BarChart3, title: 'Role-Based Dashboards', desc: 'Six specialised dashboards — each tuned to what that role actually needs to see and act on.', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  { icon: Brain, title: 'GROW Coaching Model', desc: 'Structured mentorship using Goal → Reality → Options → Will framework for every session.', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  { icon: HeartPulse, title: 'Psychological Mentorship', desc: 'Confidential psychological sessions with mood tracking, coping strategies, and follow-ups.', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30' },
  { icon: Bell, title: 'Real-Time Alerts', desc: 'Teachers raise alerts → counsellor responds → status tracked from OPEN to RESOLVED.', color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
  { icon: Sparkles, title: 'AI Course Generation', desc: 'Auto-generate course outlines, weekly schedules, assessments, and timeline events.', color: 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30' },
  { icon: Target, title: 'Educational Mentorship', desc: 'Academic coaching — study schedules, problem-solving approaches, exam strategy.', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  { icon: MessageSquare, title: 'Role-Aware Messaging', desc: 'Students, teachers, counsellors, mentors, and principals — all connected.', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
  { icon: TrendingUp, title: 'Institution Analytics', desc: 'Course performance, alert resolution rates, mentor session impact — for leadership.', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  { icon: ShieldCheck, title: 'Audit & Compliance', desc: 'Every action logged. Principals and admins get a full audit trail.', color: 'text-slate-600 bg-slate-100 dark:bg-slate-800/50' }
]

const STATS = [
  { value: '50+', label: 'Students seeded' },
  { value: '7', label: 'Role dashboards' },
  { value: '30+', label: 'Mentor sessions' },
  { value: '30+', label: 'Real alerts' }
]

export function LandingPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginMode, setLoginMode] = useState<'demo' | 'signin'>('demo')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeRole, setActiveRole] = useState(0)
  const [mobileNav, setMobileNav] = useState(false)

  const handleDemoLogin = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@examiner.ai', password: 'demo123' })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Login failed')
      await refresh()
      setLoginOpen(false)
      toast.success('Welcome to the ExaminerAI Demo!', {
        description: 'You are logged in as Demo Developer. Use the role switcher in the top bar to preview any dashboard.'
      })
      router.push('/')
    } catch (e: any) {
      toast.error('Login failed', { description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: password || 'demo123' })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Login failed')
      await refresh()
      setLoginOpen(false)
      toast.success(`Welcome back, ${d.user.name}!`)
      router.push('/')
    } catch (e: any) {
      toast.error('Login failed', { description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const openDemo = () => { setLoginMode('demo'); setLoginOpen(true) }
  const openSignIn = () => { setLoginMode('signin'); setLoginOpen(true) }

  return (
    <div className="min-h-screen bg-background">
      {/* ============================================ */}
      {/* NAV */}
      {/* ============================================ */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight">ExaminerAI</div>
              <div className="text-[10px] text-muted-foreground leading-tight">FCCL JB Plant IT</div>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#dashboards" className="text-muted-foreground hover:text-foreground transition-colors">Dashboards</a>
            <a href="#grow" className="text-muted-foreground hover:text-foreground transition-colors">GROW Model</a>
            <a href="#demo" className="text-muted-foreground hover:text-foreground transition-colors">Live Demo</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={openSignIn} className="hidden sm:inline-flex">Sign in</Button>
            <Button size="sm" onClick={openDemo} className="bg-amber-500 hover:bg-amber-600 text-white">
              <Sparkles className="w-4 h-4 mr-1.5" /> Try Demo
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {mobileNav && (
          <div className="md:hidden border-t bg-background px-4 py-3 space-y-2 text-sm">
            <a href="#features" onClick={() => setMobileNav(false)} className="block py-1.5">Features</a>
            <a href="#dashboards" onClick={() => setMobileNav(false)} className="block py-1.5">Dashboards</a>
            <a href="#grow" onClick={() => setMobileNav(false)} className="block py-1.5">GROW Model</a>
            <a href="#demo" onClick={() => setMobileNav(false)} className="block py-1.5">Live Demo</a>
            <Button variant="outline" size="sm" onClick={() => { openSignIn(); setMobileNav(false) }} className="w-full">Sign in</Button>
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
              The AI-powered platform for
              <span className="block bg-gradient-to-r from-amber-300 via-rose-300 to-fuchsia-300 bg-clip-text text-transparent">
                assessment & mentorship.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
              ExaminerAI unifies academic evaluation, GROW-model coaching, psychological & educational mentorship, real-time alerts, and analytics — built for students, teachers, counsellors, mentors, principals, and admins.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <Button size="lg" onClick={openDemo} className="bg-amber-500 hover:bg-amber-600 text-white text-base h-12 px-6">
                <Sparkles className="w-5 h-5 mr-2" /> Launch Live Demo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={openSignIn} className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white text-base h-12 px-6">
                Sign in
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8 border-t border-white/10">
              {STATS.map(s => (
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
                src="/screenshots/demo-developer.png"
                alt="ExaminerAI Developer Dashboard"
                className="w-full h-auto"
              />
            </div>
            <div className="absolute -top-3 -right-3 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 text-amber-950 text-xs font-semibold shadow-lg">
              <Eye className="w-3.5 h-3.5" /> Live demo dashboard
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
      {/* FEATURES */}
      {/* ============================================ */}
      <section id="features" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Everything your institution needs,<br className="hidden md:inline" /> in one platform.
            </h2>
            <p className="text-muted-foreground text-lg">
              From day-to-day assessment to long-term mentorship — ExaminerAI covers the full academic lifecycle.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
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
              Six dashboards. One platform.
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
                    ? 'bg-slate-900 text-white shadow-md'
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
              <Button onClick={openDemo} className="bg-amber-500 hover:bg-amber-600 text-white">
                <Eye className="w-4 h-4 mr-2" /> Preview live
              </Button>
            </div>

            <div className="lg:col-span-8">
              <div className="relative rounded-xl overflow-hidden border shadow-2xl bg-background">
                <div className="absolute top-0 left-0 right-0 h-9 bg-slate-100 dark:bg-slate-800 border-b flex items-center px-4 gap-1.5 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div className="ml-3 text-xs text-muted-foreground font-mono">
                    examiner.ai/{ROLES[activeRole].id.toLowerCase()}
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
      {/* GROW MENTORSHIP HIGHLIGHT */}
      {/* ============================================ */}
      <section id="grow" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative rounded-xl overflow-hidden border shadow-2xl">
                <img
                  src="/screenshots/demo-mentor.png"
                  alt="GROW mentor dashboard"
                  className="w-full h-auto"
                />
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-3">GROW Coaching Model</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Structured mentorship that actually works.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Every mentor session follows the proven GROW framework — Goal, Reality, Options, Will. Track both psychological and educational mentorship in one place.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { letter: 'G', title: 'Goal', desc: 'What does the student want to achieve this session?', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
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
                <Badge variant="secondary" className="text-xs">
                  <HeartPulse className="w-3 h-3 mr-1" /> Psychological sessions
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <Target className="w-3 h-3 mr-1" /> Educational sessions
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" /> Follow-up tracking
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <Brain className="w-3 h-3 mr-1" /> Mood tracking
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* AI FEATURES */}
      {/* ============================================ */}
      <section className="py-20 lg:py-28 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-3 bg-white/10 border-white/20 text-white">AI-Powered</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Generate courses. Track timelines.<br />Surface alerts.
              </h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                ExaminerAI uses AI to generate full course outlines, weekly schedules, assessments, and learning resources — then auto-populates the timeline for students and teachers.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Sparkles, title: 'AI Course Generation', desc: 'Generate a 16-week course outline with assessments, weightage, and textbook recommendations in seconds.' },
                  { icon: BookOpen, title: 'AI-Generated Timeline', desc: 'Each course gets an auto-generated timeline of lectures, quizzes, assignments, and milestones.' },
                  { icon: Bell, title: 'Smart Alerts', desc: 'Teachers raise alerts → routed to counsellors → responses tracked end-to-end.' },
                  { icon: Zap, title: 'Practice Problems', desc: 'AI generates practice problem sets tuned to each student\'s weak areas.' }
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10">
                      <item.icon className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{item.title}</div>
                      <div className="text-sm text-slate-400">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-r from-amber-500/30 via-rose-500/30 to-fuchsia-500/30 rounded-2xl blur-xl" />
              <div className="relative rounded-xl overflow-hidden border border-white/20 shadow-2xl">
                <img
                  src="/screenshots/demo-principal.png"
                  alt="AI features dashboard"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* DEMO MODE EXPLAINER */}
      {/* ============================================ */}
      <section id="demo" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-3">Demo Mode</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Try every feature.<br />No commitment.
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                The demo developer account gives you full read-access to every dashboard in the platform. Switch between roles with one click. Open any form, dialog, or menu.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">You CAN do</div>
                    <div className="text-sm text-muted-foreground">View all dashboards, open forms/dialogs/menus, switch roles, navigate every section.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">You CANNOT do</div>
                    <div className="text-sm text-muted-foreground">Create/edit/delete any record — but you can preview every form to see exactly how it works.</div>
                  </div>
                </div>
              </div>

              <Button size="lg" onClick={openDemo} className="bg-amber-500 hover:bg-amber-600 text-white h-12 px-6">
                <Sparkles className="w-5 h-5 mr-2" /> Launch Demo Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div>
              <div className="relative rounded-xl overflow-hidden border shadow-2xl bg-background">
                <img
                  src="/screenshots/demo-blocked-toast.png"
                  alt="Demo mode write-blocked toast"
                  className="w-full h-auto"
                />
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-amber-500 text-white text-[10px] font-medium shadow">
                  Demo write-block toast
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Whenever a demo user tries a write action, a friendly toast explains the restriction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* FINAL CTA */}
      {/* ============================================ */}
      <section className="py-20 lg:py-24 bg-gradient-to-br from-amber-500 via-rose-500 to-fuchsia-600 text-white">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Ready to see it in action?
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            One click. No signup. Explore every dashboard, every feature, every role.
          </p>
          <Button
            size="lg"
            onClick={openDemo}
            className="bg-white text-slate-900 hover:bg-slate-100 h-14 px-8 text-base font-semibold shadow-xl"
          >
            <Sparkles className="w-5 h-5 mr-2" /> Launch Demo
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <div className="mt-6 text-sm text-white/80">
            Or <button onClick={openSignIn} className="underline hover:text-white">sign in with your account →</button>
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
                AI-powered assessment & mentorship platform. Built for institutions that take student development seriously.
              </p>
            </div>

            <div>
              <div className="text-white font-semibold text-sm mb-3">Platform</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#dashboards" className="hover:text-white">Dashboards</a></li>
                <li><a href="#grow" className="hover:text-white">GROW Model</a></li>
                <li><button onClick={openDemo} className="hover:text-white">Live Demo</button></li>
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

          <Separator className="my-6 bg-slate-800" />

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

      {/* ============================================ */}
      {/* LOGIN MODAL */}
      {/* ============================================ */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {loginMode === 'demo' ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-amber-900" />
                  </div>
                  Launch Live Demo
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  Sign in to ExaminerAI
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {loginMode === 'demo'
                ? 'One-click access to every dashboard. No signup required.'
                : 'Use your seeded account. Password for all: demo123'
              }
            </DialogDescription>
          </DialogHeader>

          {loginMode === 'demo' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-900 dark:text-amber-200 mb-3">
                  You will sign in as <strong>Demo Developer</strong> with full read-access to all dashboards. Use the role switcher in the top bar to preview any role.
                </p>
                <Button
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {loading ? 'Signing in…' : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> Continue as Demo Developer
                    </>
                  )}
                </Button>
              </div>

              <div className="text-xs text-center text-muted-foreground">
                Demo login: <code className="bg-muted px-1.5 py-0.5 rounded">demo@examiner.ai</code> · <code className="bg-muted px-1.5 py-0.5 rounded">demo123</code>
              </div>

              <Separator />

              <div>
                <div className="text-xs text-muted-foreground mb-2 text-center">Or quick-login as a specific role:</div>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.filter(r => r.id !== 'ADMIN').map(r => (
                    <button
                      key={r.id}
                      onClick={async () => {
                        const emailMap: Record<string, string> = {
                          STUDENT: 'aisha.khan@students.fccl.com.pk',
                          TEACHER: 's.khan@fccl.com.pk',
                          COUNSELOR: 'counsellor@fccl.com.pk',
                          MENTOR: 'mentor@fccl.com.pk',
                          PRINCIPAL: 'principal@fccl.com.pk'
                        }
                        setLoading(true)
                        try {
                          const res = await fetch('/api/auth', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: emailMap[r.id], password: 'demo123' })
                          })
                          const d = await res.json()
                          if (!res.ok) throw new Error(d.error)
                          await refresh()
                          setLoginOpen(false)
                          toast.success(`Signed in as ${r.label}`)
                          router.push('/')
                        } catch (e: any) {
                          toast.error(e.message)
                        } finally {
                          setLoading(false)
                        }
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                    >
                      <r.icon className={`w-4 h-4 ${r.color.split(' ')[0]}`} />
                      <span className="text-xs font-medium">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setLoginMode('signin')}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Sign in with email instead →
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@fccl.com.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="demo123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLoginMode('demo')}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  ← Back to demo login
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
