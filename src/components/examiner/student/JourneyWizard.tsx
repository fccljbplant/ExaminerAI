"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";
import type {
  Stats, WeeklyTest, Competency, ReportCardRow, DailyLog, Task,
  Interaction, CommentRow, StatsResponse, Mode, JourneyStep,
} from "@/components/examiner/student/types";

const CAPSTONE_IDEAS = [
  { name: "AI Resume Builder", desc: "Users enter work history; AI formats it into a professional resume", ai: "Gemini rewrites weak bullet points into strong, achievement-focused language" },
  { name: "Smart Restaurant Website", desc: "Menu, table reservations, location/hours for a restaurant", ai: "Gemini recommends dishes based on customer preferences" },
  { name: "Clinic Appointment System", desc: "Patients view doctors and book appointments online", ai: "Gemini suggests which department based on symptoms" },
  { name: "Real Estate Portal", desc: "Property listings with photos, price, and location filters", ai: "Gemini turns plain-English requests into search filters" },
  { name: "Student Management System", desc: "Tracks student records, grades, and attendance", ai: "Gemini generates plain-language progress summaries" },
  { name: "AI Portfolio Website", desc: "Personal portfolio showcasing projects and skills", ai: "Gemini chatbot answers visitor questions about your work" },
  { name: "Event Booking Platform", desc: "Customers browse and book venues or event packages", ai: "Gemini recommends packages based on guest count + budget" },
  { name: "Freelancer Marketplace", desc: "Freelancers list services; clients post jobs", ai: "Gemini turns rough job descriptions into structured briefs" },
  { name: "Recipe & Meal Planner", desc: "Users browse recipes and build weekly meal plans", ai: "Gemini generates meal plans from available ingredients" },
  { name: "Job Portal / Career Site", desc: "Job seekers browse listings; employers post openings", ai: "Gemini compares resumes against job descriptions" },
  { name: "Small E-Commerce Store", desc: "Product catalog, cart, and checkout for small business", ai: "Gemini writes SEO-friendly product descriptions" },
  { name: "Non-Profit / Donation Website", desc: "Shares mission and collects donations", ai: "Gemini drafts personalized thank-you messages for donors" },
];

