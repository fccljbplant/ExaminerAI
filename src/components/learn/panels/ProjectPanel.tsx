"use client";

// src/components/learn/panels/ProjectPanel.tsx — Project create + milestones + help.

import { useEffect, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { toast } from "sonner";
import {
 CheckCircle2, Circle, Loader2, Plus, Lightbulb, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tutor } from "@/modules/learn/lib/tutor-bus";

interface Milestone {
 id: string;
 title: string;
 description: string | null;
 order: number;
 status: "pending" | "in_progress" | "completed";
 completedAt: string | null;
}

interface Project {
 id: string;
 title: string;
 goal: string | null;
 stack: string | null;
 currentState: string | null;
 status: string;
 milestones: Milestone[];
}

interface Props {
 courseId: string;
 onMilestoneComplete?: () => void;
}

export function ProjectPanel({ courseId, onMilestoneComplete }: Props) {
 const [project, setProject] = useState<Project | null>(null);
 const [loading, setLoading] = useState(true);
 const [creating, setCreating] = useState(false);
 const [form, setForm] = useState({ title: "", goal: "", stack: "" });
 const [blocker, setBlocker] = useState("");
 const [hint, setHint] = useState<string | null>(null);
 const [hintLevel, setHintLevel] = useState<number>(0);
 const [hintLoading, setHintLoading] = useState(false);
 const [completingId, setCompletingId] = useState<string | null>(null);

 const fetchProject = useCallback(async () => {
 try {
 const res = await api.get<{ data: { projects: Project[] } }>(`/api/learn/projects?courseId=${courseId}`);
 setProject(res.data.projects[0] ?? null);
 } catch (e) {
 toast.error("Couldn't load project", { description: e instanceof Error ? e.message : undefined });
 } finally {
 setLoading(false);
 }
 }, [courseId]);

 useEffect(() => { fetchProject(); }, [fetchProject]);

 async function handleCreate(e: React.FormEvent) {
 e.preventDefault();
 if (!form.title.trim()) {
 toast.error("Title is required");
 return;
 }
 setCreating(true);
 try {
 const res = await api.post<{ data: { project: Project } }>(
 `/api/learn/projects`,
 { courseId, title: form.title.trim(), goal: form.goal || undefined, stack: form.stack || undefined },
 );
 setProject(res.data.project);
 setForm({ title: "", goal: "", stack: "" });
 toast.success("Project created", { description: "4 default milestones added." });
 tutor.play("thumbsup");
 } catch (e) {
 toast.error("Couldn't create project", { description: e instanceof Error ? e.message : undefined });
 } finally {
 setCreating(false);
 }
 }

 async function handleCompleteMilestone(milestoneId: string) {
 if (!project) return;
 setCompletingId(milestoneId);
 try {
 const res = await api.post<{ data: { milestone: Milestone; nextMilestone: Milestone | null; projectCompleted: boolean } }>(
 `/api/learn/projects/${project.id}/milestones/complete`,
 { milestoneId },
 );
 setProject(prev => prev ? {
 ...prev,
 milestones: prev.milestones.map(m => m.id === milestoneId ? res.data.milestone : m),
 status: res.data.projectCompleted ? "completed" : prev.status,
 } : null);
 toast.success("Milestone complete!", { description: "+15 XP" });
 tutor.play("cheer");
 onMilestoneComplete?.();
 } catch (e) {
 toast.error("Couldn't mark milestone", { description: e instanceof Error ? e.message : undefined });
 } finally {
 setCompletingId(null);
 }
 }

 async function handleGetHint() {
 if (!project) return;
 if (!blocker.trim()) {
 toast.error("Describe what's blocking you first.");
 return;
 }
 setHintLoading(true);
 try {
 const res = await api.post<{ data: { hint: string; hintLevel: number; hintLevelName: string; nextHintAvailable: boolean } }>(
 `/api/learn/projects/${project.id}/help`,
 { blocker: blocker.trim() },
 AI_TIMEOUT_MS,
 );
 setHint(res.data.hint);
 setHintLevel(res.data.hintLevel);
 tutor.play("explain");
 } catch (e) {
 toast.error("Couldn't get a hint", { description: e instanceof Error ? e.message : undefined });
 } finally {
 setHintLoading(false);
 }
 }

 if (loading) {
 return (
 <div className="flex items-center justify-center h-40">
 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
 </div>
 );
 }

 // No project → create form
 if (!project) {
 return (
 <div className="p-5">
 <h2 className="text-lg font-semibold">Start your project</h2>
 <p className="text-sm text-muted-foreground mt-1">
 You'll get 4 default milestones. You can update the details later.
 </p>
 <form onSubmit={handleCreate} className="mt-4 space-y-3">
 <div>
 <label className="text-xs font-medium text-muted-foreground">Project title</label>
 <input
 value={form.title}
 onChange={e => setForm(s => ({ ...s, title: e.target.value }))}
 placeholder="e.g. AI-powered WordPress blog assistant"
 className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
 maxLength={120}
 />
 </div>
 <div>
 <label className="text-xs font-medium text-muted-foreground">Goal (optional)</label>
 <textarea
 value={form.goal}
 onChange={e => setForm(s => ({ ...s, goal: e.target.value }))}
 placeholder="What will this project do for its users?"
 rows={3}
 className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
 maxLength={500}
 />
 </div>
 <div>
 <label className="text-xs font-medium text-muted-foreground">Stack (optional)</label>
 <input
 value={form.stack}
 onChange={e => setForm(s => ({ ...s, stack: e.target.value }))}
 placeholder="e.g. WordPress, PHP, MySQL, Gemini API"
 className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
 maxLength={200}
 />
 </div>
 <button
 type="submit"
 disabled={creating}
 className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
 Create project
 </button>
 </form>
 </div>
 );
 }

 const completedMilestones = project.milestones.filter(m => m.status === "completed").length;
 const activeMilestone = project.milestones.find(m => m.status !== "completed") ?? null;

 return (
 <div className="flex flex-col h-full">
 <header className="px-5 py-4 border-b">
 <h2 className="text-lg font-semibold truncate">{project.title}</h2>
 <p className="text-xs text-muted-foreground mt-0.5">
 {completedMilestones}/{project.milestones.length} milestones · {project.status === "completed" ? "Completed" : "In progress"}
 </p>
 {project.goal && <p className="text-sm text-muted-foreground mt-2">{project.goal}</p>}
 </header>

 <div className="flex-1 overflow-y-auto p-5 space-y-6">
 {/* NOW card */}
 {activeMilestone && (
 <section className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
 <div className="flex items-center gap-2 mb-1">
 <Sparkles className="h-4 w-4 text-primary" />
 <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Now</span>
 </div>
 <h3 className="font-semibold">{activeMilestone.title}</h3>
 {activeMilestone.description && <p className="text-sm text-muted-foreground mt-1">{activeMilestone.description}</p>}
 <button
 onClick={() => handleCompleteMilestone(activeMilestone.id)}
 disabled={completingId === activeMilestone.id}
 className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {completingId === activeMilestone.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
 Mark complete (+15 XP)
 </button>
 </section>
 )}

 {/* Milestones */}
 <section>
 <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Milestones</h3>
 <ol className="space-y-2">
 {project.milestones.map(m => (
 <li key={m.id} className={cn(
 "flex items-start gap-3 rounded-md px-3 py-2 text-sm",
 m.status === "completed" && "bg-growth-sage dark:bg-growth-sage/30",
 m.status !== "completed" && !activeMilestone?.id && "hover:bg-muted/60",
 )}>
 <span className="mt-0.5">
 {m.status === "completed"
 ? <CheckCircle2 className="h-4 w-4 text-growth-sage" />
 : <Circle className="h-4 w-4 text-muted-foreground" />}
 </span>
 <div className="min-w-0 flex-1">
 <p className={cn("font-medium leading-snug", m.status === "completed" && "line-through text-muted-foreground")}>{m.title}</p>
 {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
 </div>
 {m.status !== "completed" && m.id !== activeMilestone?.id && (
 <Lock label="Complete the previous milestone first" />
 )}
 </li>
 ))}
 </ol>
 </section>

 {/* Help section */}
 <section className="rounded-lg border p-4">
 <div className="flex items-center gap-2 mb-2">
 <Lightbulb className="h-4 w-4 text-growth-amber" />
 <h3 className="text-sm font-semibold">Stuck on something?</h3>
 </div>
 <p className="text-xs text-muted-foreground mb-3">
 Describe what's blocking you. I'll give you a nudge first, then a stronger hint if you ask again.
 </p>
 <textarea
 value={blocker}
 onChange={e => setBlocker(e.target.value)}
 placeholder="e.g. I don't know how to authenticate with the Gemini API."
 rows={3}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
 maxLength={2000}
 />
 <button
 onClick={handleGetHint}
 disabled={hintLoading}
 className="mt-2 inline-flex items-center gap-2 rounded-md bg-growth-amber/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-growth-amber disabled:opacity-50"
 >
 {hintLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
 Get {hintLevel >= 2 ? "another" : "a"} hint
 </button>
 {hint && (
 <div className="mt-3 rounded-md bg-muted/60 p-3 text-sm">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[10px] font-semibold uppercase tracking-wide text-growth-amber">
 Hint level {hintLevel + 1}
 </span>
 </div>
 <p className="whitespace-pre-wrap leading-relaxed">{hint}</p>
 </div>
 )}
 </section>
 </div>
 </div>
 );
}

function Lock({ label }: { label: string }) {
 return (
 <span title={label} className="text-[10px] text-muted-foreground/60 px-2 py-1 rounded bg-muted/50">locked</span>
 );
}
