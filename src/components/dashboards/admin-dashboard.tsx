'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ShieldCheck, Users, Building2, BookOpen, AlertTriangle, Activity, Brain, Server } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts'
import { StatCard, PageHeader, SectionCard, formatDate, timeAgo } from '@/components/shared/ui'
import { toast } from 'sonner'

interface AdminData {
  role: string
  stats: any
  usersByRole: any[]
  recentUsers: any[]
  auditLogs: any[]
  institutions: any[]
}

const ROLE_BAR_COLORS: Record<string, string> = {
  STUDENT: '#3b82f6',
  TEACHER: '#10b981',
  COUNSELOR: '#f43f5e',
  MENTOR: '#f59e0b',
  PRINCIPAL: '#8b5cf6',
  ADMIN: '#64748b',
  DEVELOPER: '#d946ef'
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8">Loading…</div>
  if (!data) return <div className="p-8">Failed to load.</div>

  const roleData = data.usersByRole.map(u => ({
    name: u.role,
    count: u._count,
    fill: ROLE_BAR_COLORS[u.role] || '#94a3b8'
  }))

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="System Administration"
        description="Platform-wide oversight, user management, and audit logs."
        action={
          <Button
            variant="outline"
            onClick={() => toast.error('Demo Account Restriction', { description: 'Admin actions are blocked in demo mode.' })}
          >
            <Users className="w-4 h-4 mr-2" /> Manage Users
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Users" value={data.stats.totalUsers} icon={Users} color="text-blue-600" />
        <StatCard title="Institutions" value={data.stats.totalInstitutions} icon={Building2} color="text-purple-600" />
        <StatCard title="Courses" value={data.stats.totalCourses} icon={BookOpen} color="text-emerald-600" />
        <StatCard title="Total Alerts" value={data.stats.totalAlerts} icon={AlertTriangle} color="text-rose-600" />
        <StatCard title="Mentor Sessions" value={data.stats.totalMentorSessions} icon={Brain} color="text-amber-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* USERS BY ROLE */}
        <SectionCard title="Users by Role" description="Distribution across platform">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={roleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {roleData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* INSTITUTIONS */}
        <SectionCard title="Registered Institutions" description="Organisations on platform">
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {data.institutions.map((inst: any) => (
              <div key={inst.id} className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3 mb-2">
                  {inst.logo && <img src={inst.logo} alt="Logo" className="w-8 h-8 rounded object-contain bg-white border" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{inst.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{inst.email}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">{inst.code}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><strong>{inst._count.users}</strong> users</div>
                  <div><strong>{inst._count.courses}</strong> courses</div>
                  <div><strong>{inst._count.batches}</strong> batches</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* RECENT USERS */}
        <SectionCard title="Recent Users" description="Latest signups">
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {data.recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-[10px]">{u.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                  {u.isDemo && <Badge variant="secondary" className="text-[10px] ml-1 bg-amber-100 text-amber-700">DEMO</Badge>}
                  <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(u.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* AUDIT LOG */}
        <SectionCard title="Audit Log" description="Latest 20 system events">
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {data.auditLogs.slice(0, 20).map((log: any) => (
              <div key={log.id} className="flex items-start gap-2 p-2 rounded border bg-card">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-3.5 h-3.5 text-primary" />
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

      {/* SYSTEM HEALTH */}
      <SectionCard title="System Health" description="Platform service status">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { name: 'API Server', status: 'Operational', icon: Server, color: 'text-emerald-600' },
            { name: 'Database', status: 'Operational', icon: Server, color: 'text-emerald-600' },
            { name: 'AI Service', status: 'Operational', icon: Brain, color: 'text-emerald-600' }
          ].map(s => (
            <div key={s.name} className="p-3 rounded-lg border bg-card flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div className="flex-1">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-emerald-600">● {s.status}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
