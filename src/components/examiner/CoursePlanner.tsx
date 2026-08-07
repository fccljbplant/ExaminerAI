"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Plus, Trash2, Save, BookOpen, ChevronDown, ChevronRight,
  RefreshCw, GraduationCap, Edit3, X, Sparkles, Wand2, ExternalLink,
  CheckCircle2, Circle, AlertCircle, Copy, ClipboardList, Store,
  ClipboardPaste, FileText,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import CourseThumbnailPicker from "./CourseThumbnailPicker";
import CourseCreationWizard from "./CourseCreationWizard";

interface CourseDay {
  id?: string; day: number; title: string; objective: string;
  whyItMatters: string; topicsCovered: string[]; activity: string;
  deliverable: string; resources: { label: string; url: string }[];
}
interface CourseWeek {
  id?: string; weekNumber: number; phase: string; milestone: string; days: CourseDay[]; dayCount?: number;
}
interface Course {
  id: string; name: string; description: string; isActive: boolean;
  domain?: string; level?: string; assessmentType?: string;
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
  // Marketplace fields (Phase 6) — control whether/how this course appears on
  // the public /courses marketplace.
  published?: boolean;
  featured?: boolean;
  price?: number;
  category?: string;
  subtitle?: string | null;
  instructorName?: string | null;
  instructorBio?: string | null;
  thumbnailUrl?: string | null;
  durationWeeks?: number;
}
interface Batch { id: string; name: string; courseId: string | null; courseName: string | null; }

type View = "list" | "generate" | "detail";

// Marketplace category options — mirror of MARKETPLACE_CATEGORIES from
// src/lib/marketplace.ts. Inlined here (rather than imported) because the
// marketplace lib pulls in Prisma (`db`) and cannot run in the browser.
//
// Domain-agnostic — covers all professional training domains, not just IT.
const COURSE_MARKETPLACE_CATEGORIES: { value: string; label: string }[] = [
  { value: "technology", label: "Technology & Software" },
  { value: "engineering", label: "Engineering" },
  { value: "business", label: "Business & Management" },
  { value: "finance", label: "Finance & Accounting" },
  { value: "healthcare", label: "Healthcare & Safety" },
  { value: "manufacturing", label: "Manufacturing & Operations" },
  { value: "hr", label: "Human Resources" },
  { value: "compliance", label: "Compliance & Regulatory" },
  { value: "soft-skills", label: "Professional Skills" },
  { value: "other", label: "Other" },
];

