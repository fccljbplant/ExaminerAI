"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";

export function AdminCoordinatorTab() {
  const [courses, setCourses] = useState<Array<{
    id: string; name: string; description: string; isActive: boolean;
    domain?: string; level?: string;
    weeks: Array<{ id: string; weekNumber: number; phase: string; _count?: { days: number }; dayCount?: number }>;
    batches: Array<{ id: string; name: string }>;
  }>>([]);
  const [batches, setBatches] = useState<Array<{ id: string; name: string; courseId: string | null; courseName: string | null; totalMembers: number; studentCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ courses: typeof courses }>("/api/courses"),
      api.get<{ batches: typeof batches }>("/api/batches"),
    ]).then(([cr, co]) => {
      setCourses(cr.courses || []);
      setBatches(co.batches || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  // Content quality check: courses with empty descriptions, no batches, inactive
  const qualityIssues: Array<{ course: string; issue: string }> = [];
  for (const c of courses) {
    if (!c.description?.trim()) qualityIssues.push({ course: c.name, issue: "No description" });
    if (c.batches.length === 0) qualityIssues.push({ course: c.name, issue: "No batch assigned" });
    if (!c.isActive) qualityIssues.push({ course: c.name, issue: "Inactive" });
    const totalDays = c.weeks.reduce((a, w) => a + (w.dayCount || w._count?.days || 0), 0);
    if (totalDays === 0) qualityIssues.push({ course: c.name, issue: "No days defined" });
  }

  return (
    <div className="space-y-4">
      {/* Course catalog summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><BookOpen className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Total Courses</span></div>
            <p className="text-2xl font-bold text-foreground">{courses.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Total Batches</span></div>
            <p className="text-2xl font-bold text-foreground">{batches.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Assigned</span></div>
            <p className="text-2xl font-bold text-foreground">{courses.filter(c => c.batches.length > 0).length}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Quality Issues</span></div>
            <p className="text-2xl font-bold text-foreground">{qualityIssues.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Batch → Course assignment matrix */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Batch → Course Assignments</CardTitle>
          <CardDescription className="text-muted-foreground">Which batch is studying which course</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No batches yet. Create batches to assign courses.</p>
          ) : (
            <div className="space-y-1.5">
              {batches.map(co => (
                <div key={co.id} className="flex items-center justify-between text-sm border border-border rounded-md p-2.5">
                  <div>
                    <span className="font-medium text-foreground">{co.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{co.studentCount} students</span>
                  </div>
                  <Badge variant="outline" className={co.courseName ? "text-[10px] bg-primary/10 text-primary border-primary/30" : "text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30"}>
                    {co.courseName || "No course assigned"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content quality issues */}
      {qualityIssues.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Content Quality Issues</CardTitle>
            <CardDescription className="text-muted-foreground">Courses that may need attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {qualityIssues.map((q, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">{q.issue}</Badge>
                <span className="text-foreground">{q.course}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick link to Course Planner */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <a href="/?view=course-planner" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <BookOpen className="h-4 w-4" /> Open Course Planner for detailed editing →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
