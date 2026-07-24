'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sparkles, Users, Building2, BookOpen, AlertTriangle, Brain, Eye, ShieldCheck, ArrowRight } from 'lucide-react'
import { StatCard, PageHeader, SectionCard, severityColor, statusColor, formatDate, timeAgo } from '@/components/shared/ui'
import { useAuth } from '@/lib/auth-store'
import { toast } from 'sonner'

interface DevData {
  role: string
  institution: any
  stats: any
  usersByRole: any[]
  coursePerformance: any[]
  alerts: any[]
  growthReports: any[]
  institutions: any[]
  recentUsers: any[]
  auditLogs: any[]
  message: string
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  COUNSELOR: 'Counsellor',
  MENTOR: 'Mentor',
  PRINCIPAL: 'Principal',
  ADMIN: 'System Admin',
  DEVELOPER: 'Demo Developer'
}

const ROLE_ICONS: Record<string, any> = {
  STUDENT: Users,
  TEACHER: BookOpen,
  COUNSELOR: Brain,
  MENTOR: Users,
  PRINCIPAL: Building2,
  ADMIN: ShieldCheck,
  DEVELOPER: Sparkles
}

export function DeveloperDashboard() {
  const { user, refresh } = useAuth()
  const [data, setData] = useState<DevData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8">Loading…</div>
  if (!data) return <div className="p-8">Failed to load.</div>

  const handleViewAs = async (role: string) => {
    try {
      const r = await fetch('/api/auth/view-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      await refresh()
      toast.success(`Now viewing as ${ROLE_LABELS[role]}`, {
        description: 'You can preview this dashboard. Writes are blocked.'
      })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* HERO */}
      <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/30 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-amber-900" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">Welcome to the ExaminerAI Demo! 👋</h1>
                <Badge className="bg-amber-500 text-white">DEMO MODE</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                You are signed in as the <strong>Demo Developer</strong> — a special account with read-access to every dashboard in the platform. Use the role cards below (or the role switcher in the top bar) to preview each role's experience. All write actions are blocked.
              </p>
            </div>
          </div>

          {/* ROLE PREVIEW CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            {(['STUDENT', 'TEACHER', 'COUNSELOR', 'MENTOR', 'PRINCIPAL', 'ADMIN'] as const).map(role => {
              const Icon = ROLE_ICONS[role]
              const userCount = data.usersByRole.find((u: any) => u.role === role)?.count || 0
              return (
                <button
                  key={role}
                  onClick={() => handleViewAs(role)}
                  className="group p-3 rounded-xl border-2 border-transparent bg-card hover:border-amber-400 hover:shadow-md transition text-left"
                >
                  <Icon className="w-6 h-6 text-amber-500 mb-2" />
                  <div className="text-sm font-semibold">{ROLE_LABELS[role]}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {userCount} accounts
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* TOP STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Users" value={data.stats.totalUsers} icon={Users} color="text-blue-600" />
        <StatCard title="Institutions" value={data.stats.totalInstitutions} icon={Building2} color="text-purple-600" />
        <StatCard title="Courses" value={data.stats.totalCourses} icon={BookOpen} color="text-emerald-600" />
        <StatCard title="Total Alerts" value={data.stats.totalAlerts} icon={AlertTriangle} color="text-rose-600" />
        <StatCard title="Mentor Sessions" value={data.stats.totalMentorSessions} icon={Brain} color="text-amber-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* USERS BY ROLE */}
        <SectionCard title="Users by Role" description="Platform distribution">
          <div className="space-y-2">
            {data.usersByRole.map((u: any) => {
              const Icon = ROLE_ICONS[u.role] || Users
              const pct = (u.count / data.stats.totalUsers) * 100
              return (
                <div key={u.role} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{ROLE_LABELS[u.role] || u.role}</span>
                    </div>
                    <span><strong>{u.count}</strong> · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* COURSE PERFORMANCE */}
        <SectionCard title="Course Performance" description="Avg score across courses" className="lg:col-span-2">
          <div className="space-y-3">
            {data.coursePerformance.map((c: any) => (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono font-medium text-xs">{c.code}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{c.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.studentCount} students</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">{c.avgScore}%</Badge>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-rose-400 rounded-full" style={{ width: `${c.avgScore}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* RECENT ALERTS */}
        <SectionCard title="Recent Alerts" description="Across all courses & teachers">
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {data.alerts.slice(0, 10).map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg border bg-card space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] ${severityColor(a.severity)}`}>{a.severity}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.course?.code}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="text-xs">{a.message}</p>
                <div className="text-[10px] text-muted-foreground">
                  From: {a.fromUser?.name} · Student: {a.student?.name}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* RECENT USERS */}
        <SectionCard title="Recent Users" description="Latest accounts">
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {data.recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-2 p-2 rounded border bg-card">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-[10px]">{u.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{u.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
                </div>
                <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* DEMO INFO */}
      <Card className="bg-slate-900 text-white border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            Demo Account Limitations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-300 space-y-2">
          <p>✓ <strong className="text-emerald-400">Can do:</strong> View all dashboards, open forms/dialogs/menus, navigate every section, switch roles, read all data.</p>
          <p>✗ <strong className="text-rose-400">Cannot do:</strong> Create/edit/delete users, courses, batches, alerts, mentor sessions, messages, assignments, or any other record.</p>
          <p className="text-xs text-slate-400 mt-3">To enable full functionality, sign up your institution. The demo resets periodically — your changes won't persist.</p>
        </CardContent>
      </Card>
    </div>
  )
}
