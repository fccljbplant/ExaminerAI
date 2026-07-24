'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Building2, Users, BookOpen, AlertTriangle, TrendingUp, FileText, ShieldCheck, Activity } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from 'recharts'
import { StatCard, PageHeader, SectionCard, severityColor, statusColor, formatDate, timeAgo } from '@/components/shared/ui'
import { toast } from 'sonner'

interface PrincipalData {
  role: string
  institution: any
  stats: any
  coursePerformance: any[]
  alerts: any[]
  growthReports: any[]
  auditLogs: any[]
  recentActivity: any[]
  alertStats: any
}

const ALERT_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#94a3b8']

export function PrincipalDashboard() {
  const [data, setData] = useState<PrincipalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8">Loading…</div>
  if (!data) return <div className="p-8">Failed to load.</div>

  const alertPieData = [
    { name: 'Open', value: data.alertStats.open, color: '#ef4444' },
    { name: 'Acknowledged', value: data.alertStats.acknowledged, color: '#f59e0b' },
    { name: 'Resolved', value: data.alertStats.resolved, color: '#10b981' }
  ].filter(d => d.value > 0)

  const coursePerfData = data.coursePerformance.map(c => ({
    name: c.code,
    score: c.avgScore,
    students: c.studentCount
  }))

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {data.institution?.logo && (
              <img src={data.institution.logo} alt="Logo" className="w-10 h-10 rounded-lg object-contain bg-white border" />
            )}
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{data.institution?.name}</h1>
              <p className="text-sm text-muted-foreground">Institution-wide overview · Fall 2025</p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => toast.error('Demo Account Restriction', { description: 'Exporting reports is blocked in demo mode.' })}
        >
          <FileText className="w-4 h-4 mr-2" /> Export Report
        </Button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Students" value={data.stats.totalStudents} icon={Users} color="text-blue-600" />
        <StatCard title="Teachers" value={data.stats.totalTeachers} icon={BookOpen} color="text-emerald-600" />
        <StatCard title="Courses" value={data.stats.totalCourses} subtitle={`${data.stats.totalBatches} batches`} icon={BookOpen} color="text-purple-600" />
        <StatCard title="Total Alerts" value={data.stats.totalAlerts} subtitle={`${data.alertStats.critical} critical`} icon={AlertTriangle} color="text-rose-600" />
        <StatCard title="Mentor Sessions" value={data.stats.totalMentorSessions} subtitle="GROW coaching" icon={Activity} color="text-amber-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* COURSE PERFORMANCE */}
        <SectionCard title="Course Performance" description="Average score across assessments" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={coursePerfData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
              <Tooltip />
              <Bar dataKey="score" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {data.coursePerformance.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                <div>
                  <span className="font-mono font-medium">{c.code}</span> · {c.title}
                  <div className="text-[10px] text-muted-foreground">{c.teacher} · {c.studentCount} students</div>
                </div>
                <Badge variant="secondary" className="font-mono">{c.avgScore}%</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ALERT STATUS */}
        <SectionCard title="Alert Resolution" description="Status across all courses">
          {alertPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={alertPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {alertPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No alerts.</p>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30">
              <div className="text-rose-700 font-semibold">{data.alertStats.critical}</div>
              <div className="text-[10px] text-muted-foreground">Critical</div>
            </div>
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30">
              <div className="text-amber-700 font-semibold">{data.alertStats.high}</div>
              <div className="text-[10px] text-muted-foreground">High</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* GROWTH REPORTS */}
        <SectionCard title="Institution Growth Reports" description="Private strategic reviews">
          {data.growthReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No reports yet.</p>
          ) : (
            <div className="space-y-3">
              {data.growthReports.map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">{r.title}</h4>
                    <Badge variant="secondary" className="text-[10px]">{r.period}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{r.content}</p>
                  <div className="text-[10px] text-muted-foreground mt-2">Generated {formatDate(r.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* AUDIT LOG */}
        <SectionCard title="Recent Activity" description="Audit log across institution">
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {data.auditLogs.slice(0, 12).map((log: any) => (
              <div key={log.id} className="flex items-start gap-2 p-2 rounded border bg-card">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    <strong>{log.user?.name || 'System'}</strong>
                    <span className="text-muted-foreground"> · {log.action.toLowerCase()}</span>
                    <span className="text-muted-foreground"> {log.entity.toLowerCase()}</span>
                  </div>
                  {log.meta && <div className="text-[10px] text-muted-foreground truncate">{log.meta}</div>}
                  <div className="text-[10px] text-muted-foreground">{timeAgo(log.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* RECENT ALERTS */}
      <SectionCard title="Recent Alerts" description="Across all courses">
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {data.alerts.slice(0, 10).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-[10px]">{a.student?.name?.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-[10px] ${severityColor(a.severity)}`}>{a.severity}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.course?.code}</Badge>
                  </div>
                  <p className="text-xs">{a.message}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">From: {a.fromUser?.name} · {timeAgo(a.createdAt)}</div>
                </div>
              </div>
              {a.response && (
                <Badge variant="secondary" className="text-[10px] text-emerald-700">responded</Badge>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
