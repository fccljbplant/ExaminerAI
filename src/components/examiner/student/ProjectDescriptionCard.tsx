"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectSettingsCard } from "@/components/examiner/student/ProjectSettingsCard";
import { ProjectSuggestions } from "@/components/examiner/student/ProjectSuggestions";
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
import { StatSquareCard, GanttChartIcon, GithubIcon, safeParse } from "@/components/examiner/student/shared";

export function ProjectDescriptionCard({ onMode, hasTasks, onTasksGenerated }: { onMode?: (m: Mode) => void; hasTasks?: boolean; onTasksGenerated?: () => void }) {
  const [project, setProject] = useState<{
    projectName: string | null;
    projectSummary: string | null;
    projectKeyFeatures: string[];
    projectDurationWeeks: number | null;
    projectStartDate: string | null;
    projectNotes: string | null;
    projectGithubUrl: string | null;
    projectDeployUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [genMsgType, setGenMsgType] = useState<"success" | "error">("success");
  const [showGenConfirm, setShowGenConfirm] = useState(false);

  const load = useCallback(() => {
    api.get<{
      projectName: string | null;
      projectSummary: string | null;
      projectKeyFeatures: string[];
      projectDurationWeeks: number | null;
      projectStartDate: string | null;
      projectNotes: string | null;
      projectGithubUrl: string | null;
      projectDeployUrl: string | null;
    }>("/api/project/setup")
      .then(setProject)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateTasks = async (replace: boolean) => {
    setGenerating(true);
    setGenMsg("");
    setGenMsgType("success");
    setShowGenConfirm(false);
    try {
      const res = await api.post<{ ok: boolean; tasksCreated: number; message: string }>(
        "/api/project/generate-tasks",
        { replace },
        AI_TIMEOUT_MS
      );
      setGenMsgType("success");
      setGenMsg(res.message || `Generated ${res.tasksCreated} tasks.`);
      onTasksGenerated?.();
    } catch (e) {
      setGenMsgType("error");
      setGenMsg(e instanceof Error ? e.message : "Failed to generate tasks");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // If no project set, show the ProjectSettingsCard inline + AI suggestions.
  // No redundant "Set up your capstone project" banner — the ProjectSettingsCard
  // header itself already says "Create Your Capstone Project" with full
  // instructions, and the Home view's amber nudge already routes the student here.
  if (!project?.projectName) {
    return (
      <div className="space-y-4">
        {/* AI Project Suggestions */}
        <ProjectSuggestions />

        <ProjectSettingsCard onSaved={() => { load(); onTasksGenerated?.(); }} />
      </div>
    );
  }

  const duration = project.projectDurationWeeks ?? 6;
  const startDate = project.projectStartDate ? new Date(project.projectStartDate) : null;
  const endDate = startDate ? new Date(startDate.getTime() + duration * 7 * 24 * 60 * 60 * 1000) : null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> {project.projectName}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Your capstone project · {duration} week{duration !== 1 ? "s" : ""}
              {startDate && ` · ${startDate.toLocaleDateString()} → ${endDate?.toLocaleDateString()}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs"
              disabled={generating}
              onClick={() => {
                if (hasTasks) {
                  setShowGenConfirm(true);
                } else {
                  generateTasks(false);
                }
              }}
            >
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {generating ? "Generating..." : hasTasks ? "Regenerate Tasks" : "Generate Tasks"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted h-7 text-xs"
              onClick={() => onMode ? onMode("settings") : (() => {
                const url = new URL(window.location.href);
                url.searchParams.set("view", "settings");
                window.location.href = url.toString();
              })()}
            >
              <Edit3 className="h-3 w-3" /> Edit
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Generation status / confirm dialog */}
        {genMsg && (
          <div className={`rounded-md p-2.5 text-xs ${
            genMsgType === "error"
              ? "border border-destructive/30 bg-destructive/5 text-destructive"
              : "border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
          }`}>
            {genMsg}
          </div>
        )}
        {showGenConfirm && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs text-foreground">
              <AlertCircle className="h-3.5 w-3.5 inline mr-1 text-amber-500" />
              You already have tasks. Regenerating will <strong>delete all existing tasks and their comments</strong>, then create new AI-generated ones. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white h-7 text-xs"
                disabled={generating}
                onClick={() => generateTasks(true)}
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Yes, replace all tasks
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowGenConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Generate tasks CTA — prominent when no tasks exist */}
        {!hasTasks && !generating && !genMsg && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Generate your project task list with AI</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  The AI will read your project summary and create {duration} weeks of tailored tasks (5 per week, with milestones). You can edit, delete, or add more tasks anytime.
                </p>
              </div>
            </div>
          </div>
        )}
        {generating && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Generating tasks with AI...</p>
              <p className="text-[10px] text-muted-foreground">This takes ~10-15 seconds. The AI is reading your project definition and creating tailored tasks.</p>
            </div>
          </div>
        )}

        {/* === Project Summary — replaces the old 4-tab grid === */}
        {project.projectSummary ? (
          <div className="rounded-md bg-background/70 border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-primary" /> Project Summary
            </p>
            <p className="text-sm text-foreground leading-relaxed">{project.projectSummary}</p>
          </div>
        ) : (
          <div className="rounded-md bg-background/70 border border-dashed border-border p-3 text-center">
            <p className="text-xs text-muted-foreground italic">
              No AI summary yet. Edit your project in Settings to generate one.
            </p>
          </div>
        )}

        {/* === Key Features — chip-style display === */}
        {project.projectKeyFeatures && project.projectKeyFeatures.length > 0 && (
          <div className="rounded-md bg-background/70 border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Key Features
            </p>
            <div className="flex flex-wrap gap-1.5">
              {project.projectKeyFeatures.map((f, i) => (
                <Badge key={i} variant="outline" className="text-[11px] text-foreground border-primary/20 bg-primary/5 px-2.5 py-1">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Links row — GitHub + Deploy */}
        <div className="flex flex-wrap gap-2">
          {project.projectGithubUrl && (
            <a
              href={project.projectGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-background/70 border border-border px-3 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors"
            >
              <GithubIcon className="h-3 w-3" /> View GitHub Repo
            </a>
          )}
          {project.projectDeployUrl && (
            <a
              href={project.projectDeployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <TrendingUp className="h-3 w-3" /> Live Demo
            </a>
          )}
        </div>

        {/* Project notes */}
        {project.projectNotes && (
          <div className="rounded-md bg-background/70 border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
            <p className="text-xs text-foreground/80 leading-snug whitespace-pre-wrap">{project.projectNotes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