const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "welcome",
    week: 1,
    title: "Welcome to your 6-week journey!",
    description: "Over the next 6 weeks, you'll build a real, deployed, AI-powered website — from idea to live project. This wizard will guide you step by step. Click 'Start' when you're ready.",
    why: "Every great project starts with a clear understanding of where you're going. Taking 2 minutes to read this means you'll never feel lost.",
    action: { label: "Start", mode: "journey" },
    completedWhen: "manual",
  },
  {
    id: "read-outline",
    week: 1,
    title: "Read your course outline",
    description: "Your course outline has the full 6-week plan — every day, every topic, every tool you'll learn. Read it so you know what's coming.",
    why: "Knowing the full journey helps you stay motivated. You'll see how each week connects and why each topic matters.",
    action: { label: "Open Course Outline", mode: "course-outline" },
    completedWhen: "manual",
  },
  {
    id: "plan-project",
    week: 1,
    title: "Plan your project",
    description: "Think about what you want to build. You can pick one of the 12 ideas below for inspiration, or define your own project. Type your project name + details, then click Create. Your project definition will be saved — in the next step you'll choose how many weeks your project will take and generate a tailored task list with AI.",
    why: "Your project is the thread through all 6 weeks. Pick something you're genuinely interested in — you'll work on it every day. The 12 ideas below are just for reference; you can build whatever you want.",
    action: { label: "Create Project", mode: "journey" },
    completedWhen: "manual",
  },
  {
    id: "configure-timeline",
    week: 1,
    title: "Choose your project duration & generate tasks",
    description: "How many weeks do you want to spend on this project? Pick a duration (3-20 weeks), then click Generate Tasks. The AI will read your project definition and create a tailored task list — one task per weekday, with key milestones marked. This takes 10-60 seconds depending on the duration.",
    why: "A realistic timeline keeps you accountable. 3 weeks = intense sprint, 6 weeks = standard pace, 12+ weeks = thorough deep-dive. The AI tasks give you a starting point — you can edit, delete, or add more anytime in the Project tab.",
    action: { label: "Configure Timeline", mode: "journey" },
    completedWhen: "db:tasks",
  },
  {
    id: "review-plan",
    week: 1,
    title: "Review your project plan",
    description: "Open the Project tab. You'll see your project definition at the top, then a Gantt chart with your AI-generated tasks, and a task manager. Edit any task, add new ones, or mark milestones as you progress.",
    why: "Reviewing your plan keeps you on track. The Gantt chart shows progress at a glance. Checking off tasks feels good and builds momentum.",
    action: { label: "Open Project Plan", mode: "gantt" },
    completedWhen: "manual",
    aiTutorTopic: "Project planning and breaking work into small tasks",
  },
  {
    id: "setup-dev",
    week: 1,
    title: "Set up your development environment",
    description: "Install VS Code, Git, and LocalWP. These are your tools for the next 6 weeks.",
    why: "A professional dev environment is your foundation. Setting it up correctly now prevents hours of frustration later.",
    action: { label: "Ask AI Tutor for help", mode: "ai-tutor", topic: "Setting up VS Code, Git, and LocalWP for web development" },
    completedWhen: "manual",
    aiTutorTopic: "Setting up VS Code, Git, and LocalWP",
  },
  {
    id: "first-checkin",
    week: 1,
    title: "Do your first daily check-in",
    description: "Tell us what you worked on today. This builds your consistency and lets your teacher see your progress.",
    why: "Daily check-ins build consistency. It's not about perfect streaks — it's about showing up regularly. Missing a day is fine; coming back is what matters.",
    action: { label: "Do Check-In", mode: "checkin" },
    completedWhen: "db:logs",
  },
  {
    id: "first-question",
    week: 1,
    title: "Answer your first question",
    description: "Type a topic you want to be tested on. The AI will ask you a question about it and evaluate your answer.",
    why: "Testing your understanding catches gaps early. The AI grades on concepts, not just correctness.",
    action: { label: "Get a Question", mode: "question" },
    completedWhen: "db:interactions",
  },
  {
    id: "week1-test",
    week: 1,
    title: "Take your first weekly test",
    description: "A 15-question Socratic test. The AI examiner guides you, grades you, and gives behavioral feedback.",
    why: "Weekly tests show your teacher what you've understood. The final result tells you what to focus on next.",
    action: { label: "Take Weekly Test", mode: "weekly-test" },
    completedWhen: "db:test",
  },
  {
    id: "week2",
    week: 2,
    title: "Week 2: Build your website + database",
    description: "Homepage, WordPress, databases, SQL. Your project starts taking shape.",
    why: "Week 2 is where your project becomes real. Consistent progress here sets up the rest of the bootcamp.",
    action: { label: "Plan Week 2", mode: "gantt" },
    completedWhen: "db:week2",
    aiTutorTopic: "Building a homepage with WordPress and MySQL database fundamentals",
  },
  {
    id: "week3",
    week: 3,
    title: "Week 3: APIs, automation + AI agents",
    description: "REST APIs, Make.com automation, building your first AI agent.",
    why: "APIs and automation are core skills employers look for. This is where things get real.",
    action: { label: "Plan Week 3", mode: "gantt" },
    completedWhen: "db:week3",
    aiTutorTopic: "REST APIs, Make.com automation, and building AI agents",
  },
  {
    id: "week4",
    week: 4,
    title: "Week 4: Add AI to your project",
    description: "Prompt engineering, Gemini API, adding an AI feature to your project.",
    why: "AI integration is what makes your project stand out. This is your differentiator.",
    action: { label: "Plan Week 4", mode: "gantt" },
    completedWhen: "db:week4",
    aiTutorTopic: "Prompt engineering and integrating the Gemini API into a website",
  },
  {
    id: "week5",
    week: 5,
    title: "Week 5: Test, secure + deploy",
    description: "Testing, performance, security, and deploying to live hosting.",
    why: "A deployed project is a portfolio piece. This is what you'll show employers.",
    action: { label: "Plan Week 5", mode: "gantt" },
    completedWhen: "db:week5",
    aiTutorTopic: "Software testing, security hardening, and deploying WordPress to live hosting",
  },
  {
    id: "week6",
    week: 6,
    title: "Week 6: Polish + present your capstone",
    description: "Final audit, GitHub portfolio, interview prep, capstone presentation. You made it!",
    why: "This is the finish line. Your capstone is your proof of skill.",
    action: { label: "Plan Week 6", mode: "gantt" },
    completedWhen: "db:week6",
    aiTutorTopic: "Building a professional GitHub portfolio and preparing for technical interviews",
  },
];

