'use client'

import { useEffect, useState } from 'react'
import { useAuth, demoFetch } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  GraduationCap, LayoutDashboard, BookOpen, Users, Bell, Brain,
  Building2, ShieldCheck, LogOut, Eye, Sparkles, ChevronDown,
  MessageSquare, FileText, Calendar, BarChart3, Settings, UserCircle
} from 'lucide-react'
import { StudentDashboard } from '@/components/dashboards/student-dashboard'
import { TeacherDashboard } from '@/components/dashboards/teacher-dashboard'
import { CounsellorDashboard } from '@/components/dashboards/counsellor-dashboard'
import { MentorDashboard } from '@/components/dashboards/mentor-dashboard'
import { PrincipalDashboard } from '@/components/dashboards/principal-dashboard'
import { AdminDashboard } from '@/components/dashboards/admin-dashboard'
import { DeveloperDashboard } from '@/components/dashboards/developer-dashboard'
import { toast } from 'sonner'
import Link from 'next/link'

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
  STUDENT: GraduationCap,
  TEACHER: BookOpen,
  COUNSELOR: Brain,
  MENTOR: Users,
  PRINCIPAL: Building2,
  ADMIN: ShieldCheck,
  DEVELOPER: Sparkles
}

const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'bg-blue-100 text-blue-700',
  TEACHER: 'bg-emerald-100 text-emerald-700',
  COUNSELOR: 'bg-rose-100 text-rose-700',
  MENTOR: 'bg-amber-100 text-amber-700',
  PRINCIPAL: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-slate-100 text-slate-700',
  DEVELOPER: 'bg-fuchsia-100 text-fuchsia-700'
}

