'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { GraduationCap, Sparkles, Eye, ArrowRight, ShieldCheck, Users, Brain, BarChart3, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-store'

export function LoginPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handleLogin = async (e: React.FormEvent) => {
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
      toast.success(`Welcome back, ${d.user.name}!`)
      router.push('/')
    } catch (e: any) {
      toast.error('Login failed', { description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const quickAccounts = [
    { email: 'principal@fccl.com.pk', label: 'Principal', icon: ShieldCheck, color: 'text-purple-600' },
    { email: 's.khan@fccl.com.pk', label: 'Teacher (CS)', icon: GraduationCap, color: 'text-blue-600' },
    { email: 'r.ahmed@fccl.com.pk', label: 'Teacher (MGT)', icon: GraduationCap, color: 'text-emerald-600' },
    { email: 'counsellor@fccl.com.pk', label: 'Counsellor', icon: Brain, color: 'text-rose-600' },
    { email: 'mentor@fccl.com.pk', label: 'Mentor', icon: Users, color: 'text-amber-600' },
    { email: 'admin@examiner.ai', label: 'Admin', icon: BarChart3, color: 'text-slate-600' }
  ]

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left — marketing/branding panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">ExaminerAI</h1>
              <p className="text-xs text-slate-400">FCCL JB Plant Institute of Technology</p>
            </div>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
            AI-Powered Assessment<br />
            <span className="bg-gradient-to-r from-amber-300 to-rose-300 bg-clip-text text-transparent">
              & Mentorship Platform
            </span>
          </h2>
          <p className="text-slate-300 text-lg mb-10 max-w-md">
            Comprehensive evaluation, GROW-model coaching, psychological & educational mentorship, real-time alerts, and analytics for every role — students, teachers, counsellors, mentors, principals, and admins.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            {[
              { icon: BarChart3, label: 'Role-based Dashboards' },
              { icon: Brain, label: 'GROW Coaching Model' },
              { icon: MessageSquare, label: 'Real-time Alerts' },
              { icon: Sparkles, label: 'AI-Course Generation' }
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-200">
                <f.icon className="w-4 h-4 text-amber-300" />
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-slate-400 mt-12">
          © 2026 ExaminerAI · FCCL JB Plant IT · All rights reserved
        </div>
      </div>

      {/* Right — login form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-16 bg-background">
        <div className="w-full max-w-md space-y-6">
          {/* PROMINENT DEMO CTA */}
          <Card className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-amber-400 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-amber-900" />
                </div>
                <div>
                  <CardTitle className="text-lg">Try the Live Demo</CardTitle>
                  <CardDescription className="text-xs">
                    One-click access. No signup required.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground mb-4">
                Explore every dashboard — student, teacher, counsellor, mentor, principal, admin — fully populated with realistic data. Switch roles instantly from the top bar.
              </p>
              <Button
                onClick={handleDemoLogin}
                disabled={loading}
                size="lg"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white text-base font-semibold shadow-md"
              >
                {loading ? 'Signing in…' : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Launch Demo (Demo Developer)
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Demo account: <code className="bg-muted px-1.5 py-0.5 rounded">demo@examiner.ai</code> · <code className="bg-muted px-1.5 py-0.5 rounded">demo123</code>
              </p>
            </CardContent>
          </Card>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-background px-3 text-xs text-muted-foreground">
              or sign in with a specific role
            </span>
          </div>

          {/* Login form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>Use any seeded account. Password for all: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">demo123</code></CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
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
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Quick role logins */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 text-center">Quick login as:</p>
            <div className="grid grid-cols-2 gap-2">
              {quickAccounts.map(a => (
                <button
                  key={a.email}
                  onClick={async () => {
                    setEmail(a.email)
                    setPassword('demo123')
                    setLoading(true)
                    try {
                      const r = await fetch('/api/auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: a.email, password: 'demo123' })
                      })
                      const d = await r.json()
                      if (!r.ok) throw new Error(d.error)
                      await refresh()
                      toast.success(`Signed in as ${a.label}`)
                      router.push('/')
                    } catch (e: any) {
                      toast.error(e.message)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                >
                  <a.icon className={`w-4 h-4 ${a.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{a.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{a.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <Badge variant="secondary" className="mr-1">v1.0.0</Badge>
            <Badge variant="outline">Fall 2025 Semester</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