export function JourneyWizard({ stats, onMode, onReload }: { stats: StatsResponse; onMode: (m: Mode) => void; onReload?: () => void }) {
  // Journey progress is stored in the DATABASE (User.journeyProgress),
  // NOT localStorage. This prevents cross-user leakage on shared devices.
  const [manualDone, setManualDone] = useState<string[]>([]);
  const [journeyLoaded, setJourneyLoaded] = useState(false);
  // Phase 2.1: Fetch journey steps from the DB (via /api/course/config) so
  // they adapt to the student's assigned course. Falls back to the hardcoded
  // JOURNEY_STEPS constant if the API fails (backward compat for batches with
  // no course assigned, which use the default 6-week web dev bootcamp).
  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>(JOURNEY_STEPS);
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectScope, setProjectScope] = useState("");
  const [projectObjectives, setProjectObjectives] = useState("");
  const [projectRequirements, setProjectRequirements] = useState("");
  const [projectBusinessCase, setProjectBusinessCase] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [createMsgType, setCreateMsgType] = useState<"success" | "error">("success");

  // Configure-timeline step state
  const [timelineWeeks, setTimelineWeeks] = useState(6);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [genProgress, setGenProgress] = useState(0); // 0-100 for the progress bar
  const [genStatusMsg, setGenStatusMsg] = useState("");
  const [genErrorMsg, setGenErrorMsg] = useState("");
  const [genResult, setGenResult] = useState<{ tasksCreated: number; weeksCovered: number } | null>(null);
  const [projectExists, setProjectExists] = useState(false);

  // Load journey progress from DB on mount
  useEffect(() => {
    api.get<{ completedSteps: string[] }>("/api/journey").then((res) => {
      setManualDone(res.completedSteps || []);
    }).catch(() => {}).finally(() => setJourneyLoaded(true));
  }, []);

  // Phase 2.1: Load course-specific journey steps from the DB. If the student's
  // batch has a course assigned with custom journeyStepsJson, use those.
  // Otherwise the API returns the default 6-week web dev steps (backward compat).
  useEffect(() => {
    api.get<{
      journeySteps: JourneyStep[];
    }>("/api/course/config").then((res) => {
      if (Array.isArray(res.journeySteps) && res.journeySteps.length > 0) {
        setJourneySteps(res.journeySteps);
      }
    }).catch(() => {
      // Keep the hardcoded JOURNEY_STEPS fallback (already set in useState init)
    });
  }, []);

  // Check if the student has a project defined (for the configure-timeline step)
  useEffect(() => {
    api.get<{ projectName: string | null; projectDurationWeeks: number | null }>("/api/project/setup")
      .then((res) => {
        setProjectExists(!!res.projectName?.trim());
        if (res.projectDurationWeeks) setTimelineWeeks(res.projectDurationWeeks);
      })
      .catch(() => {});
  }, []);

  // DB state
  const hasTasks = stats.tasks.length > 0;
  const hasLogs = stats.dailyLogs.length > 0;
  const hasInteractions = stats.recentInteractions.length > 0;
  const hasCompletedTest = stats.weeklyTests.some(w => w.status === "completed");
  const currentWeek = stats.stats.currentWeek;
  // The student's course duration (defaults to 6 if not set — backward compat
  // with the legacy hardcoded bootcamp). Used to detect "final week reached"
  // for the db:weekN journey step conditions, so a 4-week Python course
  // completes its journey at week 4 instead of being stuck waiting for week 6.
  const projectDurationWeeks = stats.stats.projectDurationWeeks ?? 6;

  // Check if a single step is done
  // A step is done if EITHER its DB condition is met OR it was manually marked done
  const isStepDone = (step: JourneyStep): boolean => {
    if (manualDone.includes(step.id)) return true; // manually clicked Next
    switch (step.completedWhen) {
      case "manual":    return manualDone.includes(step.id);
      case "db:tasks":  return hasTasks;
      case "db:logs":   return hasLogs;
      case "db:interactions": return hasInteractions;
      case "db:test":   return hasCompletedTest;
      case "db:week2":  return currentWeek >= 2;
      case "db:week3":  return currentWeek >= 3;
      case "db:week4":  return currentWeek >= 4;
      case "db:week5":  return currentWeek >= 5;
      // Final-week check: respects the student's actual course duration.
      // For a 6-week course this is `>= 6` (legacy behavior). For a 4-week
      // course this is `>= 4`. For a 10-week course this is `>= 6` until
      // currentWeek reaches 6, then it's done — which is wrong, but fixing
      // it properly requires moving JOURNEY_STEPS to the DB (Phase 2.1).
      // For now this is at least no worse than before for non-6-week courses
      // and exactly the same for the default 6-week course.
      case "db:week6":  return currentWeek >= Math.min(6, projectDurationWeeks);
      default:          return false;
    }
  };

  // Evaluate steps SEQUENTIALLY
  const completedStepIds: string[] = [];
  for (const step of journeySteps) {
    if (isStepDone(step)) {
      completedStepIds.push(step.id);
    } else {
      break;
    }
  }

  const steps = journeySteps.map(step => ({
    ...step,
    done: completedStepIds.includes(step.id),
  }));

  const currentStepIndex = steps.findIndex(s => !s.done);
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;
  const completedCount = steps.filter(s => s.done).length;
  const overallProgress = Math.round((completedCount / steps.length) * 100);

  // Mark a manual step as done in the DB
  const markStepDone = async (stepId: string) => {
    const updated = [...new Set([...manualDone, stepId])];
    setManualDone(updated);
    try { await api.post("/api/journey", { stepId }); } catch {}
  };

  // Go back — remove the last completed manual step
  const goBack = async () => {
    if (currentStepIndex <= 0) return;
    // Find the previous manual step to undo
    for (let i = currentStepIndex - 1; i >= 0; i--) {
      if (steps[i].completedWhen === "manual") {
        const stepId = steps[i].id;
        const updated = manualDone.filter(s => s !== stepId);
        setManualDone(updated);
        try { await api.put("/api/journey", { stepIds: updated }); } catch {}
        break;
      }
    }
  };

  const handleAction = (step: JourneyStep) => {
    if (step.completedWhen === "manual") {
      markStepDone(step.id);
    }
    if (step.id === "plan-project") return;
    if (step.action.mode === "ai-tutor") {
      // Open the AI Tutor tab (NotebookLM iframe per-course).
      // The AI Tutor component itself can guide the student on the step's topic.
      onMode("ai-tutor");
    } else if (step.action.mode === "course-outline") {
      // Open course outline in a new tab (it's a standalone HTML file)
      window.open("/course-plan.html", "_blank", "noopener,noreferrer");
    } else {
      onMode(step.action.mode);
    }
  };

  const createProject = async () => {
    if (!projectName.trim()) {
      setCreateMsgType("error");
      setCreateMsg("Please enter a project name");
      return;
    }
    setCreating(true);
    setCreateMsg("");
    setCreateMsgType("success");
    try {
      // Save the project definition only. Tasks are generated in the NEXT
      // journey step ("configure-timeline") where the user picks the duration.
      await api.post<{ ok: boolean; message: string }>("/api/project/setup", {
        projectName: projectName.trim(),
        projectScope: projectScope.trim() || undefined,
        projectObjectives: projectObjectives.trim() || undefined,
        projectRequirements: projectRequirements.trim() || undefined,
        projectBusinessCase: projectBusinessCase.trim() || undefined,
        // Default project duration is 6 weeks (student changes this in next step).
        projectDurationWeeks: 6,
        projectStartDate: new Date().toISOString(),
      });
      setCreateMsgType("success");
      setCreateMsg("Project saved! Click Next → to choose your project duration and generate tasks.");
      setProjectExists(true);
    } catch (e) {
      setCreateMsgType("error");
      setCreateMsg(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  // Generate tasks with the chosen timeline — shows a progress modal while the AI works.
  // Uses a fake-progress animation that approaches 90% while the real request is in flight,
  // then jumps to 100% on success.
  const generateTasksWithTimeline = async () => {
    if (!projectExists) {
      setGenErrorMsg("Please create a project first (previous step).");
      return;
    }
    setGeneratingTasks(true);
    setGenErrorMsg("");
    setGenResult(null);
    setGenProgress(0);
    setGenStatusMsg("Saving your project duration...");

    // 1. Save the chosen duration to the project
    try {
      await api.patch("/api/project/setup", { projectDurationWeeks: timelineWeeks });
    } catch {
      // non-fatal — generation can still proceed with the default duration
    }

    setGenStatusMsg(`Reading your project definition...`);
    // Start fake progress animation
    const progressInterval = setInterval(() => {
      setGenProgress(prev => {
        // Approach 90% asymptotically — never reach 100% until the real response
        const remaining = 90 - prev;
        return prev + Math.max(0.5, remaining * 0.08);
      });
    }, 400);

    // Cycle status messages to keep the user engaged
    const statusMessages = [
      `Analyzing your project: "${projectName}"...`,
      `Planning ${timelineWeeks} week${timelineWeeks === 1 ? "" : "s"} of tasks...`,
      "Generating daily tasks tailored to your project...",
      "Marking key milestones...",
      "Finalizing your project plan...",
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % statusMessages.length;
      setGenStatusMsg(statusMessages[msgIdx]);
    }, 2500);

    // 2. Call the AI generation endpoint with a long timeout
    // 20 weeks × 5 tasks = 100 tasks — can take 60-120 seconds
    const timeoutMs = Math.max(60_000, timelineWeeks * 8_000); // 8s per week, min 60s
    try {
      const res = await api.post<{ ok: boolean; tasksCreated: number; weeksCovered: number; message: string }>(
        "/api/project/generate-tasks",
        { weeks: timelineWeeks, replace: true },
        timeoutMs
      );
      clearInterval(progressInterval);
      clearInterval(msgInterval);
      setGenProgress(100);
      setGenStatusMsg("Done!");
      setGenResult({ tasksCreated: res.tasksCreated, weeksCovered: res.weeksCovered || timelineWeeks });
      // BUG-3 FIX: Refresh parent stats so the journey wizard sees the new tasks
      // and auto-advances the configure-timeline step (completedWhen: "db:tasks")
      onReload?.();
      // The db:tasks condition will auto-advance this step on next render
    } catch (e) {
      clearInterval(progressInterval);
      clearInterval(msgInterval);
      setGenProgress(0);
      setGenStatusMsg("");
      const err = e as { status?: number; message?: string };
      if (err?.status === 408 || err?.message?.includes("timed out")) {
        setGenErrorMsg(
          `The AI took too long to generate ${timelineWeeks} weeks of tasks. ` +
          `Try again, or reduce the number of weeks for a faster generation.`
        );
      } else {
        setGenErrorMsg(err?.message || "Failed to generate tasks. Please try again.");
      }
    } finally {
      setGeneratingTasks(false);
    }
  };

  if (!journeyLoaded) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Progress bar + Back button */}
      <div className="flex items-center gap-3 px-1">
        {currentStepIndex > 0 && (
          <Button onClick={goBack} variant="outline" size="sm" className="border-border text-foreground hover:bg-muted px-3 py-1.5 text-xs font-medium flex-shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        )}
        <Progress value={overallProgress} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground font-medium flex-shrink-0">{overallProgress}%</span>
      </div>

      {/* SINGLE current step card */}
      {currentStep ? (
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-4">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                {currentStepIndex + 1}
              </div>
              <Badge variant="outline" className="text-[10px]">Week {currentStep.week}</Badge>
              <span className="text-[10px] text-muted-foreground">Step {currentStepIndex + 1} of {steps.length}</span>
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-foreground mb-2">{currentStep.title}</h2>

            {/* Description */}
            <p className="text-sm text-foreground/80 mb-3">{currentStep.description}</p>

            {/* Why it matters — subtle */}
            <div className="rounded-md bg-muted/50 p-3 mb-4">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground/70">Why this matters:</strong> {currentStep.why}
              </p>
            </div>

            {/* Step-specific content */}
            {currentStep.id === "plan-project" && (
              <div className="space-y-4 mb-4">
                {/* Project name input — the primary action */}
                <div>
                  <Label className="text-foreground text-sm mb-1.5 block">What do you want to build? Type your project name:</Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createProject()}
                    placeholder="e.g. My Restaurant Website, Online Book Store, Fitness Tracker..."
                    className="bg-background border-border"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Type your own idea, or pick one from the suggestions below for inspiration.</p>
                </div>

                {/* Project description fields — optional but recommended */}
                <div className="space-y-3 rounded-md border border-border bg-background/50 p-3">
                  <p className="text-xs font-medium text-foreground">Project Details (optional but recommended for better AI task generation):</p>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Scope — what will the project cover?</Label>
                    <Textarea value={projectScope} onChange={(e) => setProjectScope(e.target.value)} placeholder="e.g. A restaurant website with menu, reservations, and location info" className="bg-muted border-border mt-1 min-h-16 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Objectives — what are the goals?</Label>
                    <Textarea value={projectObjectives} onChange={(e) => setProjectObjectives(e.target.value)} placeholder="e.g. Allow customers to view menu and book tables online" className="bg-muted border-border mt-1 min-h-16 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Requirements — what features are needed?</Label>
                    <Textarea value={projectRequirements} onChange={(e) => setProjectRequirements(e.target.value)} placeholder="e.g. Menu page, reservation form, contact page, Google Maps" className="bg-muted border-border mt-1 min-h-16 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Business Case — why does this project exist?</Label>
                    <Textarea value={projectBusinessCase} onChange={(e) => setProjectBusinessCase(e.target.value)} placeholder="e.g. Restaurants need online presence to attract customers and reduce phone calls" className="bg-muted border-border mt-1 min-h-16 text-xs" />
                  </div>
                </div>

                {/* Reference ideas — NOT clickable selection, just inspiration */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Project ideas for inspiration (click to use as your name):</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CAPSTONE_IDEAS.map((idea, i) => (
                      <button
                        key={i}
                        onClick={() => setProjectName(idea.name)}
                        className="text-left rounded-md border border-border bg-background/50 p-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <p className="text-xs font-medium text-foreground">{i + 1}. {idea.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{idea.desc}</p>
                        <p className="text-[9px] text-primary mt-0.5">AI: {idea.ai}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info section — ABOVE the button */}
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">When you click Create:</p>
                  <ul className="text-[11px] text-muted-foreground space-y-1">
                    <li>Project name + details saved to your profile</li>
                    <li>Project duration defaults to 6 weeks (editable in Settings)</li>
                    <li>You&apos;ll add your own tasks in the Project tab</li>
                    <li>The curriculum (weekly learning topics) is fixed — find it in the Learning Hub</li>
                  </ul>
                </div>

                {createMsg && <p className={`text-xs ${createMsgType === "error" ? "text-destructive" : "text-primary"}`}>{createMsg}</p>}
              </div>
            )}

            {/* === Configure Timeline step — choose weeks + generate tasks with AI === */}
            {currentStep.id === "configure-timeline" && (
              <div className="space-y-4 mb-4">
                {!projectExists ? (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                    <p className="text-xs text-foreground">
                      <AlertCircle className="h-4 w-4 inline mr-1 text-amber-500" />
                      No project found. Go back to the previous step and create a project first.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Weeks selector */}
                    <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                      <div>
                        <Label className="text-foreground text-sm font-medium">
                          How many weeks do you want for this project?
                        </Label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Choose 3-20 weeks. More weeks = more detailed tasks, but generation takes longer.
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={3}
                          max={20}
                          value={timelineWeeks}
                          onChange={(e) => setTimelineWeeks(Number(e.target.value))}
                          disabled={generatingTasks}
                          className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
                        />
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Input
                            type="number"
                            min={3}
                            max={20}
                            value={timelineWeeks}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (v >= 3 && v <= 20) setTimelineWeeks(v);
                            }}
                            disabled={generatingTasks}
                            className="bg-background border-border w-16 text-center font-bold"
                          />
                          <span className="text-sm text-muted-foreground">weeks</span>
                        </div>
                      </div>
                      {/* Quick presets */}
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { w: 3, label: "3w · Sprint" },
                          { w: 6, label: "6w · Standard" },
                          { w: 12, label: "12w · Deep" },
                          { w: 20, label: "20w · Thorough" },
                        ].map(preset => (
                          <button
                            key={preset.w}
                            type="button"
                            disabled={generatingTasks}
                            onClick={() => setTimelineWeeks(preset.w)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                              timelineWeeks === preset.w
                                ? "bg-primary text-primary-foreground"
                                : "bg-background border border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Estimated tasks: <strong className="text-foreground">{timelineWeeks * 5}</strong> ({timelineWeeks} weeks × 5 per week) ·
                        Estimated generation time: <strong className="text-foreground">~{Math.max(10, timelineWeeks * 5)}s</strong>
                      </p>
                    </div>

                    {/* Generate button */}
                    <Button
                      onClick={generateTasksWithTimeline}
                      disabled={generatingTasks}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                      size="lg"
                    >
                      {generatingTasks ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> Generating...</>
                      ) : genResult ? (
                        <><RefreshCw className="h-4 w-4" /> Regenerate Tasks</>
                      ) : (
                        <><Sparkles className="h-5 w-5" /> Generate {timelineWeeks * 5} Tasks with AI</>
                      )}
                    </Button>

                    {/* Success result */}
                    {genResult && !generatingTasks && (
                      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                              {genResult.tasksCreated} tasks generated!
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Your project plan covers {genResult.weeksCovered} weeks. Click Next → to review your tasks in the Project tab.
                              You can edit, delete, or add more tasks anytime.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error result */}
                    {genErrorMsg && !generatingTasks && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-destructive">Generation failed</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{genErrorMsg}</p>
                          </div>
                        </div>
                        <Button
                          onClick={generateTasksWithTimeline}
                          variant="outline"
                          size="sm"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Try Again
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* === Generating Tasks Modal — full-screen overlay with animation === */}
            {generatingTasks && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 space-y-5">
                  {/* Animated icon */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                      </div>
                      {/* Spinning ring */}
                      <svg className="absolute inset-0 h-20 w-20 animate-spin" style={{ animationDuration: "2s" }} viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="60 240" className="text-primary" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center space-y-1">
                    <h3 className="text-base font-bold text-foreground">Generating your project tasks</h3>
                    <p className="text-xs text-muted-foreground">
                      Creating {timelineWeeks * 5} tasks across {timelineWeeks} week{timelineWeeks === 1 ? "" : "s"}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, genProgress)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{Math.round(genProgress)}%</span>
                      <span>Please wait...</span>
                    </div>
                  </div>

                  {/* Status message */}
                  <div className="text-center min-h-[20px]">
                    <p className="text-xs text-foreground/70 animate-pulse">{genStatusMsg}</p>
                  </div>

                  {/* Tips */}
                  <div className="rounded-md bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground text-center">
                      💡 The AI reads your project definition and creates tailored tasks. This can take 10-90 seconds.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action button(s) */}
            <div className="flex gap-2 flex-wrap items-center">
              {currentStep.id === "plan-project" ? (
                <>
                  <Button
                    onClick={createProject}
                    disabled={creating || !projectName.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {projectName.trim() ? `Create "${projectName.trim()}"` : "Type a project name first"}
                  </Button>
                  {/* After creating (or skipping), the user can advance manually.
                      This fixes the dead-end bug where the step required db:tasks
                      but no tasks were auto-generated. */}
                  <Button
                    onClick={() => markStepDone(currentStep.id)}
                    variant="outline"
                    className="border-primary/40 text-primary hover:bg-primary/10"
                  >
                    Next →
                  </Button>
                </>
              ) : currentStep.id === "read-outline" ? (
                <>
                  <a
                    href="/course-plan.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 text-sm font-medium rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                  >
                    <BookOpen className="h-4 w-4 flex-shrink-0" /> <span className="hidden sm:inline">Open Course Outline</span>
                    <span className="sm:hidden">Outline</span>
                  </a>
                  <Button
                    onClick={() => markStepDone(currentStep.id)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Next →
                  </Button>
                </>
              ) : currentStep.id === "configure-timeline" ? (
                /* configure-timeline has its own Generate button in the content above.
                   Show only a Next button (enabled once tasks exist, or as a skip). */
                <>
                  {genResult && (
                    <Button
                      onClick={() => markStepDone(currentStep.id)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Next → Review Your Tasks
                    </Button>
                  )}
                  <Button
                    onClick={() => markStepDone(currentStep.id)}
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-muted"
                  >
                    {genResult ? "Skip review" : "Skip for now"}
                  </Button>
                </>
              ) : currentStep.id === "welcome" ? (
                /* Welcome step — only ONE button (Start →) to avoid the duplicate-button confusion */
                <Button
                  onClick={() => markStepDone(currentStep.id)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Start →
                </Button>
              ) : (
                <>
                  {/* The step's action button (navigates to the relevant tab) */}
                  <Button
                    onClick={() => handleAction(currentStep)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {currentStep.action.label} →
                  </Button>
                  {/* Next button — shows on ALL steps except plan-project (which has Create) */}
                  <Button
                    onClick={() => markStepDone(currentStep.id)}
                    variant="outline"
                    className="border-primary/40 text-primary hover:bg-primary/10"
                  >
                    Next →
                  </Button>
                </>
              )}
              {/* AI Tutor link — opens the AI Tutor tab (NotebookLM iframe per-course) */}
              {currentStep.aiTutorTopic && currentStep.id !== "plan-project" && currentStep.id !== "read-outline" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-violet-500/30 text-violet-600 hover:bg-violet-500/10"
                  onClick={() => onMode("ai-tutor")}
                >
                  <Brain className="h-3 w-3" /> Ask AI Tutor
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* All done */
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">Journey complete! 🎉</h2>
            <p className="text-sm text-muted-foreground">You've completed all 14 steps. Keep building — your capstone is your proof of skill.</p>
          </CardContent>
        </Card>
      )}

      {/* Link to view all steps — collapsible, NOT shown by default */}
      <div className="text-center">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {showTimeline ? "Hide all steps" : "View all steps"}
        </button>
      </div>

      {showTimeline && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="space-y-1">
              {steps.map((step, i) => {
                const isDone = step.done;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.id} className="flex items-center gap-2 py-1.5">
                    <div className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 ${
                      isDone ? "bg-emerald-500 text-white" :
                      isCurrent ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs ${isDone ? "text-muted-foreground line-through" : isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
