"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { ALL_ADMIN_ROLES } from "@/lib/client-rbac";
import type { EnrollmentResponse } from "@/app/api/enrollments/route";
import Login, { type PublicUser } from "./Login";
import StudentDashboard from "./StudentDashboard";
import InstructorDashboard from "./InstructorDashboard";
import AdminDashboard from "./AdminDashboard";
import { EmployerDashboard } from "./EmployerDashboard";
import OrgAdminDashboard from "./OrgAdminDashboard";
import { AITutor } from "@/modules/ai-tutor";
import { InstructorAITutor } from "@/modules/ai-assistant";
import Messages from "./Messages";
import CourseOutline from "./CourseOutline";
import CoursePlanner from "./CoursePlanner";
import { CertificateApprovals } from "@/components/examiner/instructor/CertificateApprovals";
import { SettingsPanel } from "./SettingsPanel";
import { AskMyInstructor } from "./AskMyInstructor";
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
  BarChart3,
  ChevronDown,
  Check,
  Award,
  Briefcase,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { UnifiedThemeToggle } from "@/modules/theme";
import { NotificationBell } from "@/components/examiner/NotificationBell";
import { logger } from "@/lib/logger";

export type ViewKey =
  | "dashboard"
  | "checkin"
  | "gantt"
  | "report-card"
  | "credentials"
  | "course-outline"
  | "ai-tutor"
  | "instructor-ai-tutor"
  | "messages"
  | "settings"
  | "instructor-today"
  | "instructor-students"
  | "instructor-assignments"
  | "instructor-insights"
  | "instructor-certificates"
  | "admin-dashboard"
  | "admin-users"
  | "admin-courses"
  | "admin-features"
  | "admin-resets"
  | "admin-system"
  | "course-planner"
  | "employer-dashboard"
  | "org-dashboard"
  | "my-courses";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  roles: string[];
}

const ALL_ROLES_WITH_SHARED = ["learner", "instructor", "org_admin", "platform_admin", "demo"];
const ADMIN_NAV_ROLES = ["platform_admin", "demo"];
const STAFF_NAV_ROLES = ["instructor", "org_admin", "platform_admin", "demo"];

const ALL_NAV: NavItem[] = [
  { key: "dashboard", label: "Home", icon: LayoutDashboard, roles: ["learner"] },
  { key: "my-courses", label: "My Courses", icon: BookOpen, roles: ["learner"] },
  { key: "checkin", label: "Study", icon: BookOpen, roles: ["learner"] },
  { key: "gantt", label: "Project", icon: ClipboardList, roles: ["learner"] },
  { key: "report-card", label: "Progress", icon: FileText, roles: ["learner"] },
  { key: "credentials", label: "Credentials", icon: Award, roles: ["learner"] },

  { key: "instructor-today", label: "Today", icon: LayoutDashboard, roles: ["instructor"] },
  { key: "instructor-students", label: "Students", icon: Users, roles: ["instructor"] },
  { key: "instructor-assignments", label: "Assignments", icon: ClipboardList, roles: ["instructor"] },
  { key: "instructor-insights", label: "Insights", icon: BarChart3, roles: ["instructor"] },
  // Certificate approvals — was buried at the bottom of AssignmentsTab.
  // Now its own nav entry so mentors can find it.
  { key: "instructor-certificates", label: "Certificates", icon: Award, roles: ["instructor"] },

  // Org admin extras — Course Planner + shared Students roster.
  // NOTE: "instructor-students" is already registered for instructors above
  // (line 107). Adding it here with roles ["instructor", "org_admin"] caused
  // a DUPLICATE "Students" entry in the instructor sidebar. Now scoped to
  // org_admin only — instructors get it from the block above.
  { key: "course-planner", label: "Course Planner", icon: GraduationCap, roles: ["org_admin"] },
  { key: "instructor-students", label: "Students", icon: Users, roles: ["org_admin"] },

  // Employer / B2B dashboard — for company managers sponsoring trainees.
  // Visible to org_admin + platform_admin.
  { key: "org-dashboard", label: "Org Dashboard", icon: Building2, roles: ["org_admin"] },
  { key: "employer-dashboard", label: "Sponsor ROI", icon: TrendingUp, roles: ["org_admin"] },

  { key: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ADMIN_NAV_ROLES },
  { key: "admin-users", label: "Users", icon: Users, roles: ADMIN_NAV_ROLES },
  { key: "admin-courses", label: "Courses", icon: BookOpen, roles: ADMIN_NAV_ROLES },
  { key: "admin-features", label: "Features", icon: Settings, roles: ADMIN_NAV_ROLES },
  { key: "admin-resets", label: "Passwords", icon: Key, roles: ADMIN_NAV_ROLES },
  { key: "admin-system", label: "System", icon: ShieldAlert, roles: ADMIN_NAV_ROLES },

  { key: "ai-tutor", label: "AI Tutor", icon: Bot, roles: ["learner"] },
  { key: "instructor-ai-tutor", label: "AI Assistant", icon: GraduationCap, roles: STAFF_NAV_ROLES },
  { key: "course-outline", label: "Course", icon: BookOpen, roles: ALL_ROLES_WITH_SHARED },
  { key: "messages", label: "Messages", icon: MessageSquare, roles: ALL_ROLES_WITH_SHARED },
  { key: "settings", label: "Settings", icon: Settings, roles: ALL_ROLES_WITH_SHARED },
];

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

