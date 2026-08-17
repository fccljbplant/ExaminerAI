"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants";
import { CourseCreationWizard } from "./course-wizard";

/**
 * modules/platform-portal — CoursePlanner (W16: V1 CoursePlanner restored)
 *
 * The platform admin's course studio on the v2 stack:
 *   list → AI-generate a course → edit (basics, marketplace, project,
 *   weeks) → publish.
 * Consumes the surviving staff-guarded V1 routes (same data model).
 */

interface WeekView {
  id?: string;
  weekNumber: number;
  phase: string;
  milestone?: string;
  dayCount?: number;
  days?: Array<{ day: number; title: string }>;
}

interface CourseView {
  id: string;
  name: string;
  description: string | null;
  subtitle: string | null;
  category: string;
  level: string;
  price: number;
  currency?: string;
  durationWeeks: number;
  domain: string | null;
  isActive: boolean;
  published: boolean;
  featured: boolean;
  projectEnabled?: boolean;
  projectRequired?: boolean;
  projectDefaultDurationWeeks?: number;
  instructorName?: string | null;
  thumbnailUrl?: string | null;
  /** Creator ownership (2026-08-17): set for courses this account built. */
  ownerUserId?: string | null;
  weeks: WeekView[];
}

interface GeneratedCourse {
  id?: string;
  name: string;
  description?: string;
  domain?: string;
  level?: string;
  assessmentType?: string;
  weeks: Array<{ weekNumber: number; phase: string; milestone?: string; days: Array<{ day: number; title: string }> }>;
  projectEnabled?: boolean;
  projectRequired?: boolean;
  projectDefaultDurationWeeks?: number;
}

type View = "list" | "generate" | "edit";

const LEVELS = ["beginner", "intermediate", "advanced"] as const;

