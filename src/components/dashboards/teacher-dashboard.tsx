'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  BookOpen, Users, Bell, FileText, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Calendar, MessageSquare
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { StatCard, PageHeader, SectionCard, severityColor, statusColor, formatDate, timeAgo } from '@/components/shared/ui'
import { useAuth } from '@/lib/auth-store'
import { toast } from 'sonner'

interface TeacherData {
  role: string
  user: any
  courses: any[]
  alertsSent: any[]
  recentSessions: any[]
  gradebooks: any[]
  pendingSubmissions: any[]
  stats: any
}

export function TeacherDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<TeacherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); if (d.courses?.[0]) setSelectedCourse(d.courses[0].id) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8">Loading…</div>
  if (!data) return <div className="p-8">Failed to load.</div>

  // Alert status breakdown
  const alertStatusData = [
    { name: 'Open', value: data.stats.alertsOpen, color: '#ef4444' },
    { name: 'Resolved', value: data.stats.alertsResolved, color: '#10b981' }
  ].filter(d => d.value > 0)

  // Gradebook for selected course
  const gradebook = data.gradebooks.find(g => g.course.id === selectedCourse)

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={`Welcome, ${data.user.name} 👋`}
        description="Your teaching overview, alerts, and gradebook."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Courses" value={data.stats.totalCourses} icon={BookOpen} color="text-blue-600" />
        <StatCard title="Total Students" value={data.stats.totalStudents} icon={Users} color="text-emerald-600" />
        <StatCard title="Open Alerts" value={data.stats.alertsOpen} subtitle={`${data.stats.alertsResolved} resolved`} icon={AlertTriangle} color="text-rose-600" />
        <StatCard title="Pending Reviews" value={data.stats.pendingSubmissions} subtitle="awaiting grade" icon={Clock} color="text-amber-600" />
      </div>

      {/* COURSES */}
      <SectionCard title="My Courses" description="Courses you are teaching this semester">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.courses.map((c: any) => (
            <div
              key={c.id}
              className={`p-4 rounded-lg border cursor-pointer transition ${selectedCourse === c.id ? 'border-primary bg-accent' : 'bg-card hover:bg-accent'}`}
              onClick={() => setSelectedCourse(c.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="font-mono text-xs">{c.code}</Badge>
                <Badge variant="secondary" className="text-[10px]">{c.studentCount} students</Badge>
              </div>
              <h4 className="text-sm font-medium mb-1">{c.title}</h4>
              <p className="text-xs text-muted-foreground">{c.semester}</p>
              <div className="flex gap-1 mt-2">
                {c.batches?.map((b: any) => (
                  <Badge key={b.id} variant="outline" className="text-[10px]">{b.name}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ALERTS */}
        <SectionCard title="Alerts Sent" description="To counsellor & students" className="lg:col-span-2">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {data.alertsSent.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No alerts sent.</p>
            )}
            {data.alertsSent.slice(0, 10).map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${severityColor(a.severity)}`}>{a.severity}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="text-xs">{a.message}</p>
                <div className="text-[10px] text-muted-foreground">
                  Student: {a.student?.name} · Course: {a.course?.code}
                </div>
                {a.response && (
                  <div className="text-[11px] p-2 rounded bg-muted border-l-2 border-emerald-500">
                    <strong className="text-emerald-700">Response from {a.toUser?.name}:</strong> {a.response}
                    {a.respondedAt && <div className="text-[10px] mt-1 text-muted-foreground">{timeAgo(a.respondedAt)}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ALERT STATS */}
        <SectionCard title="Alert Stats" description="Resolution overview">
          {alertStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={alertStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {alertStatusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No alerts.</p>
          )}
        </SectionCard>
      </div>

      {/* GRADEBOOK */}
      {gradebook && (
        <SectionCard
          title={`Gradebook — ${gradebook.course.code}`}
          description={gradebook.course.title}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.error('Demo Account Restriction', {
                description: 'Editing grades is blocked in demo mode. You can preview the gradebook interface.'
              })}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Edit Grades
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Student</th>
                  {gradebook.assessments.map((a: any) => (
                    <th key={a.id} className="text-center p-2 text-xs font-medium text-muted-foreground" title={a.title}>
                      {a.title.length > 18 ? a.title.slice(0, 18) + '…' : a.title}
                      <div className="text-[9px] font-normal">/{a.maxMarks}</div>
                    </th>
                  ))}
                  <th className="text-center p-2 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-center p-2 text-xs font-medium text-muted-foreground">Grade</th>
                </tr>
              </thead>
              <tbody>
                {gradebook.students.map((s: any) => (
                  <tr key={s.student.id} className="border-b hover:bg-accent">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px]">{s.student.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{s.student.name}</span>
                      </div>
                    </td>
                    {gradebook.assessments.map((a: any) => (
                      <td key={a.id} className="text-center p-2 text-xs">
                        {s.grades[a.id] !== undefined ? s.grades[a.id] : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="text-center p-2 text-xs font-semibold">{s.weighted}%</td>
                    <td className="text-center p-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">{s.letter}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* PENDING SUBMISSIONS */}
      <SectionCard title="Pending Submissions" description="Awaiting your review">
        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
          {data.pendingSubmissions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">All caught up! 🎉</p>
          )}
          {data.pendingSubmissions.slice(0, 8).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono text-[10px]">{s.assignment.course.code}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${statusColor(s.status)}`}>{s.status}</Badge>
                </div>
                <div className="text-sm font-medium truncate">{s.assignment.title}</div>
                <div className="text-xs text-muted-foreground">{s.student.name} · submitted {timeAgo(s.submittedAt)}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.error('Demo Account Restriction', {
                  description: 'Grading submissions is blocked in demo mode.'
                })}
              >
                Review
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* RECENT SESSIONS */}
      <SectionCard title="Recent Class Sessions" description="Sessions you led">
        <div className="space-y-2">
          {data.recentSessions.slice(0, 6).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div>
                <div className="text-sm font-medium">{s.topic}</div>
                <div className="text-xs text-muted-foreground">{s.course.code} · {s.batch.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium">{formatDate(s.date)}</div>
                <div className="text-[10px] text-muted-foreground">{s.attendances.length} attended</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