export function AppShell() {
  const { user, logout, refresh } = useAuth()
  const [view, setView] = useState<string>('dashboard')
  const [viewingAs, setViewingAs] = useState<{ id: string; name: string; role: string; email: string } | null>(null)

  // Demo developer: fetch view-as status
  useEffect(() => {
    if (user?.isDemo && user.viewingAsUserId) {
      fetch(`/api/users`)
        .then(r => r.json())
        .then(d => {
          const target = d.users?.find((u: any) => u.id === user.viewingAsUserId)
          if (target) setViewingAs(target)
        })
        .catch(() => {})
    } else {
      setViewingAs(null)
    }
  }, [user?.isDemo, user?.viewingAsUserId, user])

  if (!user) return null

  const effectiveRole = user.role
  const RoleIcon = ROLE_ICONS[effectiveRole] || Sparkles

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
      setView('dashboard')
      toast.success(`Now viewing as ${ROLE_LABELS[role]}`, {
        description: 'You can preview this dashboard. Writes are blocked in demo mode.'
      })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleExitViewAs = async () => {
    try {
      await fetch('/api/auth/view-as', { method: 'DELETE' })
      await refresh()
      setView('dashboard')
      toast.success('Returned to Demo Developer view')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const renderDashboard = () => {
    switch (effectiveRole) {
      case 'STUDENT': return <StudentDashboard />
      case 'TEACHER': return <TeacherDashboard />
      case 'COUNSELOR': return <CounsellorDashboard />
      case 'MENTOR': return <MentorDashboard />
      case 'PRINCIPAL': return <PrincipalDashboard />
      case 'ADMIN': return <AdminDashboard />
      case 'DEVELOPER': return <DeveloperDashboard />
      default: return <div>Unknown role</div>
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* DEMO BANNER */}
      {user.isDemo && (
        <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs py-1.5 px-4 flex items-center justify-center gap-2 font-medium">
          <Eye className="w-3.5 h-3.5" />
          DEMO MODE — You are viewing the platform with full read access. Write actions (creating, editing, deleting) are blocked. {viewingAs ? `Currently previewing: ${viewingAs.name} (${ROLE_LABELS[viewingAs.role]})` : ''}
        </div>
      )}

      {/* TOP BAR */}
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-semibold leading-tight">ExaminerAI</div>
                <div className="text-[10px] text-muted-foreground leading-tight">FCCL JB Plant IT</div>
              </div>
            </Link>
            <Separator orientation="vertical" className="h-8" />
            <Badge variant="outline" className="hidden md:inline-flex text-xs">
              Fall 2025
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* ROLE SWITCHER (demo only) */}
            {user.isDemo && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="w-4 h-4 text-amber-500" />
                    <span className="hidden sm:inline">View as:</span>
                    <span className="font-semibold">{ROLE_LABELS[effectiveRole]}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs">Switch role view</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {Object.entries(ROLE_LABELS).map(([role, label]) => {
                    const Icon = ROLE_ICONS[role]
                    const active = effectiveRole === role
                    return (
                      <DropdownMenuItem
                        key={role}
                        onClick={() => role === 'DEVELOPER' ? handleExitViewAs() : handleViewAs(role)}
                        className={`gap-2 ${active ? 'bg-accent' : ''}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="flex-1">{label}</span>
                        {active && <Badge variant="secondary" className="text-[10px]">active</Badge>}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-accent transition">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className={`text-xs ${ROLE_COLORS[effectiveRole]}`}>
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <div className="text-xs font-medium leading-tight">{user.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{ROLE_LABELS[effectiveRole]}</div>
                  </div>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <UserCircle className="w-4 h-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Settings className="w-4 h-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user.isDemo && viewingAs && (
                  <DropdownMenuItem onClick={handleExitViewAs} className="gap-2 text-amber-700">
                    <Eye className="w-4 h-4" /> Exit view-as
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={logout} className="gap-2 text-rose-700">
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="hidden md:flex w-60 flex-col bg-background border-r">
          <ScrollArea className="flex-1">
            <nav className="p-3 space-y-1">
              <SidebarItem
                icon={LayoutDashboard}
                label="Dashboard"
                active={view === 'dashboard'}
                onClick={() => setView('dashboard')}
              />
              <SidebarItem
                icon={BookOpen}
                label="Courses"
                active={view === 'courses'}
                onClick={() => setView('courses')}
              />
              {effectiveRole === 'STUDENT' && (
                <>
                  <SidebarItem
                    icon={FileText}
                    label="Assignments"
                    active={view === 'assignments'}
                    onClick={() => setView('assignments')}
                  />
                  <SidebarItem
                    icon={Calendar}
                    label="Attendance"
                    active={view === 'attendance'}
                    onClick={() => setView('attendance')}
                  />
                  <SidebarItem
                    icon={Brain}
                    label="Mentor Sessions"
                    active={view === 'mentor'}
                    onClick={() => setView('mentor')}
                  />
                </>
              )}
              {effectiveRole === 'TEACHER' && (
                <>
                  <SidebarItem
                    icon={Users}
                    label="Students"
                    active={view === 'students'}
                    onClick={() => setView('students')}
                  />
                  <SidebarItem
                    icon={Bell}
                    label="Alerts"
                    active={view === 'alerts'}
                    onClick={() => setView('alerts')}
                  />
                  <SidebarItem
                    icon={FileText}
                    label="Gradebook"
                    active={view === 'gradebook'}
                    onClick={() => setView('gradebook')}
                  />
                </>
              )}
              {(effectiveRole === 'COUNSELOR' || effectiveRole === 'MENTOR') && (
                <SidebarItem
                  icon={Users}
                  label="Students"
                  active={view === 'students'}
                  onClick={() => setView('students')}
                />
              )}
              <SidebarItem
                icon={MessageSquare}
                label="Messages"
                active={view === 'messages'}
                onClick={() => setView('messages')}
              />
              {['PRINCIPAL', 'ADMIN', 'DEVELOPER'].includes(effectiveRole) && (
                <>
                  <SidebarItem
                    icon={BarChart3}
                    label="Analytics"
                    active={view === 'analytics'}
                    onClick={() => setView('analytics')}
                  />
                  <SidebarItem
                    icon={ShieldCheck}
                    label="Audit Log"
                    active={view === 'audit'}
                    onClick={() => setView('audit')}
                  />
                </>
              )}
              {['PRINCIPAL', 'ADMIN', 'DEVELOPER'].includes(effectiveRole) && (
                <SidebarItem
                  icon={Building2}
                  label="Institution"
                  active={view === 'institution'}
                  onClick={() => setView('institution')}
                />
              )}
            </nav>
          </ScrollArea>

          {/* Sidebar footer */}
          <div className="p-3 border-t">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ROLE_COLORS[effectiveRole]}`}>
                <RoleIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{user.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {ROLE_LABELS[effectiveRole]}
                  {user.isDemo && ' · DEMO'}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 overflow-y-auto">
          {view === 'dashboard' ? (
            renderDashboard()
          ) : (
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
              <div className="rounded-xl border bg-card p-8 text-center">
                <h2 className="text-xl font-semibold capitalize">{view}</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  This section is part of the ExaminerAI platform. In the demo, the main dashboard view is fully populated — switch to <strong>Dashboard</strong> in the sidebar to see role-specific data.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setView('dashboard')}
                >
                  ← Back to Dashboard
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function SidebarItem({ icon: Icon, label, active, onClick }: {
  icon: any
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}