export function CoursePlanner({
  showOwnership = false,
}: {
  /**
   * Creator-economy studio mode (2026-08-17): the instructor studio
   * passes true to badge "Yours" on courses where ownerUserId is set.
   */
  showOwnership?: boolean;
}) {
  const [view, setView] = useState<View>("list");
  const [courses, setCourses] = useState<CourseView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CourseView | null>(null);

  // generate form
  const [gen, setGen] = useState({ courseName: "", description: "", domain: "technology", level: "beginner", durationWeeks: 6, daysPerWeek: 5 });
  const [generated, setGenerated] = useState<GeneratedCourse | null>(null);
  const [generating, setGenerating] = useState(false);

  // edit form
  const [form, setForm] = useState<CourseView | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const payload = (await res.json()) as { courses?: CourseView[] };
      setCourses(payload.courses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load courses");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── AI generate ─────────────────────────────────────────────── */
  async function generate() {
    if (!gen.courseName.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post<{ course: GeneratedCourse; error?: string }>(
        "/api/courses/generate",
        {
          courseName: gen.courseName.trim(),
          description: gen.description.trim() || undefined,
          domain: gen.domain,
          level: gen.level,
          durationWeeks: gen.durationWeeks,
          daysPerWeek: gen.daysPerWeek,
        },
        AI_TIMEOUT_MS,
      );
      if (res.error) throw new Error(res.error);
      setGenerated(res.course);
      toast.success("Outline generated", { description: "Review it, then create the course." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function createGenerated() {
    if (!generated) return;
    setSaving(true);
    try {
      const created = await api.post<{ id: string; name: string }>("/api/courses", {
        name: generated.name,
        description: generated.description || null,
        domain: generated.domain,
        level: generated.level,
        assessmentType: generated.assessmentType,
        weeks: generated.weeks,
        projectEnabled: generated.projectEnabled,
        projectRequired: generated.projectRequired,
        projectDefaultDurationWeeks: generated.projectDefaultDurationWeeks,
        published: true,
        category: gen.domain,
        durationWeeks: generated.weeks.length,
        price: 0,
      });
      toast.success("Course created", { description: generated.name });
      setGenerated(null);
      setView("list");
      await load();
      const row = courses?.find((c) => c.id === created.id);
      if (row) void openEdit(row);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  /* ── Edit ────────────────────────────────────────────────────── */
  async function openEdit(course: CourseView) {
    setSelected(course);
    setView("edit");
    // Load the full detail — weeks come WITH their days so a save round-trip
    // passes the validator (weeks replace-all requires >=1 day each).
    setError(null);
    try {
      const res = await fetch(`/api/courses/${course.id}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const payload = (await res.json()) as { course?: CourseView };
      setForm(payload.course ?? (JSON.parse(JSON.stringify(course)) as CourseView));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load course detail");
      setForm(JSON.parse(JSON.stringify(course)) as CourseView);
    }
  }

  function set<K extends keyof CourseView>(key: K, value: CourseView[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function setWeek(weekNumber: number, patch: Partial<WeekView>) {
    setForm((f) =>
      f ? { ...f, weeks: f.weeks.map((w) => (w.weekNumber === weekNumber ? { ...w, ...patch } : w)) } : f
    );
  }

  function addWeek() {
    setForm((f) => {
      if (!f) return f;
      const next = f.weeks.length + 1;
      return { ...f, weeks: [...f.weeks, { weekNumber: next, phase: "New phase", milestone: "" }] };
    });
  }

  function removeWeek(weekNumber: number) {
    setForm((f) => {
      if (!f) return f;
      const weeks = f.weeks
        .filter((w) => w.weekNumber !== weekNumber)
        .map((w, i) => ({ ...w, weekNumber: i + 1 }));
      return { ...f, weeks };
    });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api.put(`/api/courses/${form.id}`, {
        name: form.name,
        description: form.description || undefined,
        subtitle: form.subtitle,
        category: form.category,
        level: form.level,
        price: form.price,
        durationWeeks: form.durationWeeks,
        domain: form.domain || undefined,
        isActive: form.isActive,
        published: form.published,
        featured: form.featured,
        projectEnabled: form.projectEnabled,
        projectRequired: form.projectRequired,
        projectDefaultDurationWeeks: form.projectDefaultDurationWeeks,
        instructorName: form.instructorName,
        thumbnailUrl: form.thumbnailUrl ?? null,
        weeks: form.weeks.map((w) => ({
          weekNumber: w.weekNumber,
          phase: w.phase,
          milestone: w.milestone ?? "",
          days: w.days ?? [],
        })),
      });
      toast.success("Course saved");
      await load();
      const updated = (await fetch("/api/courses").then((r) => r.json())) as { courses?: CourseView[] };
      const row = (updated.courses ?? []).find((c) => c.id === form.id);
      if (row) setSelected(row);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ──────────────────────────────────────────────────── */
  if (view === "generate") {
    return (
      <CourseCreationWizard
        onBack={() => {
          setGenerated(null);
          setView("list");
        }}
        onCreated={(courseId) => {
          setGenerated(null);
          setView("list");
          void load();
          const row = courses?.find((c) => c.id === courseId);
          if (row) void openEdit(row);
        }}
      />
    );
  }

  if (view === "edit" && form && selected) {
    return (
      <div className="space-y-4 md:space-y-6">
        <Header title={form.name} onBack={() => setView("list")} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {/* basics + marketplace */}
          <div className="space-y-4">
            <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-fg">Basics</h2>
              <Field label="Name *">
                <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} className={cn(inputCls, "resize-y")} />
              </Field>
              <Field label="Subtitle">
                <input value={form.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Domain">
                <input value={form.domain ?? ""} onChange={(e) => set("domain", e.target.value)} className={inputCls} />
              </Field>
            </section>

            <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-fg">Marketplace</h2>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Category">
                  <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                    {MARKETPLACE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Level">
                  <select value={form.level} onChange={(e) => set("level", e.target.value)} className={inputCls}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l} className="capitalize">{l}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Price (0 = free)">
                  <input type="number" min={0} step={1} value={form.price} onChange={(e) => set("price", Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Duration (weeks)">
                  <input type="number" min={1} max={52} value={form.durationWeeks} onChange={(e) => set("durationWeeks", Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
              <Field label="Instructor name">
                <input value={form.instructorName ?? ""} onChange={(e) => set("instructorName", e.target.value)} className={inputCls} />
              </Field>

              {/* thumbnail — V1 CourseThumbnailPicker restored */}
              <div>
                <span className="text-xs font-medium text-fg-secondary">Thumbnail</span>
                <ThumbnailEditor
                  currentUrl={form.thumbnailUrl ?? null}
                  courseName={form.name}
                  category={form.category}
                  onChange={(url) => set("thumbnailUrl", url)}
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <SwitchRow label="Published" on={form.published} onToggle={(v) => set("published", v)} />
                <SwitchRow label="Featured" on={form.featured} onToggle={(v) => set("featured", v)} />
                <SwitchRow label="Active" on={form.isActive} onToggle={(v) => set("isActive", v)} />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-fg">Project</h2>
              <div className="flex flex-wrap gap-3 pt-1">
                <SwitchRow label="Project enabled" on={Boolean(form.projectEnabled)} onToggle={(v) => set("projectEnabled", v)} />
                <SwitchRow label="Project required" on={Boolean(form.projectRequired)} onToggle={(v) => set("projectRequired", v)} />
              </div>
              <Field label="Default project duration (weeks)">
                <input type="number" min={1} max={20} value={form.projectDefaultDurationWeeks ?? 4} onChange={(e) => set("projectDefaultDurationWeeks", Number(e.target.value))} className={inputCls} />
              </Field>
            </section>
          </div>

          {/* weeks */}
          <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fg">Weeks ({form.weeks.length})</h2>
              <button
                type="button"
                onClick={addWeek}
                className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2 text-xs font-semibold text-fg hover:border-line-strong"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add week
              </button>
            </div>
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {form.weeks.map((w) => (
                <div key={w.weekNumber} className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedWeeks((prev) => {
                        const next = new Set(prev);
                        if (next.has(w.weekNumber)) next.delete(w.weekNumber);
                        else next.add(w.weekNumber);
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-2 text-left"
                  >
                    {expandedWeeks.has(w.weekNumber) ? (
                      <ChevronDown className="h-3.5 w-3.5 text-fg-muted" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-fg-muted" aria-hidden />
                    )}
                    <span className="text-sm font-medium text-fg">Week {w.weekNumber}</span>
                    <span className="truncate text-xs text-fg-muted">
                      {w.phase} {w.dayCount != null ? `· ${w.dayCount} days` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWeek(w.weekNumber);
                      }}
                      aria-label={`Delete week ${w.weekNumber}`}
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </button>
                  {expandedWeeks.has(w.weekNumber) && (
                    <div className="mt-2 grid grid-cols-1 gap-2 border-t border-line pt-2 sm:grid-cols-2">
                      <Field label="Phase">
                        <input value={w.phase} onChange={(e) => setWeek(w.weekNumber, { phase: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Milestone">
                        <input value={w.milestone ?? ""} onChange={(e) => setWeek(w.weekNumber, { milestone: e.target.value })} className={inputCls} />
                      </Field>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !form.name.trim()}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              {saving ? "Saving…" : "Save course"}
            </button>

            {/* AI tools (creator studio, 2026-08-17): material upload,
                quiz-from-module and RAG reindex — the APIs existed but had
                no UI. Only shown in the instructor studio (showOwnership). */}
            {showOwnership && <AITools courseId={form.id} weeks={form.weeks} />}
          </section>
        </div>
      </div>
    );
  }

  // list view
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">Course planner</h1>
        <button
          type="button"
          onClick={() => setView("generate")}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Generate with AI
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          {error}
          <button type="button" onClick={() => void load()} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </div>
      )}

      {!courses ? (
        <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
      ) : courses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-10 text-center text-sm text-fg-muted">
          No courses yet — generate your first one with AI.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {courses.map((c) => (
            <div key={c.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                <BookOpen className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                  <span className="truncate">{c.name}</span>
                  {!c.published && (
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-fg-muted">
                      draft
                    </span>
                  )}
                  {showOwnership && c.ownerUserId && (
                    <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-[10px] font-semibold text-fg">
                      Yours
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {(c.weeks ?? []).length} weeks · {c.level} · {(c.category ?? "other").replace("-", " ")} ·{" "}
                  {c.published ? "published" : "unpublished"} · {c.price === 0 ? "free" : `$${c.price}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openEdit(c)}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fg hover:border-line-strong"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── pieces ──────────────────────────────────────────────────────── */

const inputCls =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-fg-secondary">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function SwitchRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-fg">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 accent-[var(--brand)]"
      />
      {label}
    </label>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to course list"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-fg hover:bg-bg-subtle"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </button>
      <h1 className="truncate text-lg font-semibold text-fg md:text-xl">{title}</h1>
    </div>
  );
}

/* ── AI tools (creator studio, 2026-08-17) ──────────────────────────── */

/**
 * Course AI tools: upload source material (feeds the RAG index),
 * generate a quiz from a module, and reindex embeddings. Wired to the
 * /api/v2/instructor/courses/[id]/{material,quiz,reindex} routes that
 * previously had no UI caller.
 */
function AITools({
  courseId,
  weeks,
}: {
  courseId: string;
  weeks: WeekView[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialKind, setMaterialKind] = useState<"text" | "pdf" | "docx">("text");
  const [materialText, setMaterialText] = useState("");
  const [module, setModule] = useState("");

  const days = weeks.flatMap((w) =>
    (w.days?.length ? w.days : Array.from({ length: w.dayCount ?? 1 }, (_, i) => ({ day: i + 1, title: "" }))).map((d) => ({
      moduleId: `${w.weekNumber}-${d.day}`,
      label: `Week ${w.weekNumber} · Day ${d.day}${d.title ? ` — ${d.title}` : ""}`,
    })),
  );

  async function uploadMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!materialTitle.trim()) return;
    setBusy("material");
    try {
      await api.post(`/api/v2/instructor/courses/${courseId}/material`, {
        title: materialTitle.trim(),
        kind: materialKind,
        content: materialKind === "text" ? materialText : undefined,
      });
      toast.success("Material added", { description: "Indexed for the AI tutor — cite it in any lesson." });
      setMaterialTitle("");
      setMaterialText("");
    } catch (err) {
      toast.error("Upload failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    const kind = file.name.endsWith(".pdf") ? "pdf" : file.name.endsWith(".docx") ? "docx" : "text";
    setBusy("material");
    try {
      const dataUrl = kind === "text" ? undefined : await readAsDataUrl(file);
      await api.post(`/api/v2/instructor/courses/${courseId}/material`, {
        title: materialTitle.trim() || file.name,
        kind,
        ...(kind === "text" ? { content: await file.text() } : { dataUrl }),
      });
      toast.success("File added", { description: `${file.name} extracted and indexed for the AI tutor.` });
      setMaterialTitle("");
    } catch (err) {
      toast.error("Upload failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function generateQuiz() {
    if (!module) return;
    setBusy("quiz");
    try {
      const res = await api.post<{ data: { questions: unknown[] } }>(
        `/api/v2/instructor/courses/${courseId}/quiz`,
        { moduleId: module },
        AI_TIMEOUT_MS,
      );
      toast.success("Quiz generated", { description: `${res.data.questions?.length ?? 0} questions saved to the module.` });
    } catch (err) {
      toast.error("Quiz generation failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function reindex() {
    setBusy("reindex");
    try {
      const res = await api.post<{ data: { indexed?: number; withEmbeddings?: number } }>(
        `/api/v2/instructor/courses/${courseId}/reindex`,
      );
      toast.success("Index rebuilt", {
        description: `${res.data.indexed ?? 0} chunks indexed (${res.data.withEmbeddings ?? 0} with embeddings).`,
      });
    } catch (err) {
      toast.error("Reindex failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Sparkles className="h-4 w-4 text-brand" aria-hidden />
        AI tools
      </h2>

      {/* material upload */}
      <form onSubmit={uploadMaterial} className="space-y-2">
        <p className="text-xs text-fg-muted">
          Upload lesson material (PDF/DOCX/text) — the AI tutor cites it with sources.
        </p>
        <div className="flex gap-2">
          <input
            value={materialTitle}
            onChange={(e) => setMaterialTitle(e.target.value)}
            placeholder="Material title"
            aria-label="Material title"
            className={cn(inputCls, "min-w-0 flex-1")}
          />
          <select
            value={materialKind}
            onChange={(e) => setMaterialKind(e.target.value as "text" | "pdf" | "docx")}
            aria-label="Material kind"
            className={cn(inputCls, "w-24 shrink-0")}
          >
            <option value="text">Text</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
          </select>
        </div>
        {materialKind === "text" ? (
          <textarea
            value={materialText}
            onChange={(e) => setMaterialText(e.target.value)}
            rows={2}
            placeholder="Paste the material text…"
            aria-label="Material text"
            className={cn(inputCls, "resize-y")}
          />
        ) : (
          <label className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-dashed border-line text-xs font-medium text-fg-secondary hover:border-line-strong">
            Choose a {materialKind.toUpperCase()} file
            <input
              type="file"
              accept={materialKind === "pdf" ? "application/pdf" : ".docx"}
              className="sr-only"
              onChange={(e) => void uploadFile(e.target.files?.[0])}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={busy === "material" || !materialTitle.trim()}
          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
        >
          {busy === "material" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {materialKind === "text" ? "Add material" : "Upload file"}
        </button>
      </form>

      {/* quiz from module */}
      <div className="space-y-2">
        <p className="text-xs text-fg-muted">Generate a quiz from one module (5 questions, saved to the module).</p>
        <div className="flex gap-2">
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            aria-label="Module"
            className={cn(inputCls, "min-w-0 flex-1")}
          >
            <option value="">Pick a week · day…</option>
            {days.map((d) => (
              <option key={d.moduleId} value={d.moduleId}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void generateQuiz()}
            disabled={busy === "quiz" || !module}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
          >
            {busy === "quiz" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Wand2 className="h-3.5 w-3.5" aria-hidden />}
            Generate
          </button>
        </div>
      </div>

      {/* reindex */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">Rebuild the tutor&apos;s search index after big edits.</p>
        <button
          type="button"
          onClick={() => void reindex()}
          disabled={busy === "reindex"}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fg hover:bg-bg-subtle disabled:opacity-50"
        >
          {busy === "reindex" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          Reindex
        </button>
      </div>
    </section>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Couldn't read file"));
    reader.readAsDataURL(file);
  });
}

/* ── ThumbnailEditor — V1 CourseThumbnailPicker restored ──────────── */

function ThumbnailEditor({
  currentUrl,
  courseName,
  category,
  onChange,
}: {
  currentUrl: string | null;
  courseName: string;
  category: string;
  onChange: (url: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshImages = (query: string) => {
    const q = encodeURIComponent(query.trim() || "professional training");
    setImages(Array.from({ length: 12 }, (_, i) => `https://picsum.photos/seed/${q}/600/400${i + 1}`));
  };

  const [images, setImages] = useState<string[]>(() => {
    const q = encodeURIComponent(`${courseName} ${category}`.trim() || "professional training");
    return Array.from({ length: 12 }, (_, i) => `https://picsum.photos/seed/${q}/600/400${i + 1}`);
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > 500_000) {
      setError("Image too large — max 500KB (the thumbnail is stored in the database).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      onChange(String(reader.result));
      toast.success("Thumbnail uploaded");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="mt-1 space-y-2">
      {/* current */}
      <div className="flex items-start gap-3">
        <div className="relative aspect-video w-40 overflow-hidden rounded-lg border border-line bg-bg-subtle">
          {currentUrl ? (
            <img src={currentUrl} alt="Course thumbnail" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-fg-muted">
              No thumbnail
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-bg-subtle px-3 text-xs font-semibold text-fg hover:border-line-strong">
            <UploadIcon />
            Upload image
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="sr-only" />
          </label>
          {currentUrl && !currentUrl.startsWith("data:") && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fg-muted hover:border-danger hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* stock picker */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              refreshImages(search);
            }
          }}
          placeholder="Search stock images… (Enter)"
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => refreshImages(search)}
          className="inline-flex h-11 shrink-0 items-center rounded-lg border border-line bg-bg-subtle px-3 text-xs font-semibold text-fg hover:border-line-strong"
        >
          Refresh
        </button>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {images.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => {
                onChange(url);
                toast.success("Thumbnail selected");
              }}
              className={cn(
                "aspect-video overflow-hidden rounded-md border-2 transition-colors",
                currentUrl === url ? "border-brand" : "border-transparent hover:border-line-strong"
              )}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}
