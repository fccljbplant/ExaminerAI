"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { ALL_ADMIN_ROLES } from "@/lib/client-rbac";
import Login, { type PublicUser } from "./Login";
import StudentDashboard from "./StudentDashboard";
import TeacherDashboard from "./TeacherDashboard";
import AdminDashboard from "./AdminDashboard";
import GuardianDashboard from "./GuardianDashboard";
import CounselorDashboard from "./CounselorDashboard";
import PrincipalDashboard from "./PrincipalDashboard";
import { AITutor } from "@/modules/ai-tutor";
import { TeacherAITutor } from "@/modules/ai-assistant";
import Messages from "./Messages";
import CourseOutline from "./CourseOutline";
import CoursePlanner from "./CoursePlanner";
import { SettingsPanel } from "./SettingsPanel";
import GuardianReportCards from "./GuardianReportCards";
import { AskMyTeacher } from "./AskMyTeacher";
import ErrorBoundary from "./ErrorBoundary";
import {
  GraduationCap,
  LayoutDashboard,
  CalendarCheck,
  ClipboardCheck,
  HelpCircle,
  ClipboardList,
  TrendingUp,
  FileText,
  BookOpen,
  Bot,
  Settings,
  Users,
  MessageSquare,
  ShieldAlert,
  Key,
  LogOut,
  Menu,
  X,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  HeartHandshake,
  BarChart3,
  Zap,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { UnifiedThemeToggle } from "@/modules/theme";

export type ViewKey =
  | "dashboard"
  | "journey"
  | "checkin"
  | "question"
  | "weekly-test"
  | "gantt"
  | "report-card"
  | "course-outline"
  | "ai-tutor"
  | "teacher-ai-tutor"
  | "messages"
  | "settings"
  | "batch"
  | "batch-students"
  | "batch-mentorship"
  | "batch-assignments"
  | "batch-insights"
  | "counselor-dashboard"
  | "principal-dashboard"
  | "guardian-dashboard"
  | "guardian-progress"
  | "admin-dashboard"
  | "admin-users"
  | "admin-courses"
  | "admin-features"
  | "admin-resets"
  | "admin-system"
  | "course-planner";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  roles: string[]; // which roles can see this
}

// All roles that see shared items (AI Tutor, Course, Messages, Settings)
const ALL_ROLES_WITH_SHARED = ["student", "teacher", "course_coordinator", "counselor", "guardian", "admin", "principal", "administrator", "demo"];
// Admin nav roles — administrator + principal. Demo is deliberately EXCLUDED:
// demo is read-only and has no admin-panel authority. Demo can still
// "view as" administrator via the role switcher, but the admin nav items
// are hidden from demo's default nav.
// M2 fix (audit 2026-07-26): principal now has access to admin-users, admin-courses,
// admin-features, admin-resets, admin-system — was admin-only, so principals couldn't
// manage users/courses/features even though they're institution-level administrators.
const ADMIN_NAV_ROLES = ["admin", "administrator", "principal"];
const PRINCIPAL_NAV_ROLES = ["principal"];
// Staff-only roles — see the Teacher AI Assistant nav item. Excludes students,
// guardians, and pending users. (teaching_assistant role removed — teachers
// now handle all teaching duties directly.)
const STAFF_NAV_ROLES = ["teacher", "course_coordinator", "counselor", "admin", "principal", "administrator", "demo"];

