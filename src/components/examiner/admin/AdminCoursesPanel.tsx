"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";

export function AdminCoursesPanel() {
  const [courses, setCourses] = useState<Array<{
    id: string; name: string; description: string; isActive: boolean;
    domain?: string; level?: string;
    weeks: Array<{ id: string; weekNumber: number; phase: string; _count?: { days: number }; dayCount?: number }>;
    batches: Array<{ id: string; name: string }>;
  }>>([]);
  const [batches, setBatches] = useState<Array<{ id: string; name: string; courseId: string | null; courseName: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [courseRes, batchRes] = await Promise.all([
        api.get<{ courses: typeof courses }>("/api/courses"),
        api.get<{ batches: typeof batches }>("/api/batches"),
      ]);
      setCourses(courseRes.courses || []);
      setBatches(batchRes.batches || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load courses");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 4000); };

  const seedDefault = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>("/api/courses/seed-default");
      showMsg(res.message);
      await load();
    } catch (e) { showMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Delete this course?")) return;
    setBusy(true);
    try {
      await api.del(`/api/courses/${id}`);
      showMsg("Course deleted.");
      await load();
    } catch (e) {
      const err = e as { message?: string; assignedBatches?: { name: string }[] };
      if (err?.assignedBatches && err.assignedBatches.length > 0) {
        const names = (Array.isArray(err.assignedBatches) ? err.assignedBatches.map((c: { name: string }) => c.name).join(", ") : "");
        if (confirm(`Cannot delete: ${err.assignedBatches.length} batch(s) using this course (${names}). Force delete?`)) {
          await api.del(`/api/courses/${id}?force=true`);
          showMsg("Course deleted (batches unassigned).");
          await load();
        }
      } else {
        showMsg(err?.message || "Failed to delete");
      }
    }
    finally { setBusy(false); }
  };

  const assignBatch = async (batchId: string, courseId: string | null) => {
    try {
      await api.patch(`/api/batches/${batchId}`, { courseId });
      showMsg(courseId ? "Course assigned!" : "Course unassigned.");
      await load();
    } catch (e) { showMsg(e instanceof Error ? e.message : "Failed"); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Course Management
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {courses.length} course{courses.length === 1 ? "" : "s"} · {batches.length} batch{batches.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={seedDefault} disabled={busy} variant="outline" size="sm" className="border-border">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <GraduationCap className="h-3 w-3" />} Seed Default
              </Button>
              <Button onClick={load} variant="outline" size="sm" className="border-border">
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>
          </div>
          {msg && <p className="text-xs text-primary mt-2">{msg}</p>}
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </CardHeader>
      </Card>

      {/* Course list */}
      {courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No courses yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Click <strong>Seed Default</strong> to create the standard 6-week bootcamp, or use the
              <strong> Course Planner</strong> tab in the sidebar to generate a custom course with AI.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map(c => {
            const totalDays = c.weeks.reduce((a, w) => a + (w.dayCount || w._count?.days || 0), 0);
            return (
              <Card key={c.id} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-foreground">{c.name}</h3>
                        {c.domain && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{c.domain}</Badge>}
                        {c.level && <Badge variant="outline" className="text-[9px] text-muted-foreground">{c.level}</Badge>}
                        {!c.isActive && <Badge variant="outline" className="text-[9px] text-muted-foreground">Inactive</Badge>}
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="secondary" className="text-[9px] bg-muted text-muted-foreground">
                          {c.weeks.length} week{c.weeks.length === 1 ? "" : "s"} · {totalDays} day{totalDays === 1 ? "" : "s"}
                        </Badge>
                        {c.batches.length > 0 ? (
                          c.batches.map(co => (
                            <Badge key={co.id} variant="secondary" className="text-[9px] bg-primary/10 text-primary">
                              {co.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[10px] text-amber-600">⚠ No batch assigned — students can&apos;t see this</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <a href={`/?view=course-planner`} className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit in Course Planner">
                        <Edit3 className="h-3.5 w-3.5" />
                      </a>
                      <button onClick={() => deleteCourse(c.id)} disabled={busy} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete course">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick batch assignment */}
                  {batches.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-[10px] text-muted-foreground mb-1.5">Assign to batch:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {batches.map(co => {
                          const assigned = co.courseId === c.id;
                          return (
                            <button
                              key={co.id}
                              onClick={() => assignBatch(co.id, assigned ? null : c.id)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                assigned
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/70"
                              }`}
                            >
                              {co.name} {assigned && "✓"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Batch overview */}
      {batches.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm text-foreground">Batch → Course Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {batches.map(co => (
                <div key={co.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{co.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {co.courseName || "No course assigned"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
