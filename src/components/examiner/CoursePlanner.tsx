"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Trash2, Save, BookOpen, ChevronDown, ChevronRight,
  RefreshCw, GraduationCap, Edit3, X, Sparkles, Wand2, ExternalLink,
  CheckCircle2, Circle, AlertCircle, Copy, ClipboardList, Upload,
  UserCircle, Globe, Lock, Unlock,
} from "lucide-react";

interface CourseDay {
  id?: string; day: number; title: string; objective: string;
  whyItMatters: string; topicsCovered: string[]; activity: string;
  deliverable: string; resources: { label: string; url: string }[];
}
interface CourseWeek {
  id?: string; weekNumber: number; phase: string; milestone: string; days: CourseDay[]; dayCount?: number;
}
interface TeacherInfo { id: string; name: string; email: string; }
interface Course {
  id: string; name: string; description: string; isActive: boolean;
  domain?: string; level?: string; assessmentType?: string;
  notebooklmUrl?: string | null;
  subjects?: string[];
  weeks: CourseWeek[]; batches: { id: string; name: string }[];
  journeySteps?: unknown; projectTemplate?: unknown; aiPrompts?: unknown;
  testConfig?: unknown; reportCardTemplate?: unknown;
  // Project configuration — set by the course coordinator.
  projectEnabled?: boolean;
  projectRequired?: boolean;
  projectDefaultDurationWeeks?: number;
  // Default-course flag — marks this course as the default for new students.
  isDefault?: boolean;
  // Course-plan-centric overhaul fields
  status?: "draft" | "published";
  summary?: string | null;
  keyFeatures?: string[];
  contentText?: string | null;
  teacherId?: string | null;
  teacher?: TeacherInfo | null;
}
interface Batch { id: string; name: string; courseId: string | null; courseName: string | null; }

type View = "list" | "generate" | "detail";