interface CourseOption {
  id: string;
  name: string;
  role: string;
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
  const [enrollments, setEnrollments] = useState<EnrollmentResponse["enrollments"]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string>("");
  const [courseSelectorOpen, setCourseSelectorOpen] = useState(false);

  useEffect(() => {
    api.get<{ configs: Array<{ role: string; navItems: string[] }> }>("/api/role-nav-config")
      .then((res) => {
        const map: Record<string, string[]> = {};
        for (const c of res.configs || []) {
          map[c.role] = c.navItems;
        }
        setNavConfig(map);
      })
      .catch((err) => { logger.warn("Operation failed", { err }); });
  }, []);

  const navigateTo = (newView: ViewKey) => {
    if (newView !== view) {
      setViewHistory(prev => [...prev, view]);
    }
    setView(newView);
    setSidebarOpen(false);
  };

  const goBack = () => {
    setViewHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setView(last);
      return prev.slice(0, -1);
    });
  };

  const [adminAs, setAdminAs] = useState<string>("instructor");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const ADMIN_ROLES_RAW = [...ALL_ADMIN_ROLES];
  const rawRole = user?.role ?? "learner";
  const isAdminEquivalent = ADMIN_ROLES_RAW.includes(rawRole);
  const effectiveRole: string = isAdminEquivalent ? adminAs : rawRole;

  useEffect(() => {
    const navItem = ALL_NAV.find(n => n.key === view);
    const isVisible = navConfig && navConfig[effectiveRole]
      ? navConfig[effectiveRole].includes(view)
      : navItem?.roles.includes(effectiveRole) ?? false;
    const title = isVisible ? (navItem?.label ?? "Dashboard") : "Dashboard";
    document.title = `${title} — TraineesAI`;
  }, [view, effectiveRole, navConfig]);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await api.get<EnrollmentResponse>("/api/enrollments");
      setEnrollments(res.enrollments || []);
      if (res.enrollments && res.enrollments.length > 0) {
        setActiveCourseId(res.enrollments[0].courseId);
      } else {
        setActiveCourseId("");
      }
    } catch {
      setEnrollments([]);
      setActiveCourseId("");
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setTimedOut(false);
    setLoading(true);
    try {
      const res = await api.get<{ user: PublicUser | null }>("/api/auth/me");
      setUser(res.user);
      if (res.user) {
        const isDemo = res.user?.email?.includes("@demo.ai") || user?.email === "demo@examiner.ai";
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
          if (res.user?.email?.includes("@demo.ai") || user?.email === "demo@examiner.ai") {
            setAdminAs("instructor");
            setView("instructor-today");
          } else {
            setAdminAs("platform_admin");
            setView("admin-dashboard");
          }
        } else if (role === "instructor") {
          setView("instructor-today");
        } else if (role === "org_admin") {
          // Default to the org overview dashboard (team + seats) instead of
          // course-planner. Org admins need to see their team first, not the
          // course authoring tool.
          setView("org-dashboard");
        } else {
          setView("dashboard");
        }

        // Fetch user's course enrollments
        await fetchEnrollments();

        // Students have course-aware data via enrollments
        // projectConfig is now part of each enrollment entry
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchEnrollments]);

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
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
      if (urlView) setView(urlView);
    });
    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [refreshUser]);

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
      } catch {}
    };
    checkUnread();
    const id = setInterval(checkUnread, 30000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const staffRoles = ["instructor", "org_admin", "platform_admin", "demo"];
    if (!staffRoles.includes(user.role)) return;
    const checkAlerts = async () => {
      try {
        const res = await api.get<{ alerts: unknown[] }>("/api/students/alerts");
        setAlertCount(res.alerts?.length || 0);
      } catch {}
    };
    checkAlerts();
    const id = setInterval(checkAlerts, 60_000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (view === "messages") setUnreadCount(0);
  }, [view]);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", {});
    } catch {}
    if (typeof window !== "undefined") {
      localStorage.removeItem("examiner-is-demo");
    }
    setUser(null);
    setView("dashboard");
  }, []);

  if (loading) {
    // AppShell instant-render: render the sidebar + header chrome immediately
    // so the user sees a recognizable app frame, not a blank spinner. Only the
    // main content area shows a loading state. The 10-second timeout is also
    // applied only to the content area — the shell stays put.
    return (
      <AppShellSkeleton
        timedOut={timedOut}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onRetry={refreshUser}
      />
    );
  }

  if (!user) {
    return <Login onLoggedIn={(u) => {
      setUser(u);
      const adminRoles = [...ALL_ADMIN_ROLES];
      if (adminRoles.includes(u.role)) {
        if (u.email === "demo@examiner.ai") {
          setAdminAs("instructor");
          setView("instructor-today");
        } else {
          setAdminAs("platform_admin");
          setView("admin-dashboard");
        }
      }
      else if (u.role === "instructor") setView("instructor-today");
      else if (u.role === "org_admin") setView("course-planner");
      else setView("dashboard");
      // Fetch enrollments for learners + instructors
      if (["learner", "instructor"].includes(u.role)) fetchEnrollments();
    }} />;
  }

  const isStudent = effectiveRole === "learner" || effectiveRole === "student";
  const enrolled = isStudent ? enrollments.length > 0 : true;
  const activeEnrollment = enrollments.find(e => e.courseId === activeCourseId);

  const visibleNav = ALL_NAV.filter((n) => {
    if (navConfig && navConfig[effectiveRole]) {
      if (!navConfig[effectiveRole].includes(n.key)) return false;
    } else {
      if (!n.roles.includes(effectiveRole)) return false;
    }

    // Student nav items gated on enrollment
    if (isStudent && !enrolled) {
      // When unenrolled, show Messages, Settings, and My Courses (so the
      // student can browse the marketplace and self-enroll in a course).
      if (n.key !== "messages" && n.key !== "settings" && n.key !== "my-courses") return false;
    }

    // Project nav gated on course's projectEnabled
    if (n.key === "gantt" && isStudent) {
      if (!activeEnrollment?.projectEnabled) return false;
    }
    return true;
  // Dedupe by key — if the same nav key appears twice (e.g. "instructor-students"
  // registered for both instructor and org_admin), only keep the first match.
  // This prevents duplicate sidebar entries when a role matches multiple
  // registrations of the same key.
  }).filter((n, i, arr) => arr.findIndex(x => x.key === n.key) === i);
  const currentNav = visibleNav.find((n) => n.key === view) ?? visibleNav[0];

  const renderView = () => {
    const wrap = (el: React.ReactNode) => <ErrorBoundary key={view}>{el}</ErrorBoundary>;

    // Zero-enrollment state for students
    if (isStudent && !enrolled && view !== "messages" && view !== "settings" && view !== "my-courses") {
      return wrap(
        <div className="max-w-lg mx-auto pt-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Welcome to TraineesAI</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            You haven&apos;t been assigned a course yet. Your instructor or administrator
            will enroll you in a course soon. Check back here once you&apos;re enrolled.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="default" size="sm" onClick={() => navigateTo("my-courses")}>
              <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Browse Courses
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateTo("messages")}>
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Contact Instructor
            </Button>
          </div>
        </div>
      );
    }

    switch (view) {
      case "dashboard": return wrap(<StudentDashboard key={`home-${navClickCount}`} enrollments={enrollments} activeCourseId={activeCourseId} />);
      case "checkin": return wrap(<StudentDashboard key={`study-${navClickCount}`} initialMode="checkin" enrollments={enrollments} activeCourseId={activeCourseId} />);
      case "gantt": return wrap(<StudentDashboard key={`project-${navClickCount}`} initialMode="gantt" enrollments={enrollments} activeCourseId={activeCourseId} />);
      case "report-card": return wrap(<StudentDashboard key={`progress-${navClickCount}`} initialMode="report-card" enrollments={enrollments} activeCourseId={activeCourseId} />);
      case "credentials": return wrap(<StudentDashboard key={`credentials-${navClickCount}`} initialMode="credentials" enrollments={enrollments} activeCourseId={activeCourseId} />);
      case "my-courses": return wrap(<StudentDashboard key={`my-courses-${navClickCount}`} initialMode="my-courses" enrollments={enrollments} activeCourseId={activeCourseId} />);
      case "instructor-today": return wrap(<InstructorDashboard key={`today-${navClickCount}`} initialTab="today" courseId={activeCourseId} />);
      case "instructor-students": return wrap(<InstructorDashboard key={`students-${navClickCount}`} initialTab="students" courseId={activeCourseId} />);
      case "instructor-assignments": return wrap(<InstructorDashboard key={`assignments-${navClickCount}`} initialTab="assignments" courseId={activeCourseId} />);
      case "instructor-insights": return wrap(<InstructorDashboard key={`insights-${navClickCount}`} initialTab="insights" courseId={activeCourseId} />);
      case "instructor-certificates": return wrap(
        <div className="p-4 sm:p-6">
          <CertificateApprovals />
        </div>
      );
      case "ai-tutor": return wrap(<AITutor />);
      case "instructor-ai-tutor": return wrap(<InstructorAITutor />);
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
      case "employer-dashboard": return wrap(<EmployerDashboard />);
      case "org-dashboard": return wrap(<OrgAdminDashboard key={`org-${navClickCount}`} />);
      default: return wrap(<StudentDashboard />);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {user?.email === "demo@examiner.ai" && (
        <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          DEMO MODE — Read-only access. Write actions are blocked. Use the role switcher below to preview any dashboard.
        </div>
      )}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-sm"
      >
        Skip to content
      </a>
      <div className="flex flex-1 min-h-0">
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border text-foreground shadow-sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

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
          <span className="font-bold text-foreground flex-1">TraineesAI</span>
          <UnifiedThemeToggle />
        </div>

        {/* Course Selector — shown when user has multiple courses */}
        {(effectiveRole === "learner" || effectiveRole === "student" || effectiveRole === "instructor") && enrollments.length > 1 && (
          <div className="px-3 pt-3 pb-1 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setCourseSelectorOpen(!courseSelectorOpen)}
                className="w-full flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground bg-muted/50 hover:bg-muted transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 text-left truncate">
                  {activeEnrollment?.courseName || "Select Course"}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              {courseSelectorOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCourseSelectorOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                    {enrollments.map((enr) => (
                      <button
                        key={enr.courseId}
                        onClick={() => {
                          setActiveCourseId(enr.courseId);
                          setCourseSelectorOpen(false);
                          setNavClickCount(c => c + 1);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
                          enr.courseId === activeCourseId
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {enr.courseId === activeCourseId && <Check className="h-3 w-3 flex-shrink-0" />}
                        <span className="flex-1 truncate">{enr.courseName}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          Wk {enr.currentWeek}/{enr.totalWeeks}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <nav className="px-3 py-4 space-y-1 overflow-y-auto flex-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = currentNav?.key === item.key;

            const dividerBefore = effectiveRole === "student" && (
              (item.key === "gantt") ||
              (item.key === "ai-tutor") ||
              (item.key === "settings")
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
                  {(item.key === "instructor-today") && alertCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-growth-amber px-1 text-[10px] font-bold text-white">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Role Switcher */}
        {isAdminEquivalent && (
          <div className="border-t border-border p-3 space-y-2 flex-shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-primary font-bold">View As Role</div>
            <div className="grid grid-cols-2 gap-1">
              {([
                { role: "learner", label: "Learner", view: "dashboard" },
                { role: "instructor", label: "Instructor", view: "instructor-today" },
                { role: "org_admin", label: "Org Admin", view: "course-planner" },
                { role: "platform_admin", label: "Platform Admin", view: "admin-dashboard" },
              ] as const).map((r) => (
                <button
                  key={r.role}
                  onClick={() => {
                    setAdminAs(r.role);
                    setView(r.view as ViewKey);
                    setViewHistory([]); // Reset back-button history on role switch
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
            <p className="text-[10px] text-muted-foreground leading-snug">
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

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="text-xs text-muted-foreground hidden sm:block">
              TraineesAI · Training Platform
            </div>
          </div>
        </header>

        <div className={cn(
          "flex-1 min-w-0 w-full min-h-0",
          view === "ai-tutor" || view === "instructor-ai-tutor"
            ? "p-2 sm:p-3 flex flex-col"
            : view === "course-outline"
            ? "p-2 sm:p-3"
            : "p-4 sm:p-6 max-w-7xl mx-auto",
          effectiveRole === "learner" && view !== "ai-tutor" && "pb-40 sm:pb-40",
        )}>
          {renderView()}
        </div>
      </main>

      {(effectiveRole === "learner" || effectiveRole === "student") && view !== "messages" && (
        <AskMyInstructor currentView={view} />
      )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * AppShellSkeleton
 *
 * Renders the sidebar + header chrome immediately on first paint, so the
 * user sees a recognizable app frame (logo, nav, header) instead of a
 * blank spinner. Only the main content area shows a loading state.
 *
 * Two states:
 *   - timedOut=false → show a small spinner + "Loading TraineesAI…"
 *   - timedOut=true  → show "Taking longer than expected" + Retry button
 *
 * The shell itself (sidebar + header) is identical in both states, which
 * gives the perception that the app is alive and only the content is
 * loading — exactly the behavior the user expects from a desktop app.
 * ──────────────────────────────────────────────────────────────────── */
function AppShellSkeleton({
  timedOut,
  sidebarOpen,
  setSidebarOpen,
  onRetry,
}: {
  timedOut: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onRetry: () => void;
}) {
  // 5 placeholder nav items — enough to look like a real sidebar without
  // committing to a specific role's nav (which we don't know yet).
  const NAV_PLACEHOLDERS = 5;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex flex-1 min-h-0">
        {/* Mobile menu toggle (mirrors the real AppShell) */}
        <button
          className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border text-foreground shadow-sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Sidebar — same chrome as the real shell: logo header, skeleton
            nav items, and a skeleton user card at the bottom. */}
        <aside
          className={cn(
            "fixed lg:sticky top-0 z-40 h-screen w-64 flex-shrink-0 border-r border-border bg-card transition-transform duration-200 flex flex-col",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Logo header — real logo so the user knows where they are */}
          <div className="flex h-16 items-center gap-2 border-b border-border px-4 flex-shrink-0">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-bold text-foreground flex-1">TraineesAI</span>
            <UnifiedThemeToggle />
          </div>

          {/* Skeleton nav items — gray pulsing bars shaped like the real nav */}
          <nav className="px-3 py-4 space-y-1 overflow-y-auto flex-1">
            {Array.from({ length: NAV_PLACEHOLDERS }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                aria-hidden
              >
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 flex-1 max-w-[120px]" />
              </div>
            ))}
            <div className="h-px bg-border my-2 mx-3" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`sep-${i}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                aria-hidden
              >
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 flex-1 max-w-[100px]" />
              </div>
            ))}
          </nav>

          {/* Skeleton user card at the bottom — mirrors the real one */}
          <div className="border-t border-border p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-full" />
              </div>
            </div>
            <Skeleton className="h-7 w-full rounded-md" />
          </div>
        </aside>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main column */}
        <main
          id="main-content"
          className="flex-1 min-w-0 lg:ml-0 flex flex-col overflow-hidden"
        >
          {/* Header — real logo + skeleton page title + skeleton avatar */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur px-4 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-3 ml-12 lg:ml-0">
              {/* Visible logo on mobile (sidebar is hidden) */}
              <div className="lg:hidden inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <GraduationCap className="h-4 w-4" />
              </div>
              <Skeleton className="h-4 w-28 sm:w-36" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <span className="text-xs text-muted-foreground hidden sm:block">
                TraineesAI · Training Platform
              </span>
            </div>
          </header>

          {/* Content area — this is the ONLY place that shows a loading
              state. The 10-second timeout swaps the spinner for a Retry
              button. The shell (sidebar + header) stays put. */}
          <div className="flex-1 min-w-0 w-full min-h-0 p-4 sm:p-6 max-w-7xl mx-auto flex items-center justify-center">
            {timedOut ? (
              <div className="text-center space-y-4 max-w-sm">
                <Sparkles className="h-8 w-8 text-primary mx-auto" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Taking longer than expected
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    The server might be starting up. Please try again.
                  </p>
                </div>
                <Button
                  onClick={onRetry}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                <span>Loading TraineesAI…</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
