'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({ title, value, subtitle, icon: Icon, color = 'text-slate-700' }: {
  title: string
  value: string | number
  subtitle?: string
  icon?: any
  color?: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className={cn('w-4 h-4', color)} />}
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', color)}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

export function PageHeader({ title, description, action }: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionCard({ title, description, children, action }: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function severityColor(sev: string): string {
  switch (sev) {
    case 'CRITICAL': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
    case 'HIGH': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
    case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'
    case 'LOW': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'OPEN': return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
    case 'ACKNOWLEDGED': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
    case 'RESOLVED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'ACTIVE': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
    case 'SUBMITTED': return 'bg-blue-100 text-blue-700'
    case 'GRADED': return 'bg-emerald-100 text-emerald-700'
    case 'LATE': return 'bg-amber-100 text-amber-700'
    case 'RETURNED': return 'bg-purple-100 text-purple-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

export function moodColor(mood: string): string {
  switch (mood) {
    case 'HAPPY': return 'bg-emerald-100 text-emerald-700'
    case 'MOTIVATED': return 'bg-blue-100 text-blue-700'
    case 'NEUTRAL': return 'bg-slate-100 text-slate-700'
    case 'ANXIOUS': return 'bg-amber-100 text-amber-700'
    case 'STRESSED': return 'bg-orange-100 text-orange-700'
    case 'SAD': return 'bg-rose-100 text-rose-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return formatDate(date)
}
