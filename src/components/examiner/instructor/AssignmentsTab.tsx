"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { showError } from "@/lib/toast-helpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  GraduationCap, HeartHandshake, Plus, Download,
} from "lucide-react";
import type { StudentRow } from "@/components/examiner/instructor/types";
import { PeerAssessmentInstructorView } from "@/components/examiner/instructor/PeerAssessmentInstructorView";
import { CertificateApprovals } from "@/components/examiner/instructor/CertificateApprovals";

export function AssignmentsTab({ students, courseId: propCourseId }: { students: StudentRow[]; courseId?: string }) {
  const [groupTasks, setGroupTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  // C5 fix: fetch the instructor's courseId from /api/auth/me so we can pass it
  // to POST /api/group-tasks (which requires it). Without this, teachers could
  // never create assignments — the API returned 400 "batchId and title required".
  // If a courseId prop is passed from the dashboard's course switcher, prefer that.
  const [fetchedCourseId, setFetchedCourseId] = useState<string | null>(null);
  const courseId = propCourseId || fetchedCourseId;
  const [courseError, setCourseError] = useState("");

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskType, setTaskType] = useState("assignment");
  const [taskDue, setTaskDue] = useState("");
  const [taskMaxScore, setTaskMaxScore] = useState(100);

  // Event form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventType, setEventType] = useState("deadline");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventActivityType, setEventActivityType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // C5 fix: fetch the instructor's courseId in parallel with the task list.
      // Without courseId, the create-task form is disabled.
      const [tasksRes, eventsRes, meRes] = await Promise.all([
        api.get<{ tasks: any[] }>("/api/group-tasks"),
        api.get<{ events: any[] }>("/api/events"),
        api.get<{ user: { courseId: string | null } | null }>("/api/auth/me").catch(() => ({ user: null })),
      ]);
      setGroupTasks(tasksRes.tasks || []);
      setEvents(eventsRes.events || []);
      if (meRes.user?.courseId) {
        setFetchedCourseId(meRes.user.courseId);
        setCourseError("");
      } else {
        setCourseError("You don't have a class assigned. Ask an administrator to assign you to a course before you can create assignments.");
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createTask = async () => {
    if (!taskTitle.trim()) return;
    if (!courseId) {
      showError("Cannot create assignment — no course assigned to your instructor account.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/group-tasks", {
        courseId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        type: taskType,
        dueDate: taskDue || undefined,
        maxScore: taskMaxScore,
      });
      setTaskTitle(""); setTaskDesc(""); setTaskType("assignment"); setTaskDue(""); setTaskMaxScore(100);
      setShowTaskForm(false);
      await load();
    } catch (e) { showError(e instanceof Error ? e.message : "Failed to create assignment"); }
    finally { setBusy(false); }
  };

  const createEvent = async () => {
    if (!eventTitle.trim() || !eventStart) return;
    setBusy(true);
    try {
      await api.post("/api/events", {
        title: eventTitle.trim(),
        description: eventDesc.trim(),
        type: eventType,
        startDate: eventStart,
        endDate: eventEnd || undefined,
        location: eventLocation.trim() || undefined,
        activityType: (eventType === "vocational" || eventType === "extracurricular") ? eventActivityType || undefined : undefined,
      });
      setEventTitle(""); setEventDesc(""); setEventType("deadline"); setEventStart(""); setEventEnd(""); setEventLocation(""); setEventActivityType("");
      setShowEventForm(false);
      await load();
    } catch (e) { showError(e instanceof Error ? e.message : "Failed to create event"); }
    finally { setBusy(false); }
  };

  const closeTask = async (taskId: string) => {
    if (!confirm("Close this task? Students will no longer be able to submit.")) return;
    try {
      await api.patch("/api/group-tasks", { taskId, status: "closed" });
      await load();
    } catch (e) { showError(e instanceof Error ? e.message : "Failed to close task"); }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task and all submissions?")) return;
    try {
      await api.del("/api/group-tasks", { taskId });
      await load();
    } catch (e) { showError(e instanceof Error ? e.message : "Failed to delete task"); }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    try {
      await api.del("/api/events", { eventId });
      await load();
    } catch (e) { showError(e instanceof Error ? e.message : "Failed to delete event"); }
  };

  const viewSubmissions = async (task: any) => {
    setSelectedTask(task);
    try {
      const res = await api.get<{ submissions: any[] }>(`/api/group-tasks/submit?groupTaskId=${task.id}`);
      setSubmissions(res.submissions || []);
    } catch { setSubmissions([]); }
  };

  const gradeSubmission = async (submissionId: string, score: number) => {
    try {
      await api.patch("/api/group-tasks/submit", { submissionId, score });
      // Refresh submissions
      if (selectedTask) {
        const res = await api.get<{ submissions: any[] }>(`/api/group-tasks/submit?groupTaskId=${selectedTask.id}`);
        setSubmissions(res.submissions || []);
      }
    } catch (e) { showError(e instanceof Error ? e.message : "Failed to grade submission"); }
  };

  const eventTypeColor = (type: string) =>
    type === "exam" ? "bg-destructive/5 text-destructive border-destructive/30"
    : type === "deadline" ? "bg-growth-amber-soft text-growth-amber border-growth-amber"
    : type === "meeting" ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
    : type === "activity" ? "bg-growth-sage-soft text-growth-sage border-growth-sage"
    : type === "holiday" ? "bg-violet-500/10 text-violet-600 border-violet-500/30"
    : type === "vocational" ? "bg-cyan-500/10 text-cyan-600 border-cyan-500/30"
    : type === "extracurricular" ? "bg-pink-500/10 text-pink-600 border-pink-500/30"
    : "bg-muted text-muted-foreground";

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Group Tasks */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Group Assignments
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Assign tasks to your entire class. Track submissions + grade in bulk.
              </CardDescription>
            </div>
<Button onClick={() => setShowTaskForm(!showTaskForm)} size="sm" disabled={!courseId} className="bg-primary hover:bg-primary/90 text-primary-foreground" title={courseId ? undefined : "No course assigned"}>
               <Plus className="h-3 w-3" /> New Assignment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* C5 fix: show a clear error when the instructor has no course assigned */}
          {courseError && (
            <div className="rounded-md border border-growth-amber bg-growth-amber-soft p-3 text-xs text-growth-amber-foreground dark:text-growth-amber flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{courseError}</p>
            </div>
          )}
          {/* Task creation form */}
          {showTaskForm && (
            <div className="rounded-md bg-muted/30 border border-border p-3 space-y-2">
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Assignment title (e.g. 'Week 3 Project Milestone')" className="bg-background border-border text-sm" />
              <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Description / instructions..." className="w-full min-h-16 rounded-md bg-background border border-border p-2 text-sm text-foreground resize-y" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="bg-background border-border h-8 text-xs" />
                <Input type="number" value={taskMaxScore} onChange={(e) => setTaskMaxScore(Number(e.target.value))} placeholder="Max score" className="bg-background border-border h-8 text-xs" />
                <div className="flex gap-1">
                  <Button onClick={createTask} disabled={busy || !taskTitle.trim() || !courseId} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 flex-1">
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Create
                  </Button>
                  <Button onClick={() => setShowTaskForm(false)} size="sm" variant="outline" className="border-border h-8">Cancel</Button>
                </div>
              </div>
            </div>
          )}

          {/* Task list */}
          {groupTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No assignments yet. Click "New Assignment" to create one for your class.</p>
          ) : (
            groupTasks.map(task => (
              <div key={task.id} className="rounded-md border border-border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <Badge variant="outline" className="text-[9px] capitalize">{task.type}</Badge>
                      <Badge variant="outline" className={`text-[9px] ${task.status === "open" ? "bg-growth-sage-soft text-growth-sage" : "bg-muted text-muted-foreground"}`}>{task.status}</Badge>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>{task._count?.submissions ?? 0} submissions</span>
                      {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                      <span>Max: {task.maxScore}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button onClick={() => viewSubmissions(task)} size="sm" variant="ghost" className="h-7 text-xs">
                      <Users className="h-3 w-3" /> View submissions
                    </Button>
                    {task.status === "open" && (
                      <Button onClick={() => closeTask(task.id)} size="sm" variant="ghost" className="h-7 text-xs text-growth-amber" title="Close">
                        <Lock className="h-3 w-3" />
                      </Button>
                    )}
                    <Button onClick={() => deleteTask(task.id)} size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Submissions viewer (modal-like inline) */}
      {selectedTask && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground">Submissions: {selectedTask.title}</CardTitle>
              <Button onClick={() => setSelectedTask(null)} size="sm" variant="ghost" className="h-7">Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No submissions yet.</p>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {submissions.map((sub: any) => (
                  <div key={sub.id} className="rounded-md bg-background border border-border p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">{sub.user?.name ?? "Unknown"}</span>
                      <span className="text-muted-foreground">{new Date(sub.submittedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-foreground mb-1 whitespace-pre-wrap">{sub.content}</p>
                    {sub.link && <a href={sub.link} target="_blank" rel="noopener noreferrer" className="text-primary text-[10px] hover:underline">{sub.link}</a>}
                    <div className="flex items-center gap-2 mt-2">
                      {sub.score !== null ? (
                        <Badge variant="outline" className="text-[9px] bg-growth-sage-soft text-growth-sage">Scored: {sub.score}/{selectedTask.maxScore}</Badge>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder="Score"
                            max={selectedTask.maxScore}
                            className="bg-muted border-border h-6 w-16 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = Number((e.target as HTMLInputElement).value);
                                if (!isNaN(val)) gradeSubmission(sub.id, val);
                              }
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground">/{selectedTask.maxScore} · Enter to grade</span>
                        </div>
                      )}
                      {sub.feedback && <span className="text-[10px] text-muted-foreground italic">"{sub.feedback}"</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Peer Assessment Results — instructor view */}
      {selectedTask && <PeerAssessmentInstructorView groupTaskId={selectedTask.id} />}

      {/* Events / Calendar */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary" /> Events & Calendar
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Schedule deadlines, exams, meetings, and activities for your class.
              </CardDescription>
            </div>
            <Button onClick={() => setShowEventForm(!showEventForm)} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-3 w-3" /> New Event
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Event creation form */}
          {showEventForm && (
            <div className="rounded-md bg-muted/30 border border-border p-3 space-y-2">
              <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Event title (e.g. 'Midterm Exam')" className="bg-background border-border text-sm" />
              <textarea value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} placeholder="Description..." className="w-full min-h-12 rounded-md bg-background border border-border p-2 text-sm text-foreground resize-y" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="activity">Activity</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="vocational">Vocational</SelectItem>
                    <SelectItem value="extracurricular">Extracurricular</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} className="bg-background border-border h-8 text-xs" />
                <Input type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} className="bg-background border-border h-8 text-xs" />
                <Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Location" className="bg-background border-border h-8 text-xs" />
              </div>
              {/* Activity subtype — shown only for vocational/extracurricular */}
              {(eventType === "vocational" || eventType === "extracurricular") && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Activity Type</Label>
                  <Select value={eventActivityType} onValueChange={setEventActivityType}>
                    <SelectTrigger className="bg-background border-border h-8 text-xs w-full"><SelectValue placeholder="Select activity type..." /></SelectTrigger>
                    <SelectContent>
                      {eventType === "vocational" ? (
                        <>
                          <SelectItem value="workshop">Workshop</SelectItem>
                          <SelectItem value="internship">Internship</SelectItem>
                          <SelectItem value="industry_visit">Industry Visit</SelectItem>
                          <SelectItem value="certification">Certification</SelectItem>
                          <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="club">Club</SelectItem>
                          <SelectItem value="sports">Sports</SelectItem>
                          <SelectItem value="arts">Arts</SelectItem>
                          <SelectItem value="competition">Competition</SelectItem>
                          <SelectItem value="community_service">Community Service</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-1">
                <Button onClick={createEvent} disabled={busy || !eventTitle.trim() || !eventStart} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-8">
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Create Event
                </Button>
                <Button onClick={() => setShowEventForm(false)} size="sm" variant="outline" className="border-border h-8">Cancel</Button>
              </div>
            </div>
          )}

          {/* Events list — chronological */}
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No events scheduled. Click "New Event" to add one.</p>
          ) : (
            <div className="space-y-1.5">
              {events.map((ev: any) => (
                <div key={ev.id} className="flex items-center justify-between rounded-md border border-border p-2 hover:bg-muted/30">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className={`text-[9px] capitalize flex-shrink-0 ${eventTypeColor(ev.type)}`}>{ev.type}</Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(ev.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        {ev.endDate && ` → ${new Date(ev.endDate).toLocaleDateString()}`}
                        {ev.location && ` · ${ev.location}`}
                      </p>
                      {ev.description && <p className="text-[10px] text-muted-foreground truncate">{ev.description}</p>}
                    </div>
                  </div>
                  <Button onClick={() => deleteEvent(ev.id)} size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive flex-shrink-0" title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* C4 fix: Certificate approvals — staff can review + approve/reject
          student certificate requests. Previously there was no UI for this,
          so students could request but nobody could approve. */}
      <CertificateApprovals />
    </div>
  );
}
