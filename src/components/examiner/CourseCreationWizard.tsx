"use client";

/**
 * CourseCreationWizard — multi-step Dialog for instructors to create a new
 * marketplace-ready course in one guided flow.
 *
 *   Step 1: Course Details
 *     - Name (required), subtitle, description, category, level, duration weeks
 *
 *   Step 2: Marketplace Settings
 *     - Price (0 = free), instructor display name + bio, thumbnail picker
 *       (reuses CourseThumbnailPicker), whatYouWillLearn / prerequisites /
 *       skillsVerified (comma-separated → string[])
 *
 *   Step 3: Generate Curriculum
 *     - Toggle between two modes:
 *       (a) "Generate with AI" — AI creates an outline from scratch
 *           based on the course name + description (existing flow).
 *       (b) "Paste Your Outline" — user pastes a raw outline (Word doc,
 *           syllabus, PDF text, textbook TOC, etc.) and the AI converts
 *           it into a structured TraineesAI outline (NEW).
 *     - Progress bar + status messages during generation / conversion
 *     - When done: shows the generated weeks/days summary
 *     - "Create Course" button at the bottom
 *
 * On "Create Course":
 *   1. POST /api/courses with the marketplace fields + AI-generated weeks and
 *      `published: true` so the course appears on the marketplace immediately.
 *   2. Shows a success message with a link to /courses/[id].
 *   3. Calls onCreated() so the parent (CoursePlanner) can refresh its list.
 *
 * Domain-agnostic — categories cover all professional training domains, not
 * just IT.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Sparkles, ArrowLeft, ArrowRight, Check, CheckCircle2,
  AlertCircle, ExternalLink, Wand2, BookOpen, Store, ClipboardPaste,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CourseThumbnailPicker from "./CourseThumbnailPicker";

// ============================================================
// Static option lists — mirror of MARKETPLACE_CATEGORIES / LEVELS
// in src/lib/marketplace.ts. Inlined here (not imported) because the
// marketplace lib pulls Prisma (`db`) and cannot run in the browser.
// Domain-agnostic — covers all professional training, not just IT.
// ============================================================
const CATEGORIES: { value: string; label: string }[] = [
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

const LEVELS: { value: string; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

interface WeekSummary {
  weekNumber: number;
  phase: string;
  milestone?: string;
  days: { day: number; title: string }[];
}

interface GeneratedCourse {
  weeks: WeekSummary[];
  domain?: string;
  level?: string;
  assessmentType?: string;
  toolsUsed?: string[];
  deliverableTypes?: string[];
}

interface CreatedCourse {
  id: string;
  name: string;
}

type Step = 1 | 2 | 3 | 4; // 4 = success

export default function CourseCreationWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  // ---------------- Form state ----------------
  // Step 1: Course details
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("technology");
  const [level, setLevel] = useState("beginner");
  const [durationWeeks, setDurationWeeks] = useState(6);

  // Step 2: Marketplace settings
  const [price, setPrice] = useState(0);
  const [instructorName, setInstructorName] = useState("");
  const [instructorBio, setInstructorBio] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [whatYouWillLearn, setWhatYouWillLearn] = useState("");
  const [prerequisites, setPrerequisites] = useState("");
  const [skillsVerified, setSkillsVerified] = useState("");

  // Step 3: Generated curriculum
  // genMode — "ai" (AI generates from scratch) | "paste" (user pastes raw outline text)
  const [genMode, setGenMode] = useState<"ai" | "paste">("ai");
  const [pastedOutline, setPastedOutline] = useState("");
  const [generated, setGenerated] = useState<GeneratedCourse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState("");
  const genIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step navigation + creation state
  const [step, setStep] = useState<Step>(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdCourse, setCreatedCourse] = useState<CreatedCourse | null>(null);

  // Reset everything when the dialog is closed + reopened.
  useEffect(() => {
    if (!open) {
      // Small delay so the close animation doesn't show the reset visually.
      const t = setTimeout(() => {
        setName(""); setSubtitle(""); setDescription("");
        setCategory("technology"); setLevel("beginner"); setDurationWeeks(6);
        setPrice(0); setInstructorName(""); setInstructorBio("");
        setThumbnailUrl(null);
        setWhatYouWillLearn(""); setPrerequisites(""); setSkillsVerified("");
        setGenMode("ai"); setPastedOutline("");
        setGenerated(null); setGenProgress(0); setGenStatus("");
        setStep(1); setCreating(false); setError(""); setCreatedCourse(null);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Cleanup intervals on unmount.
  useEffect(() => {
    return () => {
      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  // ---------------- Step validation ----------------
  const step1Valid = name.trim().length >= 3;

  // ---------------- Helpers ----------------
  const parseList = (s: string): string[] =>
    s.split(",").map(x => x.trim()).filter(Boolean);

  // ---------------- Generate curriculum ----------------
  const generateCurriculum = async () => {
    if (!name.trim()) { setError("Course name is required"); return; }
    setGenerating(true);
    setGenProgress(0);
    setGenStatus("Analyzing course topic and target audience…");
    setError("");

    // Progress animation — creeps toward 90% while we wait for the AI.
    genIntervalRef.current = setInterval(() => {
      setGenProgress(p => Math.min(p + Math.max(1, (90 - p) * 0.05), 90));
    }, 500);
    const statuses = [
      "Analyzing course topic and target audience…",
      `Planning ${durationWeeks} weeks of content…`,
      "Generating daily learning objectives…",
      "Adding activities and deliverables…",
      "Finding documentation resources…",
    ];
    let si = 0;
    statusIntervalRef.current = setInterval(() => {
      si = (si + 1) % statuses.length;
      setGenStatus(statuses[si]);
    }, 2500);

    try {
      const res = await api.post<{ course: GeneratedCourse }>(
        "/api/courses/generate",
        {
          courseName: name.trim(),
          description: description.trim(),
          domain: category,           // map marketplace category → domain
          level,
          durationWeeks,
          daysPerWeek: 5,
          targetAudience: `${level} learners`,
        },
        300_000, // 5 min — long courses can take a while
      );

      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      setGenProgress(100);
      setGenStatus("Done!");
      setGenerated(res.course);
    } catch (e) {
      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      setGenProgress(0);
      setGenStatus("");
      setError(e instanceof Error ? e.message : "AI generation failed. You can still create the course and edit the curriculum later.");
    } finally {
      setGenerating(false);
    }
  };

  // ---------------- Convert a pasted outline ----------------
  // Mirrors generateCurriculum() but calls /api/courses/convert-outline
  // with the raw pasted text. The response shape is { weeks: [...] } so
  // we wrap it in { weeks } to match the GeneratedCourse interface used
  // by the rest of the wizard.
  const convertPastedOutline = async () => {
    if (!pastedOutline.trim()) {
      setError("Please paste your course outline text first.");
      return;
    }
    setGenerating(true);
    setGenProgress(0);
    setGenStatus("Reading your outline…");
    setError("");

    // Progress animation — creeps toward 90% while we wait for the AI.
    genIntervalRef.current = setInterval(() => {
      setGenProgress(p => Math.min(p + Math.max(1, (90 - p) * 0.05), 90));
    }, 500);
    const statuses = [
      "Reading your outline…",
      `Reorganizing into ${durationWeeks} weeks × 5 days…`,
      "Enhancing objectives and activities…",
      "Adding deliverables and reflections…",
      "Finding real resource links…",
    ];
    let si = 0;
    statusIntervalRef.current = setInterval(() => {
      si = (si + 1) % statuses.length;
      setGenStatus(statuses[si]);
    }, 2500);

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
        300_000, // 5 min — large outlines can take a while to convert
      );

      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      setGenProgress(100);
      setGenStatus("Done!");
      setGenerated({ weeks: res.weeks });
    } catch (e) {
      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      setGenProgress(0);
      setGenStatus("");
      setError(e instanceof Error ? e.message : "AI conversion failed. You can still create the course and edit the curriculum later.");
    } finally {
      setGenerating(false);
    }
  };

  // ---------------- Create the course ----------------
  const createCourse = async () => {
    setError("");
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        domain: category,
        level,
        // Marketplace fields (Phase 6)
        subtitle: subtitle.trim() || null,
        category,
        price: Number(price) || 0,
        currency: "USD",
        durationWeeks: Number(durationWeeks) || 6,
        language: "en",
        thumbnailUrl: thumbnailUrl || null,
        published: true,           // ← marketplace-ready immediately
        featured: false,
        instructorName: instructorName.trim() || null,
        instructorBio: instructorBio.trim() || null,
        whatYouWillLearn: parseList(whatYouWillLearn),
        prerequisites: parseList(prerequisites),
        skillsVerified: parseList(skillsVerified),
      };

      // Attach AI-generated weeks + metadata when present.
      if (generated) {
        payload.weeks = generated.weeks;
        if (generated.assessmentType) payload.assessmentType = generated.assessmentType;
        if (generated.toolsUsed) payload.toolsUsed = generated.toolsUsed;
        if (generated.deliverableTypes) payload.deliverableTypes = generated.deliverableTypes;
      }

      const res = await api.post<{ course: CreatedCourse }>(
        "/api/courses",
        payload,
        AI_TIMEOUT_MS,
      );
      setCreatedCourse(res.course);
      setStep(4);
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  };

  // ---------------- Render ----------------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" /> Create Marketplace Course
          </DialogTitle>
          <DialogDescription>
            A guided wizard that creates a course with AI-generated curriculum and publishes it to the marketplace in one step.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {step < 4 && (
          <div className="flex items-center gap-2">
            <StepDot n={1} active={step === 1} done={step > 1} label="Details" />
            <StepLine done={step > 1} />
            <StepDot n={2} active={step === 2} done={step > 2} label="Marketplace" />
            <StepLine done={step > 2} />
            <StepDot n={3} active={step === 3} done={step > 3} label="Curriculum" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ============== STEP 1: Course Details ============== */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Course Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Financial Modeling Fundamentals, CNC Machining Essentials, Patient Safety Basics"
                className="bg-background border-border"
              />
              <p className="text-[10px] text-muted-foreground">Minimum 3 characters.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Subtitle</Label>
              <Input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="One-line marketing tagline (shown on the marketplace card)"
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will students learn? What problems will they be able to solve? Who is this for?"
                className="bg-background border-border min-h-20 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Level</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Duration (weeks)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(Number(e.target.value) || 6)}
                className="bg-background border-border"
              />
              <p className="text-[10px] text-muted-foreground">1–20 weeks. 4+ weeks unlocks the capstone project feature.</p>
            </div>
          </div>
        )}

        {/* ============== STEP 2: Marketplace Settings ============== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Price (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value) || 0)}
                  className="bg-background border-border"
                />
                <p className="text-[10px] text-muted-foreground">0 = Free.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Instructor Display Name</Label>
                <Input
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith"
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Instructor Bio</Label>
              <Textarea
                value={instructorBio}
                onChange={(e) => setInstructorBio(e.target.value)}
                placeholder="Short bio shown on the course detail page — credentials, experience, what you teach."
                className="bg-background border-border min-h-16 text-xs"
              />
            </div>

            {/* Thumbnail picker */}
            <CourseThumbnailPicker
              currentUrl={thumbnailUrl}
              onSelect={(url) => setThumbnailUrl(url || null)}
              courseName={name}
              category={category}
            />

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">What you&apos;ll learn <span className="text-[10px] text-muted-foreground font-normal">(comma-separated)</span></Label>
                <Input
                  value={whatYouWillLearn}
                  onChange={(e) => setWhatYouWillLearn(e.target.value)}
                  placeholder="e.g. Build a financial model, Analyze risk, Present to stakeholders"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Prerequisites <span className="text-[10px] text-muted-foreground font-normal">(comma-separated)</span></Label>
                <Input
                  value={prerequisites}
                  onChange={(e) => setPrerequisites(e.target.value)}
                  placeholder="e.g. Basic Excel, High school math"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Skills verified <span className="text-[10px] text-muted-foreground font-normal">(comma-separated)</span></Label>
                <Input
                  value={skillsVerified}
                  onChange={(e) => setSkillsVerified(e.target.value)}
                  placeholder="e.g. DCF analysis, Sensitivity tables, Monte Carlo simulation"
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 3: Generate Curriculum ============== */}
        {step === 3 && (
          <div className="space-y-4">
            {!generated && !generating && (
              <div className="space-y-4">
                {/* Mode toggle: AI generate vs Paste outline */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenMode("ai")}
                    className={cn(
                      "flex items-start gap-2 rounded-md border p-3 text-left transition-colors",
                      genMode === "ai"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-muted/40",
                    )}
                  >
                    <Wand2 className={cn("h-4 w-4 mt-0.5", genMode === "ai" ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium", genMode === "ai" ? "text-foreground" : "text-muted-foreground")}>
                        Generate with AI
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        AI creates an outline from scratch based on the course name + description.
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenMode("paste")}
                    className={cn(
                      "flex items-start gap-2 rounded-md border p-3 text-left transition-colors",
                      genMode === "paste"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-muted/40",
                    )}
                  >
                    <ClipboardPaste className={cn("h-4 w-4 mt-0.5", genMode === "paste" ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium", genMode === "paste" ? "text-foreground" : "text-muted-foreground")}>
                        Paste Your Outline
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        Paste a syllabus, Word doc, PDF text, or TOC — the AI converts it.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Mode-specific input */}
                {genMode === "ai" ? (
                  <div className="rounded-md border border-border bg-muted/30 p-4 text-center">
                    <Wand2 className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground">Generate curriculum with AI</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      The AI will create {durationWeeks} weeks × 5 days of lessons, with daily objectives, activities, deliverables, and resource links. Takes 15–60 seconds.
                    </p>
                    <Button onClick={generateCurriculum} className="bg-primary hover:bg-primary/90 text-primary-foreground mt-3">
                      <Sparkles className="h-4 w-4" /> Generate with AI
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <ClipboardPaste className="h-3 w-3" /> Paste your course outline
                    </Label>
                    <Textarea
                      value={pastedOutline}
                      onChange={(e) => setPastedOutline(e.target.value)}
                      placeholder="Paste your course outline here. This can be from a Word document, syllabus, PDF, textbook table of contents, or any format. The AI will convert it into a structured TraineesAI course."
                      className="bg-background border-border min-h-[300px] text-xs font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">
                        {pastedOutline.trim().length.toLocaleString()} characters · AI will organize into {durationWeeks} weeks × 5 days
                      </p>
                      <Button
                        onClick={convertPastedOutline}
                        disabled={!pastedOutline.trim()}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <ClipboardPaste className="h-4 w-4" /> Convert Outline
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-center text-[10px] text-muted-foreground">
                  You can skip this step and create the course now — you&apos;ll be able to edit the curriculum in the Course Planner.
                </p>
              </div>
            )}

            {generating && (
              <div className="space-y-3 py-6">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                    </div>
                    <svg className="absolute inset-0 h-16 w-16 animate-spin" style={{ animationDuration: "2s" }} viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="60 240" className="text-primary" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <Progress value={genProgress} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{Math.round(genProgress)}%</span><span>Please wait…</span>
                </div>
                <p className="text-xs text-foreground/70 animate-pulse text-center">{genStatus}</p>
              </div>
            )}

            {generated && !generating && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Curriculum generated!</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {generated.weeks.length} weeks · {generated.weeks.reduce((a, w) => a + w.days.length, 0)} days
                  </Badge>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background/50 p-3 space-y-2">
                  {generated.weeks.map((w) => (
                    <div key={w.weekNumber} className="text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[9px]">W{w.weekNumber}</Badge>
                        <span className="font-medium text-foreground">{w.phase}</span>
                      </div>
                      {w.milestone && (
                        <p className="text-[10px] text-muted-foreground mb-1">🎯 {w.milestone}</p>
                      )}
                      <div className="flex flex-wrap gap-1 ml-6">
                        {w.days.map((d) => (
                          <Badge key={d.day} variant="outline" className="text-[9px] font-normal">
                            D{d.day}: {d.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={genMode === "ai" ? generateCurriculum : convertPastedOutline}
                  variant="outline"
                  size="sm"
                  className="border-border text-xs"
                >
                  {genMode === "ai" ? (
                    <><Wand2 className="h-3 w-3" /> Regenerate</>
                  ) : (
                    <><ClipboardPaste className="h-3 w-3" /> Re-convert</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ============== STEP 4: Success ============== */}
        {step === 4 && createdCourse && (
          <div className="space-y-4 py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Course created & published!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                &ldquo;{createdCourse.name}&rdquo; is now live on the marketplace.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button asChild size="sm" variant="outline" className="border-border">
                <Link href={`/courses/${createdCourse.id}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5" /> View on Marketplace
                </Link>
              </Button>
              <Button
                size="sm"
                onClick={() => onOpenChange(false)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <BookOpen className="h-3.5 w-3.5" /> Done
              </Button>
            </div>
          </div>
        )}

        {/* ============== Footer (navigation buttons) ============== */}
        {step < 4 && (
          <DialogFooter className="flex-row justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => step === 1 ? onOpenChange(false) : setStep((step - 1) as Step)}
              className="text-muted-foreground"
              disabled={generating || creating}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {step === 1 ? "Cancel" : "Back"}
            </Button>

            <div className="flex gap-2">
              {step === 1 && (
                <Button
                  size="sm"
                  onClick={() => setStep(2)}
                  disabled={!step1Valid}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Next: Marketplace <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
              {step === 2 && (
                <Button
                  size="sm"
                  onClick={() => setStep(3)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Next: Curriculum <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
              {step === 3 && (
                <Button
                  size="sm"
                  onClick={createCourse}
                  disabled={creating || generating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {creating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
                  ) : (
                    <><Check className="h-3.5 w-3.5" /> Create & Publish Course</>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Step indicator helpers
// ============================================================
function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors",
          done
            ? "bg-primary border-primary text-primary-foreground"
            : active
            ? "bg-primary/10 border-primary text-primary"
            : "bg-muted border-border text-muted-foreground"
        )}
      >
        {done ? <Check className="h-3 w-3" /> : n}
      </div>
      <span className={cn("text-[10px] font-medium hidden sm:inline", active || done ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return (
    <div className={cn("h-px flex-1 min-w-4", done ? "bg-primary" : "bg-border")} />
  );
}