export default function CoursePlanner() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // AI generation form state — course-plan-centric overhaul.
  // contentText is the primary source: paste text or extract from uploaded file.
  // The AI uses it (when provided) to drive the summary, keyFeatures, subjects,
  // and weekly plan.
  const [genForm, setGenForm] = useState({
    courseName: "", description: "", contentText: "",
    durationWeeks: 6, daysPerWeek: 5,
    targetAudience: "complete beginners", tools: "",
    // Phase AI-Tutor Revert: per-course NotebookLM URL (optional — falls back to global default if empty)
    notebooklmUrl: "",
    // Scale Tier 2: multiple subjects (comma-separated, parsed to array)
    subjects: "",
  });
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  // L11-fix: store interval ref for cleanup on unmount
  const genIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => { if (genIntervalRef.current) clearInterval(genIntervalRef.current); };
  }, []);
  const [genStatus, setGenStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const [courseRes, batchRes, teacherRes] = await Promise.all([
        api.get<{ courses: Course[] }>("/api/courses"),
        api.get<{ batches: Batch[] }>("/api/batches"),
        api.get<{ teachers: TeacherInfo[] }>("/api/courses/teachers").catch(() => ({ teachers: [] as TeacherInfo[] })),
      ]);
      setCourses(courseRes.courses || []);
      setBatches(batchRes.batches || []);
      setTeachers(teacherRes.teachers || []);
    } catch (e) {
      // Phase fix: show the error instead of silently swallowing it.
      // The old `catch { /* ignore */ }` meant if GET /api/courses failed
      // (auth, network, timeout), the admin saw "No courses yet" even
      // though courses existed in the DB.
      showMsg("error", e instanceof Error ? e.message : "Failed to load courses");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMsgType(type); setMsg(text);
    // Phase fix: only auto-dismiss SUCCESS messages. Errors stay visible
    // until the user takes action — the old 4-second timeout meant the
    // user never saw why their course generation failed.
    if (type === "success") {
      setTimeout(() => setMsg(""), 4000);
    }
  };

  const seedDefault = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>("/api/courses/seed-default");
      showMsg("success", res.message);
      await load();
    } catch (e) { showMsg("error", e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const createEmpty = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ course: Course }>("/api/courses", { name: `New Course ${Date.now()}` });
      await load();
      setSelectedCourse(res.course);
      setView("detail");
      setEditing(true);
    } catch (e) { showMsg("error", e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const generateCourse = async () => {
    if (!genForm.courseName.trim()) { showMsg("error", "Course name is required"); return; }
    setGenerating(true); setGenProgress(0); setGenStatus("Saving course definition...");
    setMsg("");

    // Progress animation
    genIntervalRef.current = setInterval(() => {
      setGenProgress(p => Math.min(p + Math.max(1, (90 - p) * 0.05), 90));
    }, 500);
    const statuses = [
      "Analyzing course topic and target audience...",
      `Planning ${genForm.durationWeeks} weeks of content...`,
      "Generating daily learning objectives...",
      "Adding project activities and GitHub commits...",
      "Finding documentation resources...",
    ];
    let si = 0;
    const statusInterval = setInterval(() => { si = (si + 1) % statuses.length; setGenStatus(statuses[si]); }, 2500);

    try {
      const res = await api.post<{
        course: {
          summary?: string;
          keyFeatures?: string[];
          subjects?: string[];
          weeks: CourseWeek[];
          domain?: string;
          level?: string;
          assessmentType?: string;
          toolsUsed?: string[];
          deliverableTypes?: string[];
        };
      }>(
        "/api/courses/generate",
        genForm,
        300_000 // 5 minutes — course generation can take a while for long courses
      );

      // Create the course with the AI-generated weeks + domain metadata.
      // Pass through ALL fields the AI returned (summary, keyFeatures, subjects,
      // domain, level, tools, etc.) so the course row in the DB matches what
      // the AI generated.
      setGenStatus("Creating course in database...");
      const aiCourse = res.course;
      const createRes = await api.post<{ course: Course }>("/api/courses", {
        name: genForm.courseName.trim(),
        description: genForm.description.trim(),
        // Course-plan-centric overhaul: pass through AI-generated metadata
        summary: aiCourse.summary,
        keyFeatures: aiCourse.keyFeatures,
        subjects: aiCourse.subjects || (genForm.subjects.trim() ? genForm.subjects.split(",").map(s => s.trim()).filter(Boolean) : undefined),
        contentText: genForm.contentText.trim() || undefined,
        weeks: aiCourse.weeks,
        domain: aiCourse.domain,
        level: aiCourse.level,
        assessmentType: aiCourse.assessmentType,
        toolsUsed: aiCourse.toolsUsed,
        deliverableTypes: aiCourse.deliverableTypes,
        // Phase AI-Tutor Revert: pass through per-course NotebookLM URL (empty = use global default)
        notebooklmUrl: genForm.notebooklmUrl.trim() || undefined,
      });

      if (genIntervalRef.current) clearInterval(genIntervalRef.current); clearInterval(statusInterval);
      setGenProgress(100); setGenStatus("Done!");
      showMsg("success", `Course "${genForm.courseName}" generated with ${aiCourse.weeks.length} weeks!`);
      await load();
      setSelectedCourse(createRes.course);
      setView("detail");
      setEditing(true);
    } catch (e) {
      if (genIntervalRef.current) clearInterval(genIntervalRef.current); clearInterval(statusInterval);
      setGenProgress(0); setGenStatus("");
      showMsg("error", e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveCourse = async () => {
    if (!selectedCourse) return;
    setBusy(true); setMsg("");
    try {
      await api.put(`/api/courses/${selectedCourse.id}`, {
        name: selectedCourse.name,
        description: selectedCourse.description,
        weeks: selectedCourse.weeks,
        // Pass through domain metadata so manual edits to these fields persist too
        domain: selectedCourse.domain,
        level: selectedCourse.level,
        assessmentType: selectedCourse.assessmentType,
        // Phase AI-Tutor Revert: persist per-course NotebookLM URL (empty string clears it → null in API)
        notebooklmUrl: selectedCourse.notebooklmUrl ?? null,
        // Scale Tier 2: persist subjects
        subjects: selectedCourse.subjects || [],
        // Project config — pass through so course coordinators can enable/disable
        // the capstone project for this course from the Course Planner UI.
        projectEnabled: !!selectedCourse.projectEnabled,
        projectRequired: !!selectedCourse.projectRequired,
        projectDefaultDurationWeeks: Number(selectedCourse.projectDefaultDurationWeeks ?? 4),
        // Course-plan-centric overhaul: persist AI-generated metadata + teacher
        summary: selectedCourse.summary ?? null,
        keyFeatures: selectedCourse.keyFeatures || [],
        contentText: selectedCourse.contentText ?? null,
        teacherId: selectedCourse.teacherId ?? null,
      }, AI_TIMEOUT_MS);
      showMsg("success", "Course saved.");
      setEditing(false);
      await load();
    } catch (e) { showMsg("error", e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  // Course-plan-centric: assign or unassign a teacher for the selected course.
  // Calls the dedicated /assign-teacher endpoint (validates role=teacher).
  const assignTeacher = async (teacherId: string | null) => {
    if (!selectedCourse) return;
    setBusy(true); setMsg("");
    try {
      const res = await api.post<{ ok: boolean; teacher: TeacherInfo | null }>(
        `/api/courses/${selectedCourse.id}/assign-teacher`,
        { teacherId },
      );
      setSelectedCourse({
        ...selectedCourse,
        teacherId: res.teacher?.id ?? null,
        teacher: res.teacher,
      });
      showMsg("success", res.teacher
        ? `Assigned ${res.teacher.name} as the course teacher.`
        : "Teacher unassigned. Students cannot be enrolled until a teacher is set."
      );
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Failed to assign teacher");
    } finally {
      setBusy(false);
    }
  };

  // Course-plan-centric: publish or unpublish the course plan.
  // Published status locks AI regeneration (enforced on the generate route
  // via the status check). Pre-publish validation requires a teacher + ≥1 week.
  const togglePublish = async () => {
    if (!selectedCourse) return;
    const willPublish = selectedCourse.status !== "published";
    if (willPublish && !confirm(
      "Publishing locks AI regeneration. You can still edit the plan manually.\n\nContinue?"
    )) return;
    setBusy(true); setMsg("");
    try {
      const res = await api.post<{ ok: boolean; status: "draft" | "published" }>(
        `/api/courses/${selectedCourse.id}/publish`,
        { published: willPublish },
      );
      setSelectedCourse({ ...selectedCourse, status: res.status });
      showMsg("success", res.status === "published"
        ? "Course plan published. AI regeneration is now locked. Students can be enrolled."
        : "Course plan reverted to draft. AI regeneration is re-enabled."
      );
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Failed to change publish state");
    } finally {
      setBusy(false);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Delete this course?")) return;
    setBusy(true);
    try {
      await api.del(`/api/courses/${id}`);
      if (selectedCourse?.id === id) { setSelectedCourse(null); setView("list"); }
      await load();
      showMsg("success", "Course deleted.");
    } catch (e) {
      // Handle the 409 "batches still assigned" response from the API.
      // ApiError.body carries the full error JSON, including the list of
      // affected batches so the admin knows what to unassign.
      const assignedBatches = (e instanceof ApiError && e.body?.assignedBatches)
        ? (e.body.assignedBatches as { id: string; name: string }[])
        : [];
      if (assignedBatches.length > 0) {
        const names = (Array.isArray(assignedBatches) ? assignedBatches.map(c => c.name).join(", ") : "");
        const force = confirm(
          `Cannot delete: ${assignedBatches.length} batch(s) are still using this course (${names}).\n\nClick OK to unassign them and delete anyway, or Cancel to keep them assigned.`
        );
        if (force) {
          try {
            await api.del(`/api/courses/${id}?force=true`);
            if (selectedCourse?.id === id) { setSelectedCourse(null); setView("list"); }
            await load();
            showMsg("success", "Course deleted (batches unassigned).");
          } catch (e2) {
            showMsg("error", e2 instanceof Error ? e2.message : "Failed to force-delete");
          }
        }
      } else {
        showMsg("error", e instanceof Error ? e.message : "Failed to delete course");
      }
    } finally { setBusy(false); }
  };

  // Week/day editing
  const addWeek = () => {
    if (!selectedCourse) return;
    const nextWeek = (selectedCourse.weeks.reduce((max, w) => Math.max(max, w.weekNumber), 0)) + 1;
    setSelectedCourse({ ...selectedCourse, weeks: [...selectedCourse.weeks, { weekNumber: nextWeek, phase: `Week ${nextWeek}`, milestone: "", days: [] }] });
    setExpandedWeeks(prev => new Set([...prev, selectedCourse.weeks.length]));
  };
  const deleteWeek = (weekIdx: number) => {
    if (!selectedCourse) return;
    setSelectedCourse({ ...selectedCourse, weeks: selectedCourse.weeks.filter((_, i) => i !== weekIdx) });
  };
  const updateWeek = (weekIdx: number, field: string, value: string) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx] = { ...weeks[weekIdx], [field]: value };
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const addDay = (weekIdx: number) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    const nextDay = (weeks[weekIdx].days.reduce((max, d) => Math.max(max, d.day), 0)) + 1;
    weeks[weekIdx].days.push({ day: nextDay, title: "", objective: "", whyItMatters: "", topicsCovered: [], activity: "", deliverable: "", resources: [] });
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const deleteDay = (weekIdx: number, dayIdx: number) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx].days = weeks[weekIdx].days.filter((_, i) => i !== dayIdx);
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const updateDay = (weekIdx: number, dayIdx: number, field: string, value: unknown) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx].days[dayIdx] = { ...weeks[weekIdx].days[dayIdx], [field]: value };
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const addResource = (weekIdx: number, dayIdx: number) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx].days[dayIdx].resources.push({ label: "", url: "" });
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const updateResource = (weekIdx: number, dayIdx: number, resIdx: number, field: string, value: string) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx].days[dayIdx].resources[resIdx] = { ...weeks[weekIdx].days[dayIdx].resources[resIdx], [field]: value };
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const deleteResource = (weekIdx: number, dayIdx: number, resIdx: number) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx].days[dayIdx].resources = weeks[weekIdx].days[dayIdx].resources.filter((_, i) => i !== resIdx);
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const addTopic = (weekIdx: number, dayIdx: number) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx].days[dayIdx].topicsCovered.push("");
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const updateTopic = (weekIdx: number, dayIdx: number, topicIdx: number, value: string) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx].days[dayIdx].topicsCovered[topicIdx] = value;
    setSelectedCourse({ ...selectedCourse, weeks });
  };
  const deleteTopic = (weekIdx: number, dayIdx: number, topicIdx: number) => {
    if (!selectedCourse) return;
    const weeks = [...selectedCourse.weeks];
    weeks[weekIdx].days[dayIdx].topicsCovered = weeks[weekIdx].days[dayIdx].topicsCovered.filter((_, i) => i !== topicIdx);
    setSelectedCourse({ ...selectedCourse, weeks });
  };

  const assignBatch = async (batchId: string, courseId: string | null) => {
    try {
      // Phase fix: use the api-client (handles errors properly) + the correct
      // PATCH /api/batches/[id] endpoint (was calling /api/batches which doesn't
      // have a PATCH handler — the route is at /api/batches/[id]).
      await api.patch(`/api/batches/${batchId}`, { courseId });
      showMsg("success", courseId ? "Course assigned to batch. Students will now see it." : "Course unassigned from batch.");
      await load();
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Failed to assign batch");
    }
  };

  const toggleWeek = (idx: number) => {
    setExpandedWeeks(prev => {
      const n = new Set(prev);
      if (n.has(idx)) { n.delete(idx); } else { n.add(idx); }
      return n;
    });
  };

  // Phase fix: Fetch the FULL course detail (with days) when a course card is
  // clicked in the list view. The list endpoint returns days: [] for performance,
  // so we need to fetch the full course to show the days in the detail view.
  const openCourseDetail = async (courseId: string, editMode: boolean = false) => {
    try {
      setBusy(true);
      const res = await api.get<{ course: Course }>(`/api/courses/${courseId}`);
      setSelectedCourse(res.course);
      setView("detail");
      setEditing(editMode);
      setExpandedWeeks(new Set([0]));
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Failed to load course detail");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Card><CardContent className="p-6 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;

  // ============ GENERATE VIEW ============
  if (view === "generate") {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setView("list")} className="text-muted-foreground">
            <ArrowLeft /> Back
          </Button>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" /> AI Course Generator
          </h2>
        </div>

        {generating ? (
          <Card className="border-primary/30">
            <CardContent className="p-8 space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                  </div>
                  <svg className="absolute inset-0 h-20 w-20 animate-spin" style={{ animationDuration: "2s" }} viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="60 240" className="text-primary" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-foreground">Generating your course</h3>
                <p className="text-xs text-muted-foreground">{genForm.durationWeeks} weeks × {genForm.daysPerWeek} days = {genForm.durationWeeks * genForm.daysPerWeek} lessons</p>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500" style={{ width: `${genProgress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{Math.round(genProgress)}%</span><span>Please wait...</span>
                </div>
              </div>
              <p className="text-xs text-foreground/70 animate-pulse text-center">{genStatus}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Create a Course with AI</CardTitle>
              <CardDescription className="text-xs">
                Paste your course content (or upload a file). The AI generates a complete plan with
                summary, key features, weekly phases, daily objectives, hands-on activities, and resource links.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Course Name *</Label>
                <Input value={genForm.courseName} onChange={(e) => setGenForm({ ...genForm, courseName: e.target.value })} placeholder="e.g. Python for Data Science, Mobile App Development, UI/UX Design Fundamentals" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Short Description</Label>
                <Textarea value={genForm.description} onChange={(e) => setGenForm({ ...genForm, description: e.target.value })} placeholder="What is this course about? What will students build?" className="bg-background border-border min-h-12 text-xs" />
              </div>
              {/* Content source — paste-or-upload workflow. The AI uses this as
                  the primary source material. When provided, it drives summary,
                  keyFeatures, subjects, and weekly plan. */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    Content Source
                    <span className="text-[10px] text-muted-foreground font-normal">(paste text or upload .txt / .md — optional but recommended)</span>
                  </Label>
                  <label className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-accent">
                    <Upload className="h-3 w-3" /> Upload file
                    <input
                      type="file"
                      accept=".txt,.md,.text,.markdown"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500_000) {
                          showMsg("error", "File too large (max 500 KB). Paste a smaller excerpt instead.");
                          return;
                        }
                        try {
                          const text = await file.text();
                          setGenForm({ ...genForm, contentText: text });
                          showMsg("success", `Loaded ${text.length.toLocaleString()} chars from ${file.name}`);
                        } catch {
                          showMsg("error", "Failed to read file. Try pasting the content directly.");
                        }
                        // Reset input so the same file can be re-selected
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <Textarea
                  value={genForm.contentText}
                  onChange={(e) => setGenForm({ ...genForm, contentText: e.target.value })}
                  placeholder="Paste the course source material here: syllabus, textbook chapter, training manual, blog post — anything. The AI will design a structured course around this content. Leave empty to let the AI generate from scratch using the course name + description."
                  className="bg-background border-border min-h-32 text-xs font-mono"
                />
                {genForm.contentText && (
                  <p className="text-[10px] text-muted-foreground">
                    {genForm.contentText.length.toLocaleString()} chars · The AI will use this as the primary source.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Duration (weeks)</Label>
                  <Input type="number" min={1} max={20} value={genForm.durationWeeks} onChange={(e) => setGenForm({ ...genForm, durationWeeks: Number(e.target.value) })} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Days per week</Label>
                  <Input type="number" min={1} max={7} value={genForm.daysPerWeek} onChange={(e) => setGenForm({ ...genForm, daysPerWeek: Number(e.target.value) })} className="bg-background border-border" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Target Audience</Label>
                <Input value={genForm.targetAudience} onChange={(e) => setGenForm({ ...genForm, targetAudience: e.target.value })} placeholder="e.g. complete beginners, intermediate developers, high school students" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tools & Technologies</Label>
                <Input value={genForm.tools} onChange={(e) => setGenForm({ ...genForm, tools: e.target.value })} placeholder="e.g. Python, Jupyter, Pandas, VS Code, Git" className="bg-background border-border" />
              </div>
              {/* Scale Tier 2: Multiple subjects per course */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  Subjects <span className="text-[10px] text-muted-foreground font-normal">(comma-separated, optional — leave empty to let AI infer)</span>
                </Label>
                <Input
                  value={genForm.subjects}
                  onChange={(e) => setGenForm({ ...genForm, subjects: e.target.value })}
                  placeholder="e.g. Frontend Development, Backend Development, Soft Skills"
                  className="bg-background border-border"
                />
              </div>
              {msg && <p className={`text-xs ${msgType === "error" ? "text-destructive" : "text-primary"}`}>{msg}</p>}
              <Button onClick={generateCourse} disabled={!genForm.courseName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full" size="lg">
                <Sparkles className="h-5 w-5" /> Generate {genForm.durationWeeks * genForm.daysPerWeek} Lessons with AI
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                The AI generates: course summary, key features, subjects, weekly phases, daily topics,
                learning objectives, why-it-matters, hands-on activities, deliverables, and resource links.
                Takes 15-60 seconds.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ============ DETAIL VIEW ============
  if (view === "detail" && selectedCourse) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => { setView("list"); setEditing(false); }} className="text-muted-foreground">
            <ArrowLeft /> Back
          </Button>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 flex-wrap">
            {editing ? "Edit Course" : selectedCourse.name}
            {selectedCourse.isDefault && (
              <Badge variant="outline" className="text-[9px] border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                Default for new students
              </Badge>
            )}
            {selectedCourse.status === "published" ? (
              <Badge variant="outline" className="text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Published
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <Unlock className="h-2.5 w-2.5" /> Draft
              </Badge>
            )}
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Set as default / Unset default — only show when not editing */}
          {!editing && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post(`/api/courses/${selectedCourse.id}/set-default`, { isDefault: !selectedCourse.isDefault });
                  showMsg("success", !selectedCourse.isDefault
                    ? `Set "${selectedCourse.name}" as the default course for new students. The Default Batch is now linked to it.`
                    : `"${selectedCourse.name}" is no longer the default course.`
                  );
                  await load();
                  // Re-fetch the detail to refresh isDefault on selectedCourse
                  const res = await api.get<{ course: Course }>(`/api/courses/${selectedCourse.id}`);
                  setSelectedCourse(res.course);
                } catch (e) {
                  showMsg("error", e instanceof Error ? e.message : "Failed to change default course");
                } finally {
                  setBusy(false);
                }
              }}
              className={selectedCourse.isDefault
                ? "border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                : "border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
              }
              title={selectedCourse.isDefault
                ? "New students are currently being assigned to this course. Click to unset."
                : "Make this the course that new students get assigned to by default."
              }
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {selectedCourse.isDefault ? "Unset Default" : "Set as Default"}
            </Button>
          )}
          {/* Publish / Unpublish toggle — locks or unlocks AI regeneration.
              Only show when not in edit mode (avoid clutter while editing weeks). */}
          {!editing && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={togglePublish}
              className={selectedCourse.status === "published"
                ? "border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
              }
              title={selectedCourse.status === "published"
                ? "Revert to draft. Re-enables AI regeneration."
                : "Publish this course plan. Locks AI regeneration. Students can be enrolled once a teacher is assigned."
              }
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : selectedCourse.status === "published"
                ? <Unlock className="h-3.5 w-3.5" />
                : <Lock className="h-3.5 w-3.5" />
              }
              {selectedCourse.status === "published" ? "Unpublish" : "Publish"}
            </Button>
          )}
          {editing ? (
            <>
              <Button size="sm" onClick={saveCourse} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); load(); }}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="border-border">
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>

        {msg && <p className={`text-xs ${msgType === "error" ? "text-destructive" : "text-primary"}`}>{msg}</p>}

        {/* ============================================================
            TEACHER ASSIGNMENT CARD — Course-plan-centric overhaul.
            A teacher MUST be assigned before any student can be enrolled
            (enforced at the API level via assertCourseHasTeacher).
            ============================================================ */}
        <Card className={`border-border ${!selectedCourse.teacherId ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-primary" /> Course Teacher
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              A teacher must be assigned before students can be enrolled in this course.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            {selectedCourse.teacher ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {selectedCourse.teacher.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{selectedCourse.teacher.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{selectedCourse.teacher.email}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => assignTeacher(null)}
                  className="border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 flex-shrink-0"
                >
                  Unassign
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> No teacher assigned yet
                </p>
                <p className="mt-1 leading-snug">
                  Students cannot be enrolled in this course until a teacher is assigned. Pick one below.
                </p>
              </div>
            )}
            {/* Teacher selector — only show when editing OR when no teacher is assigned.
                Allows quick assignment without entering edit mode. */}
            {(editing || !selectedCourse.teacherId) && (
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Assign a teacher</Label>
                <div className="flex gap-2">
                  <select
                    id="teacher-select"
                    defaultValue=""
                    className="flex-1 bg-background border border-border rounded-md text-xs px-2 py-1.5"
                  >
                    <option value="" disabled>Select a teacher...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} · {t.email}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={busy || teachers.length === 0}
                    onClick={() => {
                      const sel = document.getElementById("teacher-select") as HTMLSelectElement | null;
                      const tid = sel?.value || null;
                      if (tid) assignTeacher(tid);
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCircle className="h-3 w-3" />} Assign
                  </Button>
                </div>
                {teachers.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    No teachers found. Create a user with role=teacher first (Admin → Users).
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================================
            AI-GENERATED COURSE METADATA — summary + key features.
            These come from the AI generate endpoint and surface on the
            student dashboard to give students a mental map of their journey.
            ============================================================ */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Course Overview
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              AI-generated summary + key features. Shown to students on their dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Summary</Label>
              {editing ? (
                <Textarea
                  value={selectedCourse.summary || ""}
                  onChange={(e) => setSelectedCourse({ ...selectedCourse, summary: e.target.value })}
                  placeholder="2-3 sentence course overview. What students will learn + why it matters."
                  className="bg-background border-border text-xs min-h-16"
                />
              ) : (
                <p className="text-xs text-foreground leading-relaxed">
                  {selectedCourse.summary || <span className="text-muted-foreground italic">No summary yet — generate with AI or add manually.</span>}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Key Features</Label>
              {editing ? (
                <>
                  <Textarea
                    value={(selectedCourse.keyFeatures || []).join("\n")}
                    onChange={(e) => setSelectedCourse({
                      ...selectedCourse,
                      keyFeatures: e.target.value.split("\n").map(s => s.trim()).filter(Boolean),
                    })}
                    placeholder={"One feature per line:\nHands-on lab every day\nReal-world case studies\nCapstone project in week 6"}
                    className="bg-background border-border text-xs min-h-20 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">One feature per line. Each will display as a tag.</p>
                </>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(selectedCourse.keyFeatures || []).length > 0 ? (
                    (selectedCourse.keyFeatures || []).map((f, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{f}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No key features yet.</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Course metadata */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Course Name</Label>
              {editing ? (
                <Input value={selectedCourse.name} onChange={(e) => setSelectedCourse({ ...selectedCourse, name: e.target.value })} className="bg-background border-border" />
              ) : <p className="text-sm font-medium text-foreground">{selectedCourse.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              {editing ? (
                <Textarea value={selectedCourse.description} onChange={(e) => setSelectedCourse({ ...selectedCourse, description: e.target.value })} className="bg-background border-border text-xs min-h-12" />
              ) : <p className="text-xs text-muted-foreground">{selectedCourse.description || "No description"}</p>}
            </div>
            {/* Phase AI-Tutor Revert: per-course NotebookLM URL — editable in the detail view */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                NotebookLM URL <span className="text-[9px] text-muted-foreground/70 font-normal">(AI Tutor iframe — empty = global default)</span>
              </Label>
              {editing ? (
                <>
                  <Input
                    value={selectedCourse.notebooklmUrl || ""}
                    onChange={(e) => setSelectedCourse({ ...selectedCourse, notebooklmUrl: e.target.value })}
                    placeholder="https://notebooklm.google.com/notebook/..."
                    className="bg-background border-border text-xs"
                    type="url"
                  />
                  <p className="text-[9px] text-muted-foreground">
                    Students in this course see this notebook in their AI Tutor tab. Clear to use the default bootcamp notebook.
                  </p>
                </>
              ) : (
                <p className="text-xs text-foreground break-all">
                  {selectedCourse.notebooklmUrl || (
                    <span className="text-muted-foreground italic">Not set — using global default notebook</span>
                  )}
                </p>
              )}
            </div>
            {/* Scale Tier 2: Multiple subjects per course */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subjects</Label>
              {editing ? (
                <Input
                  value={(Array.isArray(selectedCourse.subjects) ? selectedCourse.subjects.join(", ") : "")}
                  onChange={(e) => setSelectedCourse({
                    ...selectedCourse,
                    subjects: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                  })}
                  placeholder="Frontend Development, Backend Development, Soft Skills"
                  className="bg-background border-border text-xs"
                />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(selectedCourse.subjects || []).length > 0 ? (
                    (selectedCourse.subjects || []).map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">{s}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Single-subject course</span>
                  )}
                </div>
              )}
            </div>
            {/* Batch assignment */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assigned Batches</Label>
              <div className="flex flex-wrap gap-1.5">
                {batches.map(co => {
                  const assigned = co.courseId === selectedCourse.id;
                  return (
                    <button key={co.id} disabled={!editing} onClick={() => assignBatch(co.id, assigned ? null : selectedCourse.id)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${assigned ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"} ${!editing ? "cursor-default" : "cursor-pointer"}`}>
                      {co.name} {assigned && "✓"}
                    </button>
                  );
                })}
                {batches.length === 0 && <span className="text-[10px] text-muted-foreground">No batches available</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase fix: Warning banner when no batches are assigned — students
            can't see the course until it's assigned to at least one batch.
            Shows a quick-assign button for each available batch. */}
        {selectedCourse.batches && selectedCourse.batches.length === 0 && batches.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    This course isn&apos;t assigned to any batch yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Students won&apos;t see this course in their Course Outline or weekly tests until you assign it to their batch. Click a batch to assign:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {batches.map(co => (
                      <button
                        key={co.id}
                        onClick={() => assignBatch(co.id, selectedCourse.id)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Assign to {co.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================================
            PROJECT CONFIGURATION CARD
            Controls whether students in this course get the capstone
            project feature at all, whether it's required, and the
            default duration suggested to them.
            - Project can only be enabled when the course has >= 4 weeks.
            - Default duration is bounded [2, courseWeeks - 1].
            ============================================================ */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Capstone Project
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Decide whether students in this course build a capstone project.
              {selectedCourse.weeks.length < 4 ? (
                <span className="block mt-1 text-amber-600">
                  Projects require a minimum of 4 weeks. This course has {selectedCourse.weeks.length} week{selectedCourse.weeks.length === 1 ? "" : "s"} — add more weeks to enable.
                </span>
              ) : (
                <span className="block mt-0.5">Available project duration: 2 to {Math.max(2, selectedCourse.weeks.length - 1)} weeks (course weeks − 1).</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            {/* Project enabled toggle */}
            <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/50 p-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Enable capstone project</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  When ON, students see the Project tab, can define a capstone project, and get AI-generated weekly tasks.
                  When OFF, the Project nav item, banners, and project forms are hidden entirely.
                </p>
              </div>
              {editing ? (
                <button
                  type="button"
                  disabled={selectedCourse.weeks.length < 4}
                  onClick={() => setSelectedCourse({
                    ...selectedCourse,
                    projectEnabled: !selectedCourse.projectEnabled,
                    // Auto-disable projectRequired when projectEnabled is turned off
                    projectRequired: !selectedCourse.projectEnabled ? false : selectedCourse.projectRequired,
                  })}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                    selectedCourse.projectEnabled ? "bg-primary" : "bg-muted"
                  } ${selectedCourse.weeks.length < 4 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  aria-pressed={selectedCourse.projectEnabled}
                  aria-label="Toggle capstone project"
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${selectedCourse.projectEnabled ? "translate-x-4" : "translate-x-1"}`} />
                </button>
              ) : (
                <Badge variant={selectedCourse.projectEnabled ? "default" : "secondary"} className={selectedCourse.projectEnabled ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : ""}>
                  {selectedCourse.projectEnabled ? "Enabled" : "Disabled"}
                </Badge>
              )}
            </div>

            {/* Project required toggle (only when enabled) */}
            {selectedCourse.projectEnabled && (
              <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/50 p-3 animate-fade-in-up">
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">Project is required</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    When ON, students see a &quot;Required&quot; badge and the alert system treats missing project tasks as attention-worthy.
                    When OFF, the project is optional and students won&apos;t be nudged about project inactivity.
                  </p>
                </div>
                {editing ? (
                  <button
                    type="button"
                    onClick={() => setSelectedCourse({ ...selectedCourse, projectRequired: !selectedCourse.projectRequired })}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      selectedCourse.projectRequired ? "bg-primary" : "bg-muted"
                    }`}
                    aria-pressed={selectedCourse.projectRequired}
                    aria-label="Toggle project required"
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${selectedCourse.projectRequired ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                ) : (
                  <Badge variant={selectedCourse.projectRequired ? "default" : "secondary"} className={selectedCourse.projectRequired ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : ""}>
                    {selectedCourse.projectRequired ? "Required" : "Optional"}
                  </Badge>
                )}
              </div>
            )}

            {/* Default project duration dropdown (only when enabled) */}
            {selectedCourse.projectEnabled && (
              <div className="rounded-md border border-border bg-background/50 p-3 space-y-2 animate-fade-in-up">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">Default project duration</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Pre-selected when a student sets up their project. Students can still pick any value from 2 to {Math.max(2, selectedCourse.weeks.length - 1)} weeks.
                    </p>
                  </div>
                </div>
                {editing ? (
                  <select
                    value={String(selectedCourse.projectDefaultDurationWeeks ?? 4)}
                    onChange={(e) => setSelectedCourse({ ...selectedCourse, projectDefaultDurationWeeks: Number(e.target.value) })}
                    className="bg-background border border-border rounded-md text-xs px-2 py-1.5 w-full"
                  >
                    {Array.from({ length: Math.max(0, selectedCourse.weeks.length - 2) }, (_, i) => i + 2).map(w => (
                      <option key={w} value={String(w)}>{w} week{w === 1 ? "" : "s"}</option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {selectedCourse.projectDefaultDurationWeeks ?? 4} week{(selectedCourse.projectDefaultDurationWeeks ?? 4) === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
            )}

            {/* Teacher / student instructions */}
            {selectedCourse.projectEnabled && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-[10px] text-foreground/80 leading-relaxed">
                <p className="font-semibold text-foreground mb-1">What students will see:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>A <strong>Project</strong> tab in their sidebar (between <em>Study</em> and <em>Progress</em>).</li>
                  <li>A project setup form with name, scope, objectives, requirements, and duration (2 to {Math.max(2, selectedCourse.weeks.length - 1)} weeks).</li>
                  <li>AI-generated weekly project tasks + milestones once they save their project definition.</li>
                  <li>{selectedCourse.projectRequired ? "Project is <strong>required</strong> — the alert system will message students who don't set up a project." : "Project is <strong>optional</strong> — students won't be nudged about project inactivity."}</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weeks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Weekly Plan ({selectedCourse.weeks.length} weeks, {selectedCourse.weeks.reduce((a, w) => a + w.days.length, 0)} days)</h3>
            {editing && <Button size="sm" variant="outline" onClick={addWeek} className="border-border h-7 text-xs"><Plus className="h-3 w-3" /> Add Week</Button>}
          </div>

          {selectedCourse.weeks.map((w, weekIdx) => {
            const isExpanded = expandedWeeks.has(weekIdx) || editing;
            return (
              <Card key={weekIdx} className={`border-border ${isExpanded ? "" : "hover:shadow-sm"} transition-shadow`}>
                {/* Week header */}
                <div className={`p-3 flex items-center gap-2 ${isExpanded ? "border-b border-border" : ""} ${!editing ? "cursor-pointer" : ""}`}
                  onClick={() => !editing && toggleWeek(weekIdx)}>
                  {!editing && (isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                  <Badge variant="outline" className="text-[9px] text-primary border-primary/30">Week {w.weekNumber}</Badge>
                  {editing ? (
                    <Input value={w.phase} onChange={(e) => updateWeek(weekIdx, "phase", e.target.value)} className="bg-background border-border h-7 text-xs flex-1" placeholder="Phase name..." />
                  ) : (
                    <p className="text-xs font-medium text-foreground flex-1 truncate">{w.phase}</p>
                  )}
                  <Badge variant="outline" className="text-[8px] text-muted-foreground">{w.days.length} days</Badge>
                  {editing && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteWeek(weekIdx); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Expanded content */}
                {(isExpanded) && (
                  <div className="p-3 space-y-2">
                    {/* Milestone */}
                    {editing && (
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Milestone</Label>
                        <Input value={w.milestone} onChange={(e) => updateWeek(weekIdx, "milestone", e.target.value)} className="bg-background border-border h-7 text-xs" placeholder="e.g. Project selected · GitHub repo created" />
                      </div>
                    )}
                    {!editing && w.milestone && <p className="text-[10px] text-muted-foreground italic">🎯 {w.milestone}</p>}

                    {/* Days */}
                    {w.days.map((d, dayIdx) => (
                      <div key={dayIdx} className={`rounded-md border ${d.activity ? "border-primary/20 bg-primary/5" : "border-border bg-background/50"} p-2.5 space-y-2`}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] text-cyan-600 border-cyan-500/30">Day {d.day}</Badge>
                          {editing ? (
                            <Input value={d.title} onChange={(e) => updateDay(weekIdx, dayIdx, "title", e.target.value)} className="bg-background border-border h-7 text-xs flex-1" placeholder="Topic title..." />
                          ) : (
                            <p className="text-xs font-medium text-foreground flex-1">{d.title || "(no title)"}</p>
                          )}
                          {editing && <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => deleteDay(weekIdx, dayIdx)}><Trash2 className="h-2.5 w-2.5" /></Button>}
                        </div>

                        {/* Objective */}
                        {(editing || d.objective) && (
                          <div className="pl-4">
                            {editing ? (
                              <><Label className="text-[8px] text-muted-foreground">Learning Objective</Label><Input value={d.objective} onChange={(e) => updateDay(weekIdx, dayIdx, "objective", e.target.value)} className="bg-background border-border h-6 text-[10px] mt-0.5" placeholder="What will students be able to DO?" /></>
                            ) : (
                              <p className="text-[10px] text-muted-foreground"><strong className="text-foreground/70">Objective:</strong> {d.objective}</p>
                            )}
                          </div>
                        )}

                        {/* Why it matters */}
                        {(editing || d.whyItMatters) && (
                          <div className="pl-4">
                            {editing ? (
                              <><Label className="text-[8px] text-muted-foreground">Why It Matters</Label><Input value={d.whyItMatters} onChange={(e) => updateDay(weekIdx, dayIdx, "whyItMatters", e.target.value)} className="bg-background border-border h-6 text-[10px] mt-0.5" placeholder="Why does this skill matter?" /></>
                            ) : (
                              <p className="text-[10px] text-muted-foreground"><strong className="text-foreground/70">Why:</strong> {d.whyItMatters}</p>
                            )}
                          </div>
                        )}

                        {/* Topics covered */}
                        {(editing || d.topicsCovered.length > 0) && (
                          <div className="pl-4 space-y-1">
                            <Label className="text-[8px] text-muted-foreground">Topics Covered</Label>
                            <div className="flex flex-wrap gap-1">
                              {d.topicsCovered.map((t, topicIdx) => (
                                editing ? (
                                  <span key={topicIdx} className="inline-flex items-center gap-0.5">
                                    <Input value={t} onChange={(e) => updateTopic(weekIdx, dayIdx, topicIdx, e.target.value)} className="bg-background border-border h-5 text-[9px] w-28" />
                                    <button onClick={() => deleteTopic(weekIdx, dayIdx, topicIdx)} className="text-destructive"><X className="h-2.5 w-2.5" /></button>
                                  </span>
                                ) : (
                                  <Badge key={topicIdx} variant="secondary" className="text-[8px] bg-muted">{t}</Badge>
                                )
                              ))}
                              {editing && <button onClick={() => addTopic(weekIdx, dayIdx)} className="text-[9px] text-primary hover:underline"><Plus className="h-2.5 w-2.5 inline" /> Add</button>}
                            </div>
                          </div>
                        )}

                        {/* Activity — what the student does today (hands-on) */}
                        {(editing || d.activity) && (
                          <div className="pl-4">
                            {editing ? (
                              <><Label className="text-[8px] text-muted-foreground">Activity (what students DO today)</Label><Input value={d.activity} onChange={(e) => updateDay(weekIdx, dayIdx, "activity", e.target.value)} className="bg-background border-border h-6 text-[10px] mt-0.5" placeholder="e.g. Build a homepage layout, write a lab report, analyze a case study" /></>
                            ) : (
                              <p className="text-[10px] text-primary"><strong>🔧 Activity:</strong> {d.activity}</p>
                            )}
                          </div>
                        )}

                        {/* Deliverable — what the student produces/submits */}
                        {(editing || d.deliverable) && (
                          <div className="pl-4">
                            {editing ? (
                              <><Label className="text-[8px] text-muted-foreground">Deliverable (what students submit)</Label><Input value={d.deliverable} onChange={(e) => updateDay(weekIdx, dayIdx, "deliverable", e.target.value)} className="bg-background border-border h-6 text-[10px] mt-0.5 font-mono" placeholder="e.g. code commit, lab report, presentation, CAD drawing, essay" /></>
                            ) : (
                              <p className="text-[10px] text-muted-foreground font-mono"><strong>📦 Deliverable:</strong> {d.deliverable}</p>
                            )}
                          </div>
                        )}

                        {/* Resources */}
                        {(editing || d.resources.length > 0) && (
                          <div className="pl-4 space-y-1">
                            <Label className="text-[8px] text-muted-foreground">Resources</Label>
                            {d.resources.map((r, resIdx) => (
                              <div key={resIdx} className="flex items-center gap-1.5">
                                {editing ? (
                                  <>
                                    <Input value={r.label} onChange={(e) => updateResource(weekIdx, dayIdx, resIdx, "label", e.target.value)} className="bg-background border-border h-5 text-[9px] w-24" placeholder="Label" />
                                    <Input value={r.url} onChange={(e) => updateResource(weekIdx, dayIdx, resIdx, "url", e.target.value)} className="bg-background border-border h-5 text-[9px] flex-1" placeholder="URL" />
                                    <button onClick={() => deleteResource(weekIdx, dayIdx, resIdx)} className="text-destructive"><X className="h-2.5 w-2.5" /></button>
                                  </>
                                ) : (
                                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate flex items-center gap-0.5">
                                    <ExternalLink className="h-2.5 w-2.5" /> {r.label || r.url}
                                  </a>
                                )}
                              </div>
                            ))}
                            {editing && <button onClick={() => addResource(weekIdx, dayIdx)} className="text-[9px] text-primary hover:underline"><Plus className="h-2.5 w-2.5 inline" /> Add resource</button>}
                          </div>
                        )}
                      </div>
                    ))}
                    {editing && <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground" onClick={() => addDay(weekIdx)}><Plus className="h-3 w-3" /> Add day</Button>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ============ LIST VIEW (default) ============
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Course Planner
          </h2>
          <p className="text-xs text-muted-foreground">Create courses with AI, edit weekly plans, assign to batches.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={seedDefault} disabled={busy} className="border-border">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Seed Default
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("generate")} className="border-primary/30 text-primary hover:bg-primary/10">
            <Wand2 className="h-3.5 w-3.5" /> Generate with AI
          </Button>
          <Button size="sm" onClick={createEmpty} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> New Course
          </Button>
        </div>
      </div>

      {msg && <p className={`text-xs ${msgType === "error" ? "text-destructive" : "text-primary"}`}>{msg}</p>}

      {courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No courses yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              <strong>Generate with AI</strong> — describe your course and the AI creates a full outline with daily objectives, project activities, and resource links.
              <br />Or <strong>Seed Default</strong> to create the standard 6-week bootcamp.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {courses.map(c => (
            <Card key={c.id} className="border-border bg-card hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2" onClick={() => openCourseDetail(c.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                      {c.name}
                      {c.isDefault && (
                        <Badge variant="outline" className="text-[8px] border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                          Default
                        </Badge>
                      )}
                      {c.status === "published" ? (
                        <Badge variant="outline" className="text-[8px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          Draft
                        </Badge>
                      )}
                    </CardTitle>
                    {c.summary ? (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{c.summary}</p>
                    ) : c.description ? (
                      <CardDescription className="text-xs text-muted-foreground truncate">{c.description}</CardDescription>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1 items-end ml-2">
                    <Badge variant="outline" className="text-[9px]">{(c.weeks?.length || 0)}w · {(c.weeks?.reduce((a, w) => a + (w.dayCount || w.days?.length || 0), 0) || 0)}d</Badge>
                    {c.projectEnabled && (
                      <Badge variant="outline" className={`text-[8px] ${c.projectRequired ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                        {c.projectRequired ? "Project Required" : "Project Optional"}
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Teacher info row — shows "No teacher" warning in amber */}
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                  {c.teacher ? (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <UserCircle className="h-3 w-3" /> {c.teacher.name}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                      <AlertCircle className="h-3 w-3" /> No teacher assigned
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {c.batches?.length > 0 ? c.batches.map(co => (
                      <Badge key={co.id} variant="secondary" className="text-[8px] bg-primary/10 text-primary">{co.name}</Badge>
                    )) : <span className="text-[10px] text-muted-foreground">No batches assigned</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); openCourseDetail(c.id, true); }}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteCourse(c.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrowLeft({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
}
