'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Brain, Target, Users, Clock, Calendar, TrendingUp, AlertCircle } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { StatCard, PageHeader, SectionCard, moodColor, formatDate, timeAgo } from '@/components/shared/ui'
import { toast } from 'sonner'

interface MentorData {
  role: string
  user: any
  sessions: any[]
  recentSessions: any[]
  followUpsDue: any[]
  stats: any
}

const MOOD_COLORS: Record<string, string> = {
  HAPPY: '#10b981',
  MOTIVATED: '#3b82f6',
  NEUTRAL: '#94a3b8',
  ANXIOUS: '#f59e0b',
  STRESSED: '#f97316',
  SAD: '#ef4444'
}

export function MentorDashboard() {
  const [data, setData] = useState<MentorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'PSYCHOLOGICAL' | 'EDUCATIONAL'>('ALL')

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8">Loading…</div>
  if (!data) return <div className="p-8">Failed to load.</div>

  const moodData = Object.entries(data.stats.moodDistribution).map(([name, value]) => ({ name, value }))

  // Sessions by week (last 8 weeks)
  const sessionsByWeek: Record<string, number> = {}
  for (let i = 7; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    sessionsByWeek[key] = 0
  }
  data.sessions.forEach((s: any) => {
    const d = new Date(s.date)
    const weeksAgo = Math.floor((Date.now() - d.getTime()) / (7 * 86400000))
    if (weeksAgo >= 0 && weeksAgo < 8) {
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      // approximate; just bucket by index
      const bucket = Object.keys(sessionsByWeek)[7 - weeksAgo]
      if (bucket) sessionsByWeek[bucket] = (sessionsByWeek[bucket] || 0) + 1
    }
  })
  const weeklyData = Object.entries(sessionsByWeek).map(([week, count]) => ({ week, count }))

  const filteredSessions = filter === 'ALL' ? data.sessions : data.sessions.filter((s: any) => s.type === filter)

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={`Salam, ${data.user.name} 👋`}
        description="GROW coaching sessions — psychological & educational mentorship."
        action={
          <Button
            onClick={() => toast.error('Demo Account Restriction', {
              description: 'Creating new mentor sessions is blocked in demo mode. You can preview the GROW form.'
            })}
          >
            <Brain className="w-4 h-4 mr-2" /> Log New Session
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sessions" value={data.stats.totalSessions} subtitle="this semester" icon={Brain} color="text-amber-600" />
        <StatCard title="Psychological" value={data.stats.psychologicalSessions} subtitle="GROW coaching" icon={Brain} color="text-rose-600" />
        <StatCard title="Educational" value={data.stats.educationalSessions} subtitle="academic guidance" icon={Target} color="text-blue-600" />
        <StatCard title="Unique Students" value={data.stats.uniqueStudents} subtitle={`${data.stats.followUpsDue} follow-ups due`} icon={Users} color="text-emerald-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* MOOD DISTRIBUTION */}
        <SectionCard title="Student Mood Distribution" description="From psychological sessions">
          {moodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={moodData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {moodData.map((d, i) => <Cell key={i} fill={MOOD_COLORS[d.name] || '#94a3b8'} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No mood data yet.</p>
          )}
        </SectionCard>

        {/* WEEKLY VOLUME */}
        <SectionCard title="Sessions Per Week" description="Last 8 weeks" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* FOLLOW-UPS DUE */}
      {data.followUpsDue.length > 0 && (
        <SectionCard title="Follow-ups Due" description="Sessions needing check-in within the next 7 days">
          <div className="space-y-2">
            {data.followUpsDue.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <div>
                    <div className="text-sm font-medium">{s.student.name}</div>
                    <div className="text-xs text-muted-foreground">{s.type} · {formatDate(s.date)} · follow-up: {s.followUp}</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toast.error('Demo Account Restriction', { description: 'Scheduling follow-ups is blocked in demo mode.' })}
                >
                  Schedule
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* SESSION LOG */}
      <SectionCard
        title="Session Log"
        description="All mentor sessions with GROW model entries"
        action={
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {(['ALL', 'PSYCHOLOGICAL', 'EDUCATIONAL'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${filter === f ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                {f === 'ALL' ? 'All' : f === 'PSYCHOLOGICAL' ? 'Psych' : 'Edu'}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
          {filteredSessions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No sessions in this category.</p>
          )}
          {filteredSessions.map((s: any) => (
            <div key={s.id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-[10px]">{s.student.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{s.student.name}</span>
                  <Badge variant="outline" className={s.type === 'PSYCHOLOGICAL' ? 'border-rose-300 text-rose-700' : 'border-blue-300 text-blue-700'}>
                    {s.type === 'PSYCHOLOGICAL' ? <Brain className="w-3 h-3 mr-1" /> : <Target className="w-3 h-3 mr-1" />}
                    {s.type}
                  </Badge>
                  {s.mood && <Badge variant="outline" className={`text-[10px] ${moodColor(s.mood)}`}>{s.mood}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(s.date)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration} min</span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-2 rounded bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="font-semibold text-emerald-700 mb-1">🎯 Goal</div>
                  <p className="text-muted-foreground">{s.goal}</p>
                </div>
                <div className="p-2 rounded bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="font-semibold text-blue-700 mb-1">🔍 Reality</div>
                  <p className="text-muted-foreground">{s.reality}</p>
                </div>
                <div className="p-2 rounded bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="font-semibold text-amber-700 mb-1">💡 Options</div>
                  <p className="text-muted-foreground">{s.options}</p>
                </div>
                <div className="p-2 rounded bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="font-semibold text-purple-700 mb-1">✊ Will</div>
                  <p className="text-muted-foreground">{s.will}</p>
                </div>
              </div>
              {s.notes && (
                <div className="mt-3 pt-3 border-t text-xs">
                  <strong className="text-muted-foreground">Notes:</strong> <span className="text-muted-foreground">{s.notes}</span>
                </div>
              )}
              {s.followUp && (
                <div className="mt-2 text-[10px] text-amber-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Follow-up: {s.followUp}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
