'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  GraduationCap, BookOpen, TrendingUp, AlertTriangle, Brain, Calendar,
  FileText, MessageSquare, Clock, CheckCircle2, XCircle, Award, Target
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { StatCard, PageHeader, SectionCard, severityColor, statusColor, moodColor, formatDate, timeAgo } from '@/components/shared/ui'
import { useAuth } from '@/lib/auth-store'

interface DashboardData {
  role: string
  user: any
  enrollments: any[]
  courseGrades: any[]
  attendanceSummary: any
  attendancePct: number
  alerts: any[]
  mentorSessions: any[]
  assignments: any[]
  counsellorAssignment: any
  recentMessages: any[]
  gpa: number
}

const ATTENDANCE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6']

export function StudentDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />
  if (!data) return <div className="p-8">Failed to load dashboard.</div>

  const firstName = data.user.name.split(' ')[0]
  const attendanceData = [
    { name: 'Present', value: data.attendanceSummary.present },
    { name: 'Late', value: data.attendanceSummary.late },
    { name: 'Absent', value: data.attendanceSummary.absent },
    { name: 'Excused', value: data.attendanceSummary.excused }
  ].filter(d => d.value > 0)

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={`Salam, ${firstName}! 👋`}
        description="Your academic overview, mentorship progress, and recent activity."
      />

      {/* TOP STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="GPA (current)" value={data.gpa.toFixed(2)} subtitle="out of 4.00" icon={Award} color="text-amber-600" />
        <StatCard title="Courses Enrolled" value={data.enrollments.length} subtitle="Fall 2025" icon={BookOpen} color="text-blue-600" />
        <StatCard title="Attendance" value={`${data.attendancePct}%`} subtitle={`${data.attendanceSummary.present}/${data.attendanceSummary.total} sessions`} icon={Calendar} color="text-emerald-600" />
        <StatCard title="Open Alerts" value={data.alerts.filter(a => a.status === 'OPEN').length} subtitle="need attention" icon={AlertTriangle} color="text-rose-600" />
      </div>

      {/* COURSE PERFORMANCE */}
      <SectionCard
        title="Course Performance"
        description="Your weighted scores across enrolled courses"
      >
        <div className="space-y-4">
          {data.courseGrades.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No grades yet.</p>
          )}
          {data.courseGrades.map((cg: any) => (
            <div key={cg.course.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">{cg.course.code}</Badge>
                  <span className="font-medium text-sm">{cg.course.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{cg.weightedTotal.toFixed(1)}%</span>
                  <Badge variant="secondary" className="font-mono">{cg.letterGrade}</Badge>
                </div>
              </div>
              <Progress value={cg.weightedTotal} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {cg.course.teacher?.name && `Instructor: ${cg.course.teacher.name} · `}
                {cg.assessments.length} assessments graded
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ATTENDANCE PIE */}
        <SectionCard title="Attendance Breakdown" description="Last 12 sessions">
          {attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={attendanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {attendanceData.map((_, i) => <Cell key={i} fill={ATTENDANCE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No attendance recorded.</p>
          )}
        </SectionCard>

        {/* SCORE TREND */}
        <SectionCard title="Recent Scores" description="Across all assessments" className="lg:col-span-2">
          {(() => {
            const allAssessments: any[] = []
            data.courseGrades.forEach((cg: any) => {
              cg.assessments.forEach((a: any) => {
                allAssessments.push({ name: a.title.slice(0, 15), pct: a.pct, course: cg.course.code })
              })
            })
            const recent = allAssessments.slice(-8)
            if (recent.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No grades yet.</p>
            return (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={recent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )
          })()}
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ASSIGNMENTS */}
        <SectionCard title="Assignments" description="Upcoming & recent submissions">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {data.assignments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No assignments.</p>
            )}
            {data.assignments.map((a: any) => (
              <div key={a.id} className="flex items-start justify-between p-3 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-[10px]">{a.course.code}</Badge>
                    {a.submission ? (
                      <Badge variant="secondary" className={`text-[10px] ${statusColor(a.submission.status)}`}>{a.submission.status}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">PENDING</Badge>
                    )}
                  </div>
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Due {formatDate(a.dueDate)}
                  </div>
                </div>
                {a.submission?.marks !== null && a.submission?.marks !== undefined && (
                  <div className="text-right">
                    <div className="text-lg font-bold">{a.submission.marks}</div>
                    <div className="text-[10px] text-muted-foreground">/ {a.maxMarks}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ALERTS */}
        <SectionCard title="Alerts About You" description="Notes from your teachers">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {data.alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No alerts. You're doing great! 🎉</p>
            )}
            {data.alerts.slice(0, 8).map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-[10px] ${severityColor(a.severity)}`}>{a.severity}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                </div>
                <p className="text-xs">{a.message}</p>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>From: {a.fromUser?.name}</span>
                  <span>{timeAgo(a.createdAt)}</span>
                </div>
                {a.response && (
                  <div className="text-[11px] p-2 rounded bg-muted">
                    <strong>Response:</strong> {a.response}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* MENTOR SESSIONS — GROW model */}
      <SectionCard
        title="Mentor Sessions"
        description="GROW coaching: Goal → Reality → Options → Will"
      >
        {data.mentorSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No mentor sessions yet.</p>
        ) : (
          <div className="space-y-4">
            {data.mentorSessions.slice(0, 4).map((s: any) => (
              <div key={s.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={s.type === 'PSYCHOLOGICAL' ? 'border-rose-300 text-rose-700' : 'border-blue-300 text-blue-700'}>
                      {s.type === 'PSYCHOLOGICAL' ? <Brain className="w-3 h-3 mr-1" /> : <Target className="w-3 h-3 mr-1" />}
                      {s.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(s.date)} · {s.duration} min</span>
                    {s.mood && <Badge variant="outline" className={`text-[10px] ${moodColor(s.mood)}`}>{s.mood}</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">Mentor: {s.mentor.name}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-emerald-700 mb-1">G — Goal</div>
                    <p className="text-muted-foreground">{s.goal}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-blue-700 mb-1">R — Reality</div>
                    <p className="text-muted-foreground">{s.reality}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-amber-700 mb-1">O — Options</div>
                    <p className="text-muted-foreground">{s.options}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-purple-700 mb-1">W — Will</div>
                    <p className="text-muted-foreground">{s.will}</p>
                  </div>
                </div>
                {s.notes && (
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <strong>Notes:</strong> {s.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* RECENT MESSAGES */}
      <SectionCard title="Recent Messages" description="Last 5 conversations">
        <div className="space-y-2">
          {data.recentMessages.slice(0, 5).map((m: any) => (
            <div key={m.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-[10px]">{m.fromUser.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{m.fromUser.name}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{m.content}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-muted rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
      </div>
      <div className="h-64 bg-muted rounded-lg" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="h-48 bg-muted rounded-lg" />
        <div className="h-48 bg-muted rounded-lg lg:col-span-2" />
      </div>
    </div>
  )
}
