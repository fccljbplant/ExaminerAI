"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Loader2,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants";

/**
 * modules/platform-portal — CourseCreationWizard (W16: V1
 * CourseCreationWizard restored as a full-page studio step)
 *
 * Three steps:
 *   1. Course details (name, subtitle, description, category, level, weeks)
 *   2. Marketplace settings (price, instructor, learn/prereq/skills lists)
 *   3. Curriculum — two generation modes:
 *        (a) "Generate with AI" — /api/courses/generate from scratch
 *        (b) "Paste your outline" — /api/courses/convert-outline from raw
 *            pasted text (Word/Notion/README) → structured weeks
 *   4. Preview weeks → Create course (published, marketplace-ready)
 */

interface WeekSummary {
  weekNumber: number;
  phase: string;
  milestone?: string;
  days: Array<{ day: number; title: string; objective?: string }>;
}

interface GeneratedCourse {
  name?: string;
  description?: string;
  assessmentType?: string;
  toolsUsed?: string[];
  deliverableTypes?: string[];
  weeks: WeekSummary[];
}

const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const inputCls =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none";

function parseList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export function CourseCreationWizard({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated?: (courseId: string) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — details
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("technology");
  const [level, setLevel] = useState("beginner");
  const [durationWeeks, setDurationWeeks] = useState(6);

  // Step 2 — marketplace
  const [price, setPrice] = useState(0);
  const [instructorName, setInstructorName] = useState("");
  const [whatYouWillLearn, setWhatYouWillLearn] = useState("");
  const [prerequisites, setPrerequisites] = useState("");
  const [skillsVerified, setSkillsVerified] = useState("");

  // Step 3 — generation
  const [genMode, setGenMode] = useState<"ai" | "paste">("ai");
  const [pastedOutline, setPastedOutline] = useState("");
  const [generated, setGenerated] = useState<GeneratedCourse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  const genIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  const step1Valid = name.trim().length >= 3;

  function startProgress(statuses: string[]) {
    setGenProgress(0);
    genIntervalRef.current = setInterval(() => {
      setGenProgress((p) => Math.min(p + Math.max(1, (90 - p) * 0.05), 90));
    }, 500);
    let si = 0;
    statusIntervalRef.current = setInterval(() => {
      si = (si + 1) % statuses.length;
      setGenStatus(statuses[si]);
    }, 2500);
  }

  function stopProgress() {
    if (genIntervalRef.current) clearInterval(genIntervalRef.current);
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    setGenProgress(100);
    setGenStatus("Done!");
  }

  /* (a) AI generation from scratch */
  async function generateCurriculum() {
    setError("");
    setGenerating(true);
    startProgress([
      "Analyzing course topic and target audience…",
      `Planning ${durationWeeks} weeks of content…`,
      "Generating daily learning objectives…",
      "Adding activities and deliverables…",
      "Finding documentation resources…",
    ]);
    try {
      const res = await api.post<{ course: GeneratedCourse }>(
        "/api/courses/generate",
        {
          courseName: name.trim(),
          description: description.trim(),
          domain: category,
          level,
          durationWeeks,
          daysPerWeek: 5,
          targetAudience: `${level} learners`,
        },
        300_000,
      );
      stopProgress();
      setGenerated(res.course);
      toast.success("Curriculum generated");
    } catch (e) {
      setGenProgress(0);
      setGenStatus("");
      setError(e instanceof Error ? e.message : "AI generation failed — you can still create the course and edit it later.");
    } finally {
      setGenerating(false);
    }
  }

  /* (b) Generate from pasted outline text */
  async function convertPastedOutline() {
    if (!pastedOutline.trim()) {
      setError("Please paste your course outline text first.");
      return;
    }
    setError("");
    setGenerating(true);
    startProgress([
      "Reading your outline…",
      `Reorganizing into ${durationWeeks} weeks × 5 days…`,
      "Enhancing objectives and activities…",
      "Adding deliverables and reflections…",
      "Finding real resource links…",
    ]);
    try {
      const res = await api.post<{ weeks: WeekSummary[] }>(
        "/api/courses/convert-outline",
        {
          outline: pastedOutline.trim(),
          courseName: name.trim(),
          category,
          level,
          durationWeeks,
          daysPerWeek: 5,
        },
        300_000,
      );
      stopProgress();
      setGenerated({ weeks: res.weeks });
      toast.success("Outline converted to a structured curriculum");
    } catch (e) {
      setGenProgress(0);
      setGenStatus("");
      setError(e instanceof Error ? e.message : "AI conversion failed — you can still create the course and edit it later.");
    } finally {
      setGenerating(false);
    }
  }

  /* Create the course (published, marketplace-ready) */
  async function createCourse() {
    setError("");
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        domain: category,
        level,
        subtitle: subtitle.trim() || null,
        category,
        price: Number(price) || 0,
        currency: "USD",
        durationWeeks: Number(durationWeeks) || 6,
        language: "en",
        published: true,
        featured: false,
        instructorName: instructorName.trim() || null,
        whatYouWillLearn: parseList(whatYouWillLearn),
        prerequisites: parseList(prerequisites),
        skillsVerified: parseList(skillsVerified),
      };
      if (generated) {
        payload.weeks = generated.weeks;
        if (generated.assessmentType) payload.assessmentType = generated.assessmentType;
        if (generated.toolsUsed) payload.toolsUsed = generated.toolsUsed;
        if (generated.deliverableTypes) payload.deliverableTypes = generated.deliverableTypes;
      }
      const created = await api.post<{ id: string }>("/api/courses", payload);
      toast.success("Course created", { description: "Published to the marketplace." });
      onCreated?.(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to course list"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-fg hover:bg-bg-subtle"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <h1 className="text-lg font-semibold text-fg md:text-xl">Create a course</h1>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["Details", "Marketplace", "Curriculum"] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = n < step;
          const active = n === step;
          return (
            <li key={label} className="flex shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-fg-muted" aria-hidden />}
              <button
                type="button"
                onClick={() => done && setStep(n)}
                disabled={!done}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                  done && "bg-bg-subtle text-fg-muted hover:text-fg",
                  active && "bg-brand text-on-brand",
                  !done && !active && "bg-bg-subtle text-fg-muted/60"
                )}
              >
                {done && <CheckCircle2 className="h-3 w-3" aria-hidden />}
                {n}. {label}
              </button>
            </li>
          );
        })}
      </ol>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger-subtle bg-danger-subtle p-3 text-sm text-danger-on">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {/* ── Step 1 — details ───────────────────────────────────── */}
      {step === 1 && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4 md:p-5">
          <h2 className="text-sm font-semibold text-fg">Course details</h2>
          <Field label="Course name *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frontend Engineering Fundamentals" className={inputCls} />
          </Field>
          <Field label="Subtitle">
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="One line that sells the course" className={inputCls} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What will learners be able to do?" className={cn(inputCls, "h-auto resize-y py-2")} />
          </Field>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {MARKETPLACE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Level">
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputCls}>
                {LEVELS.map((l) => (
                  <option key={l} value={l} className="capitalize">{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Weeks">
              <input type="number" min={1} max={20} value={durationWeeks} onChange={(e) => setDurationWeeks(Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand disabled:opacity-50"
            >
              Next: Marketplace <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
      )}

      {/* ── Step 2 — marketplace ───────────────────────────────── */}
      {step === 2 && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4 md:p-5">
          <h2 className="text-sm font-semibold text-fg">Marketplace settings</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Price (USD, 0 = free)">
              <input type="number" min={0} step={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Instructor name">
              <input value={instructorName} onChange={(e) => setInstructorName(e.target.value)} placeholder="e.g. Sarah Chen" className={inputCls} />
            </Field>
          </div>
          <Field label="What you'll learn (comma separated)">
            <input value={whatYouWillLearn} onChange={(e) => setWhatYouWillLearn(e.target.value)} placeholder="Build REST APIs, Deploy to Vercel, Write tests" className={inputCls} />
          </Field>
          <Field label="Prerequisites (comma separated)">
            <input value={prerequisites} onChange={(e) => setPrerequisites(e.target.value)} placeholder="Basic HTML, Git" className={inputCls} />
          </Field>
          <Field label="Skills verified (comma separated)">
            <input value={skillsVerified} onChange={(e) => setSkillsVerified(e.target.value)} placeholder="React, TypeScript, Node.js" className={inputCls} />
          </Field>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-4 text-sm font-semibold text-fg hover:bg-bg-subtle"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand"
            >
              Next: Curriculum <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
      )}

      {/* ── Step 3 — curriculum generation ─────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* mode tabs */}
          <div className="flex gap-1.5">
            <ModeTab
              active={genMode === "ai"}
              onClick={() => setGenMode("ai")}
              icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
              label="Generate with AI"
            />
            <ModeTab
              active={genMode === "paste"}
              onClick={() => setGenMode("paste")}
              icon={<ClipboardPaste className="h-3.5 w-3.5" aria-hidden />}
              label="Paste your outline"
            />
          </div>

          <section className="space-y-3 rounded-xl border border-line bg-surface p-4 md:p-5">
            {genMode === "ai" ? (
              <>
                <p className="text-xs text-fg-muted">
                  The AI designs the full curriculum — every week, phase and day — from your
                  course name, description and settings.
                </p>
                <button
                  type="button"
                  onClick={() => void generateCurriculum()}
                  disabled={generating || !step1Valid}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-50 sm:w-auto"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
                  {generating ? genStatus || "Generating…" : "Generate curriculum"}
                </button>
              </>
            ) : (
              <>
                <label htmlFor="outline-paste" className="text-xs font-medium text-fg-secondary">
                  Paste your outline text — from a Word doc, Notion page, README or syllabus.
                  The AI reorganizes it into structured weeks × days.
                </label>
                <textarea
                  id="outline-paste"
                  value={pastedOutline}
                  onChange={(e) => setPastedOutline(e.target.value)}
                  rows={8}
                  placeholder={"Week 1: HTML & CSS\n- Box model, flexbox, responsive design\n- Project: personal landing page\n\nWeek 2: JavaScript basics\n- Variables, functions, DOM\n- Project: interactive todo app…"}
                  className={cn(inputCls, "h-auto resize-y py-2 font-mono text-xs leading-relaxed")}
                />
                <button
                  type="button"
                  onClick={() => void convertPastedOutline()}
                  disabled={generating || !pastedOutline.trim()}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-50 sm:w-auto"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ClipboardPaste className="h-4 w-4" aria-hidden />}
                  {generating ? genStatus || "Converting…" : "Convert outline"}
                </button>
              </>
            )}

            {/* progress */}
            {generating && (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${genProgress}%` }} />
                </div>
                <p className="text-[11px] text-fg-muted">{genStatus}</p>
              </div>
            )}
          </section>

          {/* generated preview */}
          {generated && (
            <section className="space-y-3 rounded-xl border border-line bg-surface p-4 md:p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <BookOpen className="h-4 w-4 text-fg-muted" aria-hidden />
                Curriculum preview — {generated.weeks?.length ?? 0} weeks
              </h2>
              <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {generated.weeks?.map((w) => (
                  <div key={w.weekNumber} className="px-3 py-2">
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
                        {w.phase} {w.milestone ? `· ${w.milestone}` : ""} · {w.days?.length ?? 0} days
                      </span>
                    </button>
                    {expandedWeeks.has(w.weekNumber) && (
                      <ul className="mt-2 space-y-1 border-t border-line pt-2">
                        {w.days?.map((d) => (
                          <li key={d.day} className="flex gap-2 text-xs text-fg-secondary">
                            <span className="shrink-0 font-semibold tabular-nums text-fg-muted">D{d.day}</span>
                            <span className="min-w-0">
                              <span className="font-medium text-fg">{d.title}</span>
                              {d.objective ? <span className="text-fg-muted"> — {d.objective}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-4 text-sm font-semibold text-fg hover:bg-bg-subtle"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                </button>
                <button
                  type="button"
                  onClick={() => void createCourse()}
                  disabled={creating || !step1Valid}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-success px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                  {creating ? "Creating…" : "Create & publish course"}
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-fg-secondary">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors",
        active ? "bg-brand text-on-brand" : "border border-line bg-surface text-fg-secondary hover:text-fg"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
