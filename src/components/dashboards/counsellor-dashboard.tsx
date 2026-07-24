'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Brain, AlertTriangle, Users, CheckCircle2, Clock, MessageSquare } from 'lucide-react'
import { StatCard, PageHeader, SectionCard, severityColor, statusColor, timeAgo } from '@/components/shared/ui'
import { toast } from 'sonner'

interface CounsellorData {
  role: string
  user: any
  assignments: any[]
  alerts: any[]
  urgentQueue: any[]
  stats: any
}

export function CounsellorDashboard() {
  const [data, setData] = useState<CounsellorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'urgent' | 'all' | 'students'>('urgent')

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8">Loading…</div>
  if (!data) return <div className="p-8">Failed to load.</div>

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={`Salam, ${data.user.name} 👋`}
        description="Student wellbeing queue, alert responses, and active cases."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Cases" value={data.stats.activeCases} subtitle={`${data.stats.totalAssigned} total assigned`} icon={Users} color="text-blue-600" />
        <StatCard title="Urgent Queue" value={data.stats.urgentCases} subtitle="HIGH / CRITICAL" icon={AlertTriangle} color="text-rose-600" />
        <StatCard title="Open Alerts" value={data.stats.alertsOpen} subtitle={`${data.stats.alertsAcknowledged} acknowledged`} icon={Clock} color="text-amber-600" />
        <StatCard title="Resolved" value={data.stats.alertsResolved} subtitle="this semester" icon={CheckCircle2} color="text-emerald-600" />
      </div>

      {/* TABS */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {[
          { id: 'urgent', label: `Urgent Queue (${data.urgentQueue.length})` },
          { id: 'all', label: `All Alerts (${data.alerts.length})` },
          { id: 'students', label: `My Students (${data.assignments.length})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              tab === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* URGENT QUEUE */}
      {tab === 'urgent' && (
        <SectionCard
          title="Urgent Wellbeing Queue"
          description="High and critical alerts awaiting your response"
        >
          {data.urgentQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No urgent alerts right now. 🎉</p>
          ) : (
            <div className="space-y-3">
              {data.urgentQueue.map((a: any) => (
                <div key={a.id} className="p-4 rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${severityColor(a.severity)}`}>{a.severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{a.course?.code}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                  </div>
                  <p className="text-sm mb-2">{a.message}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Student: <strong>{a.student?.name}</strong> · From: {a.fromUser?.name}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.error('Demo Account Restriction', { description: 'Acknowledging alerts is blocked in demo mode.' })}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => toast.error('Demo Account Restriction', { description: 'Responding to alerts is blocked in demo mode.' })}
                      >
                        <MessageSquare className="w-3 h-3 mr-1" /> Respond
                      </Button>
                    </div>
                  </div>
                  {a.response && (
                    <div className="mt-2 p-2 rounded bg-muted text-xs">
                      <strong>Your previous response:</strong> {a.response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ALL ALERTS */}
      {tab === 'all' && (
        <SectionCard title="All Alerts" description="Complete alert history">
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {data.alerts.map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${severityColor(a.severity)}`}>{a.severity}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="text-xs">{a.message}</p>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>Student: <strong>{a.student?.name}</strong> · From: {a.fromUser?.name}</span>
                  <span>Course: {a.course?.code}</span>
                </div>
                {a.response && (
                  <div className="text-[11px] p-2 rounded bg-muted border-l-2 border-emerald-500">
                    <strong className="text-emerald-700">Response:</strong> {a.response}
                    {a.respondedAt && <div className="text-[10px] mt-1 text-muted-foreground">{timeAgo(a.respondedAt)}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* STUDENTS */}
      {tab === 'students' && (
        <SectionCard title="Assigned Students" description="Active counselling cases">
          <div className="grid sm:grid-cols-2 gap-3">
            {data.assignments.map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="text-xs">{a.student.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.student.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.student.email}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  <strong>Reason:</strong> {a.reason}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Assigned {timeAgo(a.assignedAt)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
