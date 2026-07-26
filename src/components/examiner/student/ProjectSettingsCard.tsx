"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";

export function ProjectSettingsCard({ onSaved }: { onSaved?: () => void }) {
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectScope, setProjectScope] = useState("");
  const [projectObjectives, setProjectObjectives] = useState("");
  const [projectRequirements, setProjectRequirements] = useState("");
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [projectBusinessCase, setProjectBusinessCase] = useState("");
  const [projectDurationWeeks, setProjectDurationWeeks] = useState("6");
  const [projectStartDate, setProjectStartDate] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [projectGithubUrl, setProjectGithubUrl] = useState("");
  const [projectDeployUrl, setProjectDeployUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<{
        projectName: string | null;
        projectScope: string | null;
        projectObjectives: string | null;
        projectRequirements: string | null;
        projectBusinessCase: string | null;
        projectDurationWeeks: number | null;
        projectStartDate: string | null;
        projectNotes: string | null;
        projectGithubUrl: string | null;
        projectDeployUrl: string | null;
      }>("/api/project/setup");
      setProjectName(res.projectName);
      setProjectScope(res.projectScope || "");
      setProjectObjectives(res.projectObjectives || "");
      setProjectRequirements(res.projectRequirements || "");
      setProjectBusinessCase(res.projectBusinessCase || "");
      setProjectDurationWeeks(String(res.projectDurationWeeks ?? 6));
      setProjectStartDate(res.projectStartDate ? res.projectStartDate.slice(0, 10) : "");
      setProjectNotes(res.projectNotes || "");
      setProjectGithubUrl(res.projectGithubUrl || "");
      setProjectDeployUrl(res.projectDeployUrl || "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!projectName?.trim()) return;
    setBusy(true); setMsg("");
    try {
      // Send trimmed strings as-is (even if empty) so the PATCH handler can
      // convert "" to null and actually CLEAR the field. Using `|| undefined`
      // here would skip the field entirely, making it impossible to clear.
      await api.patch("/api/project/setup", {
        projectName: projectName.trim(),
        projectScope: projectScope.trim(),
        projectObjectives: projectObjectives.trim(),
        projectRequirements: projectRequirements.trim(),
        projectBusinessCase: projectBusinessCase.trim(),
        projectDurationWeeks: Number(projectDurationWeeks) || 6,
        projectStartDate: projectStartDate || null,
        projectNotes: projectNotes.trim(),
        projectGithubUrl: projectGithubUrl.trim(),
        projectDeployUrl: projectDeployUrl.trim(),
      });
      setEditing(false);
      setMsg("Project details saved! Generate tasks next.");
      setTimeout(() => setMsg(""), 5000);
      // Notify parent so it can re-fetch and show the "has project" view
      onSaved?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const generateTasksNow = async () => {
    setGeneratingTasks(true); setMsg("");
    try {
      const res = await api.post<{ ok: boolean; tasksCreated: number; message: string }>(
        "/api/project/generate-tasks", { replace: false }, AI_TIMEOUT_MS
      );
      setMsg(res.message || `Generated ${res.tasksCreated} tasks!`);
      onSaved?.();
      setTimeout(() => setMsg(""), 5000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to generate tasks");
    } finally { setGeneratingTasks(false); }
  };

  const deleteProject = async () => {
    if (!confirm("Delete your project and ALL tasks? This cannot be undone.")) return;
    setBusy(true); setMsg("");
    try {
      await api.del("/api/project/setup");
      setProjectName(null);
      setProjectScope(""); setProjectObjectives(""); setProjectRequirements(""); setProjectBusinessCase("");
      setProjectDurationWeeks("6"); setProjectStartDate(""); setProjectNotes("");
      setProjectGithubUrl(""); setProjectDeployUrl("");
      setMsg("Project deleted. Go to My Journey to create a new one.");
      try { await api.put("/api/journey", { stepIds: [] }); } catch {}
      setTimeout(() => setMsg(""), 5000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" /> {projectName !== null ? "Project Settings" : "Create Your Capstone Project"}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {projectName !== null ? "Edit or delete your capstone project definition" : "Fill in the details below to define your project. The AI will generate weekly tasks + milestones from this."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {projectName !== null && !editing ? (
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Current project</p>
              <p className="text-sm font-medium text-foreground">{projectName}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {projectDurationWeeks} week{projectDurationWeeks !== "1" ? "s" : ""}
                {projectStartDate && ` · starts ${new Date(projectStartDate).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={generateTasksNow} disabled={generatingTasks || busy} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {generatingTasks ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {generatingTasks ? "Generating..." : "Generate Tasks"}
              </Button>
              <Button onClick={() => setEditing(true)} size="sm" variant="outline" className="border-border">
                <Edit3 className="h-3 w-3" /> Edit Project
              </Button>
              <Button onClick={deleteProject} disabled={busy} size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3 w-3" /> Delete Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Project Name *</Label>
              <Input
                value={projectName ?? ""}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. E-Commerce Platform with AI Chatbot"
                className="bg-background border-border mt-1"
                autoFocus={projectName === null}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Duration (weeks)</Label>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={projectDurationWeeks}
                  onChange={(e) => setProjectDurationWeeks(e.target.value)}
                  className="bg-background border-border mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={projectStartDate}
                  onChange={(e) => setProjectStartDate(e.target.value)}
                  className="bg-background border-border mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Scope — what does the project cover?</Label>
              <Textarea
                value={projectScope}
                onChange={(e) => setProjectScope(e.target.value)}
                placeholder="e.g. A full-stack web application with frontend, backend API, and database. Includes user authentication, product catalog, shopping cart, and AI-powered customer support chatbot."
                className="bg-muted border-border mt-1 min-h-16 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Objectives — what will it achieve?</Label>
              <Textarea
                value={projectObjectives}
                onChange={(e) => setProjectObjectives(e.target.value)}
                placeholder="e.g. Build a deployable e-commerce platform. Learn full-stack development. Implement AI integration for customer support."
                className="bg-muted border-border mt-1 min-h-16 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Requirements — what technologies/features?</Label>
              <Textarea
                value={projectRequirements}
                onChange={(e) => setProjectRequirements(e.target.value)}
                placeholder="e.g. React frontend, Node.js backend, PostgreSQL database, Stripe payment integration, OpenAI API for chatbot."
                className="bg-muted border-border mt-1 min-h-16 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Business Case — why does this matter?</Label>
              <Textarea
                value={projectBusinessCase}
                onChange={(e) => setProjectBusinessCase(e.target.value)}
                placeholder="e.g. Small businesses need affordable e-commerce solutions. This project demonstrates full-stack + AI skills for a portfolio."
                className="bg-muted border-border mt-1 min-h-16 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">GitHub Repo URL (optional)</Label>
              <Input
                type="url"
                value={projectGithubUrl}
                onChange={(e) => setProjectGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="bg-background border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Live Deployment URL (optional)</Label>
              <Input
                type="url"
                value={projectDeployUrl}
                onChange={(e) => setProjectDeployUrl(e.target.value)}
                placeholder="https://my-project.vercel.app"
                className="bg-background border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Project Notes (architecture decisions, ideas, etc.)</Label>
              <Textarea
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
                placeholder="e.g. Using WordPress for CMS, custom plugin for AI chatbot, deploy on Vercel..."
                className="bg-muted border-border mt-1 min-h-20 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy || !projectName?.trim()} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {projectName !== null ? "Save Changes" : "Create Project"}
              </Button>
              {projectName !== null && (
                <Button onClick={() => { setEditing(false); load(); }} size="sm" variant="ghost">Cancel</Button>
              )}
            </div>
          </div>
        )}
        {msg && <p className="text-xs text-primary">{msg}</p>}
      </CardContent>
    </Card>
  );
}