const ALL_NAV: NavItem[] = [
  // ===== STUDENT (4 clear views: Home, Study, Project, Progress) =====
  { key: "dashboard", label: "Home", icon: LayoutDashboard, roles: ["student"] },
  { key: "checkin", label: "Study", icon: BookOpen, roles: ["student"] },
  { key: "gantt", label: "Project", icon: ClipboardList, roles: ["student"] },
  { key: "report-card", label: "Progress", icon: FileText, roles: ["student"] },

  // ===== TEACHER (5 prominent views) =====
  { key: "batch", label: "Today", icon: LayoutDashboard, roles: ["teacher"] },
  { key: "batch-students", label: "Students", icon: Users, roles: ["teacher"] },
  { key: "batch-mentorship", label: "Mentorship", icon: HeartHandshake, roles: ["teacher"] },
  { key: "batch-assignments", label: "Assignments", icon: ClipboardList, roles: ["teacher"] },
  { key: "batch-insights", label: "Insights", icon: BarChart3, roles: ["teacher"] },

  // ===== COUNSELOR (purpose-built wellbeing dashboard — NOT a teacher clone) =====
  { key: "counselor-dashboard", label: "Command Center", icon: Zap, roles: ["counselor"] },

  // ===== TEACHER / COURSE COORDINATOR (batch + course planner) =====
  { key: "course-planner", label: "Course Planner", icon: GraduationCap, roles: ["teacher", "course_coordinator"] },
  // M4 fix (audit 2026-07-26): course coordinators now have access to the
  // batch-students view so they can see the students in their institution's
  // courses (was admin/teacher-only, so coordinators had zero student visibility).
  { key: "batch-students", label: "Students", icon: Users, roles: ["course_coordinator"] },

  // ===== GUARDIAN (purpose-built parent dashboard — NOT a student clone) =====
  { key: "guardian-dashboard", label: "Overview", icon: LayoutDashboard, roles: ["guardian"] },
  { key: "guardian-progress", label: "Report Cards", icon: FileText, roles: ["guardian"] },

  // ===== PRINCIPAL (institution administrator — purpose-built dashboard) =====
  { key: "principal-dashboard", label: "Institution", icon: Building2, roles: PRINCIPAL_NAV_ROLES },

  // ===== ADMIN (system-level — user management, features, system health) =====
  { key: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ADMIN_NAV_ROLES },
  { key: "admin-users", label: "Users", icon: Users, roles: ADMIN_NAV_ROLES },
  { key: "admin-courses", label: "Courses", icon: BookOpen, roles: ADMIN_NAV_ROLES },
  { key: "admin-features", label: "Features", icon: Settings, roles: ADMIN_NAV_ROLES },
  { key: "admin-resets", label: "Passwords", icon: Key, roles: ADMIN_NAV_ROLES },
  { key: "admin-system", label: "System", icon: ShieldAlert, roles: ADMIN_NAV_ROLES },

  // ===== SHARED (all authenticated roles) =====
  // AI Tutor — student-facing only (teachers/counselors use AI Assistant instead)
  // LO-9 fix: removed "guardian" from AI Tutor roles — the AI Tutor is a
  // student-facing practice chatbot. Guardians view their child's progress,
  // they don't practice questions. The guardian dashboard already surfaces
  // relevant information without needing a practice chat interface.
  { key: "ai-tutor", label: "AI Tutor", icon: Bot, roles: ["student"] },
  // Teacher AI Assistant — staff-only (teachers, coordinators, counselors, admins).
  { key: "teacher-ai-tutor", label: "AI Assistant", icon: GraduationCap, roles: STAFF_NAV_ROLES },
  { key: "course-outline", label: "Course", icon: BookOpen, roles: ALL_ROLES_WITH_SHARED },
  { key: "messages", label: "Messages", icon: MessageSquare, roles: ALL_ROLES_WITH_SHARED },
  { key: "settings", label: "Settings", icon: Settings, roles: ALL_ROLES_WITH_SHARED },
];

/** Inline Gantt icon for the sidebar (matches the one in StudentDashboard). */
function GanttIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="4" x2="21" y2="4" />
      <rect x="3" y="6" width="6" height="2.5" rx="0.5" />
      <rect x="3" y="10" width="10" height="2.5" rx="0.5" />
      <rect x="3" y="14" width="14" height="2.5" rx="0.5" />
      <rect x="3" y="18" width="18" height="2.5" rx="0.5" />
    </svg>
  );
}