export default function CoursePlanner() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // AI generation form state
  const [genForm, setGenForm] = useState({
    courseName: "", description: "", durationWeeks: 6, daysPerWeek: 5,
    targetAudience: "complete beginners", tools: "", aiProvider: "Gemini API (free for students)",
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

  // CourseCreationWizard dialog state — opens when the user clicks
  // "Create New Course (Wizard)" in the list view's header.
  const [wizardOpen, setWizardOpen] = useState(false);

  // Convert-outline dialog state — opens when the user clicks
  // "Convert Outline" in the detail view's Weekly Plan header. Lets the
  // instructor paste a raw outline (Word doc / syllabus / PDF text / TOC)
  // and replace the existing curriculum with the AI-converted version.
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertText, setConvertText] = useState("");
  const [convertPreview, setConvertPreview] = useState<CourseWeek[] | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertStatus, setConvertStatus] = useState("");
  const [convertError, setConvertError] = useState("");
  const convertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const convertStatusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (convertIntervalRef.current) clearInterval(convertIntervalRef.current);
      if (convertStatusIntervalRef.current) clearInterval(convertStatusIntervalRef.current);
    };
  }, []);

  // ---------------- Convert a pasted outline (existing course) ----------------
  // Opens the convert dialog from the detail view's Weekly Plan header.
  const openConvertDialog = () => {
    setConvertOpen(true);
    setConvertText("");
    setConvertPreview(null);
    setConvertProgress(0);
    setConvertStatus("");
    setConvertError("");
  };

  const closeConvertDialog = () => {
    if (convertIntervalRef.current) clearInterval(convertIntervalRef.current);
    if (convertStatusIntervalRef.current) clearInterval(convertStatusIntervalRef.current);
    setConvertOpen(false);
    setConvertText("");
    setConvertPreview(null);
    setConverting(false);
    setConvertProgress(0);
    setConvertStatus("");
    setConvertError("");
  };

  // Run the AI conversion: POST /api/courses/convert-outline with the
  // pasted text + the selected course's metadata (name, category, level,
  // durationWeeks).
  const runConvert = async () => {
    if (!selectedCourse) return;
    if (!convertText.trim()) {
      setConvertError("Please paste your course outline text first.");
      return;
    }
    setConverting(true);
    setConvertError("");
    setConvertProgress(0);
    setConvertStatus("Reading your outline…");

    convertIntervalRef.current = setInterval(() => {
      setConvertProgress(p => Math.min(p + Math.max(1, (90 - p) * 0.05), 90));
    }, 500);
    const statuses = [
      "Reading your outline…",
      "Reorganizing into weeks and days…",
      "Enhancing objectives and activities…",
      "Adding deliverables and reflections…",
      "Finding real resource links…",
    ];
    let si = 0;
    convertStatusIntervalRef.current = setInterval(() => {
      si = (si + 1) % statuses.length;
      setConvertStatus(statuses[si]);
    }, 2500);

    try {
      const res = await api.post<{ weeks: CourseWeek[] }>(
        "/api/courses/convert-outline",
        {
          outline: convertText.trim(),
          courseName: selectedCourse.name,
          category: selectedCourse.category ?? selectedCourse.domain ?? "technology",
          level: selectedCourse.level ?? "beginner",
          durationWeeks: selectedCourse.durationWeeks ?? selectedCourse.weeks.length ?? 6,
          daysPerWeek: 5,
        },
        300_000, // 5 min — large outlines can take a while
      );
      if (convertIntervalRef.current) clearInterval(convertIntervalRef.current);
      if (convertStatusIntervalRef.current) clearInterval(convertStatusIntervalRef.current);
      setConvertProgress(100);
      setConvertStatus("Done!");
      setConvertPreview(res.weeks);
    } catch (e) {
      if (convertIntervalRef.current) clearInterval(convertIntervalRef.current);
      if (convertStatusIntervalRef.current) clearInterval(convertStatusIntervalRef.current);
      setConvertProgress(0);
      setConvertStatus("");
      setConvertError(e instanceof Error ? e.message : "AI conversion failed. Please try again.");
    } finally {
      setConverting(false);
    }
  };

  // Replace the current course's outline with the converted preview by
  // calling PUT /api/courses/[id] with the new weeks array. The PUT
  // endpoint does a full replace (deletes old weeks + days, creates new).
  const applyConvertedOutline = async () => {
    if (!selectedCourse || !convertPreview || convertPreview.length === 0) return;
    setBusy(true);
    setConvertError("");
    try {
      await api.put(
        `/api/courses/${selectedCourse.id}`,
        { weeks: convertPreview },
        AI_TIMEOUT_MS,
      );
      showMsg(
        "success",
        `Outline replaced with ${convertPreview.length} weeks · ${convertPreview.reduce((a, w) => a + w.days.length, 0)} days.`,
      );
      closeConvertDialog();
      // Re-fetch the full course detail so the new weeks/days render.
      const res = await api.get<{ course: Course }>(`/api/courses/${selectedCourse.id}`);
      setSelectedCourse(res.course);
      setExpandedWeeks(new Set([0]));
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : "Failed to replace outline.");
    } finally {
      setBusy(false);
    }
  };

  const load = useCallback(async () => {
    try {
      // Fix: /api/batches no longer exists (replaced by CourseEnrollment).
      // Only fetch courses — batches/cohorts are managed via the enrollment system.
      const courseRes = await api.get<{ courses: Course[] }>("/api/courses", undefined, AI_TIMEOUT_MS);
      setCourses(courseRes.courses || []);
      setBatches([]);
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
    if (type === "success") toast.success(text);
    else toast.error(text);
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
      // Pass through ALL fields the AI returned (domain, level, tools, etc.)
      // so the course row in the DB matches what the AI generated.
      setGenStatus("Creating course in database...");
      const aiCourse = res.course;
      const createRes = await api.post<{ course: Course }>("/api/courses", {
        name: genForm.courseName.trim(),
        description: genForm.description.trim(),
        weeks: aiCourse.weeks,
        domain: aiCourse.domain,
        level: aiCourse.level,
        assessmentType: aiCourse.assessmentType,
        toolsUsed: aiCourse.toolsUsed,
        deliverableTypes: aiCourse.deliverableTypes,
        // Scale Tier 2: parse comma-separated subjects into array
        subjects: genForm.subjects.trim() ? genForm.subjects.split(",").map(s => s.trim()).filter(Boolean) : undefined,
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
    setBusy(true);
    try {
      await api.put(`/api/courses/${selectedCourse.id}`, {
        name: selectedCourse.name,
        description: selectedCourse.description,
        weeks: selectedCourse.weeks,
        // Pass through domain metadata so manual edits to these fields persist too
        domain: selectedCourse.domain,
        level: selectedCourse.level,
        assessmentType: selectedCourse.assessmentType,
        // Scale Tier 2: persist subjects
        subjects: selectedCourse.subjects || [],
        // Project config — pass through so course coordinators can enable/disable
        // the capstone project for this course from the Course Planner UI.
        projectEnabled: !!selectedCourse.projectEnabled,
        projectRequired: !!selectedCourse.projectRequired,
        projectDefaultDurationWeeks: Number(selectedCourse.projectDefaultDurationWeeks ?? 4),
        // Phase 6 — marketplace fields. Pass these through so the publish
        // toggle + marketing metadata save from this UI. The PUT endpoint
        // accepts them as optional fields (only updates when provided).
        published: !!selectedCourse.published,
        featured: !!selectedCourse.featured,
        price: Number(selectedCourse.price ?? 0),
        category: selectedCourse.category ?? "technology",
        subtitle: selectedCourse.subtitle ?? "",
        instructorName: selectedCourse.instructorName ?? "",
        instructorBio: selectedCourse.instructorBio ?? "",
        thumbnailUrl: selectedCourse.thumbnailUrl ?? null,
        durationWeeks: Number(selectedCourse.durationWeeks ?? 6),
      }, AI_TIMEOUT_MS);
      showMsg("success", "Course saved.");
      setEditing(false);
      await load();
    } catch (e) { showMsg("error", e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
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
            showMsg("success", "Course deleted (classes unassigned).");
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
      showMsg("success", courseId ? "Course assigned to class. Students will now see it." : "Course unassigned from class.");
      await load();
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Failed to assign class");
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
    setView("list");
    return null;
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
              <CardDescription className="text-xs">Describe your course and the AI will generate a complete structured outline with daily objectives, project activities, GitHub commits, and resource links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Course Name *</Label>
                <Input value={genForm.courseName} onChange={(e) => setGenForm({ ...genForm, courseName: e.target.value })} placeholder="e.g. Python for Data Science, Mobile App Development, UI/UX Design Fundamentals" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Description</Label>
                <Textarea value={genForm.description} onChange={(e) => setGenForm({ ...genForm, description: e.target.value })} placeholder="What is this course about? What will students build?" className="bg-background border-border min-h-16 text-xs" />
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">AI Provider (for AI features in the course)</Label>
                <Input value={genForm.aiProvider} onChange={(e) => setGenForm({ ...genForm, aiProvider: e.target.value })} placeholder="e.g. Gemini API (free for students), OpenAI API" className="bg-background border-border" />
              </div>
              {/* Scale Tier 2: Multiple subjects per course */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  Subjects <span className="text-[10px] text-muted-foreground font-normal">(comma-separated, optional — for multi-subject courses)</span>
                </Label>
                <Input
                  value={genForm.subjects}
                  onChange={(e) => setGenForm({ ...genForm, subjects: e.target.value })}
                  placeholder="e.g. Frontend Development, Backend Development, Soft Skills"
                  className="bg-background border-border"
                />
                <p className="text-[10px] text-muted-foreground">
                  For multi-subject courses (e.g. a bootcamp with frontend + backend + soft skills running in parallel).
                  Leave empty for single-subject courses.
                </p>
              </div>
              <Button onClick={generateCourse} disabled={!genForm.courseName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full" size="lg">
                <Sparkles className="h-5 w-5" /> Generate {genForm.durationWeeks * genForm.daysPerWeek} Lessons with AI
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">The AI generates: weekly phases, daily topics, learning objectives, why-it-matters, project activities, GitHub commits, and resource links. This takes 15-60 seconds.</p>
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
        <div className="flex items-center justify-between sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border py-2 px-1 -mx-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => { setView("list"); setEditing(false); }} className="text-muted-foreground">
              <ArrowLeft /> Back
            </Button>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 flex-wrap">
              {editing ? "Edit Course" : selectedCourse.name}
              {selectedCourse.isDefault && (
                <Badge variant="outline" className="text-[10px] border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                  Default for new students
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
                      <Badge key={i} variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{s}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Single-subject course</span>
                  )}
                </div>
              )}
            </div>
            {/* Cohort assignment — hidden when no cohorts exist (batches model was removed) */}
            {batches.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assigned Cohorts</Label>
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
                {batches.length === 0 && <span className="text-[10px] text-muted-foreground">No cohorts available</span>}
              </div>
            </div>
            )}
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

        {/* ============================================================
            MARKETPLACE SETTINGS CARD (Phase 6)
            Controls whether this course appears on the public /courses
            marketplace, plus the marketing metadata (price, category,
            subtitle, instructor name, duration) shown on the public
            course detail page. These fields are saved via the existing
            PUT /api/courses/[id] endpoint (which now accepts them as
            optional fields). Auth required — admin/teacher only (the
            CoursePlanner itself is gated by role).
            ============================================================ */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Marketplace Settings
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Publish this course to the public marketplace and configure how it appears to prospective students.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            {/* Published toggle */}
            <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/50 p-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Publish to marketplace</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  When ON, this course appears on <code className="text-[10px] bg-muted px-1 py-0.5 rounded">/courses</code> and is fetchable via the public marketplace API. When OFF, only enrolled students and staff can see it.
                </p>
              </div>
              {editing ? (
                <Switch
                  checked={!!selectedCourse.published}
                  onCheckedChange={(checked) => setSelectedCourse({ ...selectedCourse, published: checked })}
                  aria-label="Publish to marketplace"
                />
              ) : (
                <Badge variant={selectedCourse.published ? "default" : "secondary"} className={selectedCourse.published ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : ""}>
                  {selectedCourse.published ? "Published" : "Draft"}
                </Badge>
              )}
            </div>

            {/* Featured toggle */}
            <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/50 p-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Feature on homepage</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  When ON, this course is sorted to the top of the marketplace and shows a &quot;Featured&quot; badge. Requires &quot;Publish to marketplace&quot; to be ON.
                </p>
              </div>
              {editing ? (
                <Switch
                  checked={!!selectedCourse.featured}
                  onCheckedChange={(checked) => setSelectedCourse({ ...selectedCourse, featured: checked })}
                  disabled={!selectedCourse.published}
                  aria-label="Feature on homepage"
                />
              ) : (
                <Badge variant={selectedCourse.featured ? "default" : "secondary"} className={selectedCourse.featured ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : ""}>
                  {selectedCourse.featured ? "Featured" : "Not featured"}
                </Badge>
              )}
            </div>

            {/* Price + Duration row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Price (USD)</Label>
                {editing ? (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={selectedCourse.price ?? 0}
                    onChange={(e) => setSelectedCourse({ ...selectedCourse, price: Number(e.target.value) })}
                    className="bg-background border-border h-8 text-xs"
                  />
                ) : (
                  <p className="text-xs font-medium text-foreground">
                    {(selectedCourse.price ?? 0) === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                    ) : (
                      formatPrice(selectedCourse.price ?? 0, "USD")
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Duration (weeks)</Label>
                {editing ? (
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    value={selectedCourse.durationWeeks ?? 6}
                    onChange={(e) => setSelectedCourse({ ...selectedCourse, durationWeeks: Number(e.target.value) })}
                    className="bg-background border-border h-8 text-xs"
                  />
                ) : (
                  <p className="text-xs font-medium text-foreground">{selectedCourse.durationWeeks ?? 6} weeks</p>
                )}
              </div>
            </div>

            {/* Category select */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              {editing ? (
                <Select
                  value={selectedCourse.category ?? "technology"}
                  onValueChange={(value) => setSelectedCourse({ ...selectedCourse, category: value })}
                >
                  <SelectTrigger className="bg-background border-border h-8 text-xs w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSE_MARKETPLACE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="capitalize text-[10px]">
                  {(selectedCourse.category ?? "technology").replace("-", " ")}
                </Badge>
              )}
            </div>

            {/* Marketing subtitle */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Marketing subtitle</Label>
              {editing ? (
                <Input
                  value={selectedCourse.subtitle ?? ""}
                  onChange={(e) => setSelectedCourse({ ...selectedCourse, subtitle: e.target.value })}
                  placeholder="e.g. Build production apps with React, TypeScript, and AI APIs"
                  className="bg-background border-border h-8 text-xs"
                />
              ) : (
                <p className="text-xs text-muted-foreground">{selectedCourse.subtitle || "—"}</p>
              )}
            </div>

            {/* Instructor display name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Instructor display name</Label>
              {editing ? (
                <Input
                  value={selectedCourse.instructorName ?? ""}
                  onChange={(e) => setSelectedCourse({ ...selectedCourse, instructorName: e.target.value })}
                  placeholder="e.g. Dr. Amira Haddad"
                  className="bg-background border-border h-8 text-xs"
                />
              ) : (
                <p className="text-xs text-muted-foreground">{selectedCourse.instructorName || "—"}</p>
              )}
            </div>

            {/* Instructor bio */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Instructor bio</Label>
              {editing ? (
                <Textarea
                  value={selectedCourse.instructorBio ?? ""}
                  onChange={(e) => setSelectedCourse({ ...selectedCourse, instructorBio: e.target.value })}
                  placeholder="Short professional bio — credentials, experience, teaching style."
                  className="bg-background border-border text-xs min-h-[70px]"
                />
              ) : (
                <p className="text-xs text-muted-foreground whitespace-pre-line">
                  {selectedCourse.instructorBio || "—"}
                </p>
              )}
            </div>

            {/* Course thumbnail picker — Unsplash + upload + AI */}
            <CourseThumbnailPicker
              currentUrl={selectedCourse.thumbnailUrl ?? null}
              courseName={selectedCourse.name}
              category={selectedCourse.category ?? "technology"}
              onSelect={(url) => setSelectedCourse({
                ...selectedCourse,
                thumbnailUrl: url || null,
              })}
            />

            {/* Public preview link */}
            {selectedCourse.published && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-[10px] text-foreground/80 leading-relaxed">
                <p className="font-semibold text-foreground mb-0.5">This course is live on the marketplace:</p>
                <a
                  href={`/courses/${selectedCourse.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-2.5 w-2.5" /> View public course page
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weeks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-foreground">Weekly Plan ({selectedCourse.weeks.length} weeks, {selectedCourse.weeks.reduce((a, w) => a + w.days.length, 0)} days)</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={openConvertDialog}
                disabled={busy}
                className="border-primary/30 text-primary hover:bg-primary/10"
                title="Paste a raw outline (Word doc, syllabus, PDF text, TOC) and let the AI convert it into a structured course. Replaces the current weekly plan."
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Convert Outline
              </Button>
              {editing && <Button size="sm" variant="outline" onClick={addWeek} className="border-border h-7 text-xs"><Plus className="h-3 w-3" /> Add Week</Button>}
            </div>
          </div>

          {selectedCourse.weeks.map((w, weekIdx) => {
            const isExpanded = expandedWeeks.has(weekIdx) || editing;
            return (
              <Card key={weekIdx} className={`border-border ${isExpanded ? "" : "hover:shadow-sm"} transition-shadow`}>
                {/* Week header */}
                <div className={`p-3 flex items-center gap-2 ${isExpanded ? "border-b border-border" : ""} ${!editing ? "cursor-pointer" : ""}`}
                  onClick={() => !editing && toggleWeek(weekIdx)}>
                  {!editing && (isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Week {w.weekNumber}</Badge>
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
                        <Label className="text-[10px] text-muted-foreground">Milestone</Label>
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
                                    <Input value={t} onChange={(e) => updateTopic(weekIdx, dayIdx, topicIdx, e.target.value)} className="bg-background border-border h-5 text-[10px] w-28" />
                                    <button onClick={() => deleteTopic(weekIdx, dayIdx, topicIdx)} className="text-destructive"><X className="h-2.5 w-2.5" /></button>
                                  </span>
                                ) : (
                                  <Badge key={topicIdx} variant="secondary" className="text-[8px] bg-muted">{t}</Badge>
                                )
                              ))}
                              {editing && <button onClick={() => addTopic(weekIdx, dayIdx)} className="text-[10px] text-primary hover:underline"><Plus className="h-2.5 w-2.5 inline" /> Add</button>}
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
                                    <Input value={r.label} onChange={(e) => updateResource(weekIdx, dayIdx, resIdx, "label", e.target.value)} className="bg-background border-border h-5 text-[10px] w-24" placeholder="Label" />
                                    <Input value={r.url} onChange={(e) => updateResource(weekIdx, dayIdx, resIdx, "url", e.target.value)} className="bg-background border-border h-5 text-[10px] flex-1" placeholder="URL" />
                                    <button onClick={() => deleteResource(weekIdx, dayIdx, resIdx)} className="text-destructive"><X className="h-2.5 w-2.5" /></button>
                                  </>
                                ) : (
                                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate flex items-center gap-0.5">
                                    <ExternalLink className="h-2.5 w-2.5" /> {r.label || r.url}
                                  </a>
                                )}
                              </div>
                            ))}
                            {editing && <button onClick={() => addResource(weekIdx, dayIdx)} className="text-[10px] text-primary hover:underline"><Plus className="h-2.5 w-2.5 inline" /> Add resource</button>}
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
          <Button size="sm" variant="outline" onClick={() => setWizardOpen(true)} className="border-primary/30 text-primary hover:bg-primary/10">
            <Wand2 className="h-3.5 w-3.5" /> Generate with AI
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWizardOpen(true)} className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-300">
            <Store className="h-3.5 w-3.5" /> Create New Course (Wizard)
          </Button>
          <Button size="sm" onClick={createEmpty} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> New Course
          </Button>
        </div>
      </div>

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
                    </CardTitle>
                    {c.description && <CardDescription className="text-xs text-muted-foreground truncate">{c.description}</CardDescription>}
                  </div>
                  <div className="flex flex-col gap-1 items-end ml-2">
                    <Badge variant="outline" className="text-[10px]">{(c.weeks?.length || 0)}w · {(c.weeks?.reduce((a, w) => a + (w.dayCount || w.days?.length || 0), 0) || 0)}d</Badge>
                    {c.projectEnabled && (
                      <Badge variant="outline" className={`text-[8px] ${c.projectRequired ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                        {c.projectRequired ? "Project Required" : "Project Optional"}
                      </Badge>
                    )}
                  </div>
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

      {/* CourseCreationWizard — opens via the "Create New Course (Wizard)"
          button above. Renders a multi-step Dialog that creates a course
          with AI-generated curriculum + marketplace metadata, then publishes
          it. onCreated refreshes this list. */}
      <CourseCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={load}
      />

      {/* ConvertOutlineDialog — opens via the "Convert Outline" button in
          the detail view's Weekly Plan header. Lets the instructor paste a
          raw outline and replace the current course's weeks/days with the
          AI-converted version. Rendered here (at the root) so it overlays
          both the list view and the detail view. */}
      <Dialog open={convertOpen} onOpenChange={(o) => { if (!o) closeConvertDialog(); else setConvertOpen(true); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4 text-primary" /> Convert Outline
            </DialogTitle>
            <DialogDescription>
              Paste any raw course outline (Word doc, syllabus, PDF text, textbook table of contents) and the AI converts it into a structured TraineesAI outline. This will REPLACE the current weekly plan.
            </DialogDescription>
          </DialogHeader>

          {convertError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{convertError}</span>
            </div>
          )}

          {!convertPreview && !converting && (
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <FileText className="h-3 w-3" /> Paste your course outline
              </Label>
              <Textarea
                value={convertText}
                onChange={(e) => setConvertText(e.target.value)}
                placeholder="Paste your course outline here. This can be from a Word document, syllabus, PDF, textbook table of contents, or any format. The AI will convert it into a structured TraineesAI course."
                className="bg-background border-border min-h-[300px] text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                {convertText.trim().length.toLocaleString()} characters · The AI will reorganize this into weeks × 5 days, enhance objectives, and add activities + deliverables + resources.
              </p>
            </div>
          )}

          {converting && (
            <div className="space-y-3 py-6">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <ClipboardPaste className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                  <svg className="absolute inset-0 h-16 w-16 animate-spin" style={{ animationDuration: "2s" }} viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="60 240" className="text-primary" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <Progress value={convertProgress} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{Math.round(convertProgress)}%</span><span>Please wait…</span>
              </div>
              <p className="text-xs text-foreground/70 animate-pulse text-center">{convertStatus}</p>
            </div>
          )}

          {convertPreview && !converting && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Outline converted!</span>
                <Badge variant="secondary" className="text-[10px]">
                  {convertPreview.length} weeks · {convertPreview.reduce((a, w) => a + w.days.length, 0)} days
                </Badge>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-background/50 p-3 space-y-2">
                {convertPreview.map((w) => (
                  <div key={w.weekNumber} className="text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">W{w.weekNumber}</Badge>
                      <span className="font-medium text-foreground">{w.phase}</span>
                    </div>
                    {w.milestone && (
                      <p className="text-[10px] text-muted-foreground mb-1">🎯 {w.milestone}</p>
                    )}
                    <div className="flex flex-wrap gap-1 ml-6">
                      {w.days.map((d) => (
                        <Badge key={d.day} variant="outline" className="text-[10px] font-normal">
                          D{d.day}: {d.title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                Clicking "Replace Current Outline" will DELETE the existing {selectedCourse?.weeks.length ?? 0} weeks and create {convertPreview.length} new weeks. This cannot be undone.
              </div>
            </div>
          )}

          <DialogFooter className="flex-row justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={closeConvertDialog}
              className="text-muted-foreground"
              disabled={busy}
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <div className="flex gap-2">
              {!convertPreview && !converting && (
                <Button
                  size="sm"
                  onClick={runConvert}
                  disabled={!convertText.trim() || busy}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> Convert
                </Button>
              )}
              {convertPreview && !converting && (
                <Button
                  size="sm"
                  onClick={applyConvertedOutline}
                  disabled={busy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {busy ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  ) : (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Replace Current Outline</>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArrowLeft({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
}