export default function AppShell() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [navConfig, setNavConfig] = useState<Record<string, string[]> | null>(null);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [viewHistory, setViewHistory] = useState<ViewKey[]>([]);
  const [navClickCount, setNavClickCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  // Project config — fetched once we know the user is a student. Drives whether
  // the Project (gantt) nav item + project banners are shown. Project nav is
  // only visible when the student's assigned course has projectEnabled=true AND
  // the course is at least 4 weeks long (the same rule the API enforces).
  const [projectConfig, setProjectConfig] = useState<{
    courseAssigned: boolean;
    projectEnabled: boolean;
    projectRequired: boolean;
    totalWeeks: number;
  } | null>(null);

  // Fetch role nav config (admin-customizable) on mount. Falls back to
  // the hardcoded ALL_NAV roles if no DB config exists.
  useEffect(() => {
    api.get<{ configs: Array<{ role: string; navItems: string[] }> }>("/api/role-nav-config")
      .then((res) => {
        const map: Record<string, string[]> = {};
        for (const c of res.configs || []) {
          map[c.role] = c.navItems;
        }
        setNavConfig(map);
      })
      .catch(() => {/* silent — fallback to ALL_NAV defaults */});
  }, []);

  // Navigate to a view, pushing the current view to history
  const navigateTo = (newView: ViewKey) => {
    if (newView !== view) {
      setViewHistory(prev => [...prev, view]);
    }
    setView(newView);
    setSidebarOpen(false);
  };

  // Go back to the previous view
  const goBack = () => {
    setViewHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setView(last);
      return prev.slice(0, -1);
    });
  };
  // Admin/Developer can impersonate ANY role to test dashboards.
  // Demo default: teacher interface (user requested)
  const [adminAs, setAdminAs] = useState<string>("teacher");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Map raw role (including legacy aliases) to canonical nav role.
  // This determines which nav items + dashboard the user sees.
  const ADMIN_ROLES_RAW = [...ALL_ADMIN_ROLES, "principal"];
  const rawRole = user?.role ?? "student";
  const isAdminEquivalent = ADMIN_ROLES_RAW.includes(rawRole);

  // For admin/dev impersonation: effectiveRole = adminAs (which role they're testing)
  // For everyone else: effectiveRole = their canonical role
  const effectiveRole: string = isAdminEquivalent ? adminAs : rawRole;

  // Update document title per view — uses navConfig (DB-backed) when available,
  // falls back to ALL_NAV static roles. This was previously using ONLY the
  // static roles array, which didn't reflect admin-customized nav config.
  useEffect(() => {
    const navItem = ALL_NAV.find(n => n.key === view);
    // Check if this view is visible to the current role
    const isVisible = navConfig && navConfig[effectiveRole]
      ? navConfig[effectiveRole].includes(view)
      : navItem?.roles.includes(effectiveRole) ?? false;
    const title = isVisible ? (navItem?.label ?? "Dashboard") : "Dashboard";
    document.title = `${title} — AI Examiner`;
  }, [view, effectiveRole, navConfig]);

  const refreshUser = useCallback(async () => {
    setTimedOut(false);
    setLoading(true);
    try {
      const res = await api.get<{ user: PublicUser | null }>("/api/auth/me");
      setUser(res.user);
      if (res.user) {
        // Set demo flag for client-side write blocking
        const isDemo = res.user.email === "demo@examiner.ai";
        if (typeof window !== "undefined") {
          if (isDemo) {
            localStorage.setItem("examiner-is-demo", "1");
          } else {
            localStorage.removeItem("examiner-is-demo");
          }
        }
        const role = res.user.role;
        const adminRoles = [...ALL_ADMIN_ROLES];
        if (adminRoles.includes(role)) {
          // Demo developer defaults to teacher interface (user requested)
          if (res.user.email === "demo@examiner.ai") {
            setAdminAs("teacher");
            setView("batch");
          } else {
            setAdminAs("admin");
            setView("admin-dashboard");
          }
        } else if (role === "principal") {
          setView("principal-dashboard");
        } else if (role === "teacher" ) {
          setView("batch");
        } else if (role === "course_coordinator") {
          setView("course-planner");
        } else if (role === "counselor") {
          setView("counselor-dashboard"); // counselors see their own purpose-built dashboard
        } else if (role === "guardian") {
          setView("guardian-dashboard"); // guardians see a read-only student-like view
        } else {
          setView("dashboard"); // student
        }

        // Fetch project config for students/guardians (guardian sees the linked
        // student's project config). Used to hide the Project nav item when the
        // student's course has projects disabled or no course assigned.
        if (role === "student" || role === "guardian") {
          try {
            const statsRes = await api.get<{ projectConfig?: {
              courseAssigned: boolean;
              projectEnabled: boolean;
              projectRequired: boolean;
              totalWeeks: number;
            } }>("/api/stats" + (role === "guardian" ? "" : "?as=student"));
            setProjectConfig(statsRes.projectConfig ?? null);
          } catch {
            // Silent — fall back to "show project nav" for backward compat
            setProjectConfig(null);
          }
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Capture URL view param BEFORE refreshUser (it may override it)
    let urlView: ViewKey | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      urlView = params.get("view") as ViewKey | null;
      if (urlView) {
        const url = new URL(window.location.href);
        url.searchParams.delete("view");
        window.history.replaceState({}, "", url.toString());
      }
    }
    refreshUser().then(() => {
      // Apply URL view AFTER refreshUser resolves (so it doesn't get overridden)
      if (urlView) setView(urlView);
    });
    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [refreshUser]);

  // Poll for unread messages every 30 seconds — shows a red dot on the
  // Messages nav item when there are unread messages.
  useEffect(() => {
    if (!user) return;
    const checkUnread = async () => {
      try {
        const res = await fetch("/api/messages?box=received", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const unread = (data.messages || []).filter((m: { isRead: boolean }) => !m.isRead).length;
          setUnreadCount(unread);
        }
      } catch {
        // silent
      }
    };
    checkUnread();
    const id = setInterval(checkUnread, 30000);
    return () => clearInterval(id);
  }, [user]);

  // Poll for open student alerts every 60s — shows a red badge on the
  // batch dashboard nav item for teachers when students need attention.
  useEffect(() => {
    if (!user) return;
    // Only staff roles see alerts
    const staffRoles = ["teacher", "course_coordinator", "counselor", "admin", "principal", "administrator", "demo"];
    if (!staffRoles.includes(user.role) && user.role !== "admin") return;
    const checkAlerts = async () => {
      try {
        const res = await api.get<{ alerts: unknown[] }>("/api/students/alerts");
        setAlertCount(res.alerts?.length || 0);
      } catch {
        // silent
      }
    };
    checkAlerts();
    const id = setInterval(checkAlerts, 60_000);
    return () => clearInterval(id);
  }, [user]);

  // Clear unread count when viewing the Messages tab
  useEffect(() => {
    if (view === "messages") setUnreadCount(0);
  }, [view]);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("examiner-is-demo");
    }
    setUser(null);
    setView("dashboard");
  }, []);

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Sparkles className="h-5 w-5 animate-pulse text-primary" />
          <span>Loading AI Examiner…</span>
        </div>
      </div>
    );
  }

  if (loading && timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-sm">
          <Sparkles className="h-8 w-8 text-primary mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Taking longer than expected</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The server might be starting up. Please try again.
            </p>
          </div>
          <Button onClick={refreshUser} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoggedIn={(u) => {
      setUser(u);
      const adminRoles = [...ALL_ADMIN_ROLES];
      if (adminRoles.includes(u.role)) {
        if (u.email === "demo@examiner.ai") {
          setAdminAs("teacher");
          setView("batch");
        } else {
          setAdminAs("admin");
          setView("admin-dashboard");
        }
      }
      else if (u.role === "principal") setView("principal-dashboard");
      else if (u.role === "teacher") setView("batch");
      else if (u.role === "course_coordinator") setView("course-planner");
      else if (u.role === "counselor") setView("counselor-dashboard");
      else if (u.role === "guardian") setView("guardian-dashboard");
      else setView("dashboard");
    }} />;
  }

  // Filter nav items: if DB config exists for this role, use it.
  // Otherwise fall back to the hardcoded ALL_NAV roles array.
  const visibleNav = ALL_NAV.filter((n) => {
    if (navConfig && navConfig[effectiveRole]) {
      // DB config exists — check if this nav key is in the allowed list
      if (!navConfig[effectiveRole].includes(n.key)) return false;
    } else {
      // No DB config — use hardcoded defaults
      if (!n.roles.includes(effectiveRole)) return false;
    }

    // Project nav (gantt) — hide entirely when the student's course has no
    // project enabled OR the student has no course assigned. Same rule the
    // API enforces. We can't fetch projectConfig for non-student roles, so
    // we only apply this filter to students + guardians.
    if (n.key === "gantt" && (effectiveRole === "student" || effectiveRole === "guardian")) {
      if (projectConfig && (!projectConfig.courseAssigned || !projectConfig.projectEnabled)) {
        return false;
      }
    }
    return true;
  });
  const currentNav = visibleNav.find((n) => n.key === view) ?? visibleNav[0];

  const renderView = () => {
    const wrap = (el: React.ReactNode) => <ErrorBoundary key={view}>{el}</ErrorBoundary>;
    switch (view) {
      case "dashboard": return wrap(<StudentDashboard key={`home-${navClickCount}`} />);
      case "journey": return wrap(<StudentDashboard key={`home-j-${navClickCount}`} />);
      case "checkin": return wrap(<StudentDashboard key={`study-${navClickCount}`} initialMode="checkin" />);
      case "question": return wrap(<StudentDashboard key={`study-q-${navClickCount}`} initialMode="question" />);
      case "weekly-test": return wrap(<StudentDashboard key={`study-wt-${navClickCount}`} initialMode="weekly-test" />);
      case "gantt": return wrap(<StudentDashboard key={`project-${navClickCount}`} initialMode="gantt" />);
      case "report-card": return wrap(<StudentDashboard key={`progress-${navClickCount}`} initialMode="report-card" />);
      case "guardian-dashboard": return wrap(<GuardianDashboard key={`guardian-${navClickCount}`} onMessage={() => navigateTo("messages")} />);
      case "guardian-progress": return wrap(<GuardianReportCards key={`guardian-progress-${navClickCount}`} />);
      case "batch": return wrap(<TeacherDashboard initialTab="today" />);
      case "batch-students": return wrap(<TeacherDashboard initialTab="students" />);
      case "batch-mentorship": return wrap(<TeacherDashboard initialTab="mentorship" />);
      case "batch-assignments": return wrap(<TeacherDashboard initialTab="assignments" />);
      case "batch-insights": return wrap(<TeacherDashboard initialTab="insights" />);
      case "counselor-dashboard": return wrap(<CounselorDashboard key={`counselor-${navClickCount}`} onNavigateToMessages={() => navigateTo("messages")} onStudentClick={(studentId, studentName) => {
        // H7 fix: open the student's portfolio in a new tab so counselors can
        // view full details without losing their place in the dashboard.
        // The portfolio page is rendered via the teacher's StudentPortfolioPage
        // component — we open it via URL with the studentId in the query string.
        if (typeof window !== "undefined") {
          window.open(`/?view=batch-students&studentId=${encodeURIComponent(studentId)}`, "_blank");
        }
      }} />);
      case "principal-dashboard": return wrap(<PrincipalDashboard key={`principal-${navClickCount}`} />);
      case "ai-tutor": return wrap(<AITutor />);
      case "teacher-ai-tutor": return wrap(<TeacherAITutor />);
      case "course-outline": return wrap(<CourseOutline />);
      case "messages": return wrap(<Messages />);
      case "settings": return wrap(<SettingsPanel user={user ? { id: user.id, name: user.name, email: user.email, role: user.role, hasSecurityQuestion: user.hasSecurityQuestion } : null} />);
      case "admin-dashboard": return wrap(<AdminDashboard initialView="overview" />);
      case "admin-users": return wrap(<AdminDashboard initialView="users" />);
      case "admin-courses": return wrap(<AdminDashboard initialView="courses" />);
      case "admin-features": return wrap(<AdminDashboard initialView="features" />);
      case "admin-resets": return wrap(<AdminDashboard initialView="resets" />);
      case "admin-system": return wrap(<AdminDashboard initialView="system" />);
      case "course-planner": return wrap(<CoursePlanner />);
      default: return wrap(<StudentDashboard />);
    }
  };

  // Teacher dashboard: render within AppShell (no separate sidebar).
  // The TeacherShell sidebar is not used — the AppShell sidebar handles nav.
  // TeacherDashboard's internal tab state provides the sub-navigation.
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* DEMO BANNER */}
      {user?.email === "demo@examiner.ai" && (
        <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          DEMO MODE — Read-only access. Write actions are blocked. Use the role switcher below to preview any dashboard.
        </div>
      )}
      {/* Skip to content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-sm"
      >
        Skip to content
      </a>
      <div className="flex flex-1 min-h-0">
      {/* Mobile sidebar toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border text-foreground shadow-sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 z-40 h-screen w-64 flex-shrink-0 border-r border-border bg-card transition-transform duration-200 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-4 flex-shrink-0">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-bold text-foreground flex-1">ExaminerAI</span>
          <UnifiedThemeToggle />
        </div>

        <nav className="px-3 py-4 space-y-1 overflow-y-auto flex-1">
          {visibleNav.map((item, idx) => {
            const Icon = item.icon;
            const active = currentNav?.key === item.key;

            // Phase B: Add section dividers between nav groups.
            // Student groups: Daily Work | Assessment | Project & Progress | Resources | Account
            const dividerBefore = effectiveRole === "student" && (
              (item.key === "weekly-test") ||  // before Assessment
              (item.key === "gantt") ||        // before Project & Progress
              (item.key === "ai-tutor") ||     // before Resources
              (item.key === "journey")         // before Account
            );

            return (
              <div key={`${item.key}-${item.label}`}>
                {dividerBefore && <div className="h-px bg-border my-2 mx-3" />}
                <button
                  onClick={() => {
                    if (active) {
                      setNavClickCount(c => c + 1);
                    } else {
                      navigateTo(item.key);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0">
                      {item.badge}
                    </Badge>
                  )}
                  {item.key === "messages" && unreadCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                  {item.key === "batch" && alertCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Admin/Developer role switcher — test ANY role's dashboard */}
        {isAdminEquivalent && (
          <div className="border-t border-border p-3 space-y-2 flex-shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-primary font-bold">View As Role</div>
            <div className="grid grid-cols-2 gap-1">
              {([
                { role: "student", label: "Student", view: "dashboard" },
                { role: "teacher", label: "Teacher", view: "batch" },
                { role: "course_coordinator", label: "Coordinator", view: "course-planner" },
                { role: "counselor", label: "Counselor", view: "counselor-dashboard" },
                { role: "guardian", label: "Guardian", view: "guardian-dashboard" },
                { role: "principal", label: "Principal", view: "principal-dashboard" },
                { role: "admin", label: "Admin", view: "admin-dashboard" },
              ] as const).map((r) => (
                <button
                  key={r.role}
                  onClick={() => {
                    setAdminAs(r.role);
                    setView(r.view as ViewKey);
                  }}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors text-center",
                    adminAs === r.role
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground leading-snug">
              Switch to any role to preview their dashboard.
            </p>
          </div>
        )}

        {/* User card */}
        <div className="border-t border-border p-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3 w-3" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Backdrop on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main id="main-content" className="flex-1 min-w-0 lg:ml-0 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 ml-12 lg:ml-0">
            {viewHistory.length > 0 && (
              <Button onClick={goBack} variant="outline" size="sm" className="border-border px-2 sm:px-3 flex-shrink-0">
                <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
              </Button>
            )}
            <h1 className="text-base sm:text-lg font-semibold text-foreground">{currentNav?.label ?? "Dashboard"}</h1>
            {isAdminEquivalent && (
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                Viewing as: {effectiveRole}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            AI Examiner · Learning Platform
          </div>
        </header>

        <div className={cn(
          "flex-1 min-w-0 w-full min-h-0",
          // Chat views (AI Tutor, Teacher AI Assistant) fill the screen —
          // no max-width, no padding, so the chat can use the full height.
          view === "ai-tutor" || view === "teacher-ai-tutor"
            ? "p-2 sm:p-3 flex flex-col"
            : view === "course-outline"
            ? "p-2 sm:p-3"
            : "p-4 sm:p-6 max-w-7xl mx-auto",
          // Reserve bottom space so the floating "Ask My Teacher" + "Daily Task
          // Reminder" buttons (both visible to students, stacked at bottom-right)
          // don't overlap content. Ask My Teacher sits at bottom-6 (~72px tall
          // total), Daily Task Reminder at bottom-20 (~80px from bottom + 40px
          // tall = 120px total). pb-40 = 160px clears both with breathing room.
          // Skip for chat views — they have their own input area at the bottom.
          effectiveRole === "student" && view !== "ai-tutor" && "pb-40 sm:pb-40",
        )}>
          {renderView()}
        </div>
      </main>

      {/* Phase E.1: Ask My Teacher floating button */}
      {effectiveRole === "student" && view !== "messages" && (
        <AskMyTeacher currentView={view} />
      )}
      </div>
    </div>
  );
}
