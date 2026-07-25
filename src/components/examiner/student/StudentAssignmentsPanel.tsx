"use client";

/**
 * StudentAssignmentsPanel — Scale Tier 2.
 *
 * Shows students their batch's group assignments + upcoming events.
 * Students can submit their work for open assignments.
 * After submitting, students must assess their group members' behavior
 * (collaboration, contribution, communication, reliability, respect).
 * Peer assessments feed the analysis pipeline automatically.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Send, ClipboardList, CalendarCheck, CheckCircle2, Link as LinkIcon, Users, Star } from "lucide-react";

interface GroupTask {
  id: string;
  title: string;
  description: string;
  type: string;
  dueDate: string | null;
  status: string;
  maxScore: number;
  week: number | null;
  _count?: { submissions: number };
  submissions?: Array<{
    id: string; content: string; link: string | null;
    score: number | null; feedback: string | null;
    submittedAt: string; gradedAt: string | null;
  }>;
}

interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
}

export function StudentAssignmentsPanel() {
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionLink, setSubmissionLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, eventsRes] = await Promise.all([
        api.get<{ tasks: GroupTask[] }>("/api/group-tasks"),
        api.get<{ events: Event[] }>("/api/events"),
      ]);
      setTasks(tasksRes.tasks || []);
      setEvents(eventsRes.events || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitTask = async (taskId: string) => {
    if (!submissionText.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/group-tasks/submit", {
        groupTaskId: taskId,
        content: submissionText.trim(),
        link: submissionLink.trim() || undefined,
      });
      setSubmissionText(""); setSubmissionLink("");
      setExpandedTask(null);
      await load();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  const eventTypeColor = (type: string) =>
    type === "exam" ? "bg-red-500/10 text-red-600 border-red-500/30"
    : type === "deadline" ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
    : type === "meeting" ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
    : type === "activity" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : type === "holiday" ? "bg-violet-500/10 text-violet-600 border-violet-500/30"
    : type === "vocational" ? "bg-cyan-500/10 text-cyan-600 border-cyan-500/30"
    : type === "extracurricular" ? "bg-pink-500/10 text-pink-600 border-pink-500/30"
    : "bg-muted text-muted-foreground";

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Group Assignments */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" /> Assignments
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Tasks assigned to your batch. Submit your work before the due date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No assignments yet.</p>
          ) : (
            tasks.map(task => {
              const mySubmission = task.submissions?.[0];
              const isExpanded = expandedTask === task.id;
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
              return (
                <div key={task.id} className="rounded-md border border-border p-3">
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <Badge variant="outline" className="text-[9px] capitalize">{task.type}</Badge>
                        {task.status === "closed" && <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground">Closed</Badge>}
                        {mySubmission && <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Submitted</Badge>}
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        {task.dueDate && (
                          <span className={isOverdue && task.status === "open" ? "text-red-600 font-medium" : ""}>
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                  </button>

                  {/* Expanded: show submission or form */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      {mySubmission ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">Your submission:</p>
                          <p className="text-xs text-foreground whitespace-pre-wrap bg-muted rounded-md p-2">{mySubmission.content}</p>
                          {mySubmission.link && <a href={mySubmission.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1"><LinkIcon className="h-3 w-3" />{mySubmission.link}</a>}
                          {mySubmission.score !== null && (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600">Score: {mySubmission.score}/{task.maxScore}</Badge>
                              {mySubmission.feedback && <span className="text-[10px] text-muted-foreground italic">"{mySubmission.feedback}"</span>}
                            </div>
                          )}
                          {mySubmission.score === null && task.status === "open" && (
                            <p className="text-[10px] text-muted-foreground">Awaiting grading...</p>
                          )}
                          {/* Allow re-submission if task is still open */}
                          {task.status === "open" && (
                            <div className="mt-2 space-y-1">
                              <textarea
                                value={submissionText}
                                onChange={(e) => setSubmissionText(e.target.value)}
                                placeholder="Update your submission..."
                                className="w-full min-h-16 rounded-md bg-background border border-border p-2 text-xs text-foreground resize-y"
                              />
                              <Input value={submissionLink} onChange={(e) => setSubmissionLink(e.target.value)} placeholder="Link (optional)" className="bg-background border-border h-7 text-xs" />
                              <Button onClick={() => submitTask(task.id)} disabled={submitting || !submissionText.trim()} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
                                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Update submission
                              </Button>
                            </div>
                          )}

                          {/* Peer Assessment — rate teammates after submitting */}
                          {task.status !== "closed" && (
                            <PeerAssessmentSection groupTaskId={task.id} />
                          )}
                        </div>
                      ) : task.status === "open" ? (
                        <div className="space-y-2">
                          <textarea
                            value={submissionText}
                            onChange={(e) => setSubmissionText(e.target.value)}
                            placeholder="Type your submission here..."
                            className="w-full min-h-20 rounded-md bg-background border border-border p-2 text-sm text-foreground resize-y"
                            autoFocus
                          />
                          <Input value={submissionLink} onChange={(e) => setSubmissionLink(e.target.value)} placeholder="Link (GitHub, doc, etc.) — optional" className="bg-background border-border h-8 text-sm" />
                          <Button onClick={() => submitTask(task.id)} disabled={submitting || !submissionText.trim()} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Submit work
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Task is closed. You did not submit.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      {events.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" /> Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {events.slice(0, 10).map(ev => (
              <div key={ev.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <Badge variant="outline" className={`text-[9px] capitalize flex-shrink-0 ${eventTypeColor(ev.type)}`}>{ev.type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(ev.startDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                  {ev.description && <p className="text-[10px] text-muted-foreground truncate">{ev.description}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// PeerAssessmentSection — student rates their group members
// after submitting a group task.
//
// 5 dimensions (1-5 stars each):
//   Collaboration, Contribution, Communication, Reliability, Respect
//
// After ALL pair assessments are complete, the analysis pipeline
// runs for each student — feeding PsychEvidence (attribution/mindset)
// and SkillMastery (collaboration skill) automatically.
// ============================================================
function PeerAssessmentSection({ groupTaskId }: { groupTaskId: string }) {
  const [pending, setPending] = useState<Array<{ userId: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentTarget, setCurrentTarget] = useState<string | null>(null);
  const [ratings, setRatings] = useState<{ collaboration: number; contribution: number; communication: number; reliability: number; respect: number }>({
    collaboration: 3, contribution: 3, communication: 3, reliability: 3, respect: 3,
  });
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ pending: Array<{ userId: string; name: string }>; totalToRate: number }>(
        `/api/peer-assessment?groupTaskId=${groupTaskId}`
      );
      setPending(res.pending || []);
      if ((res.pending || []).length === 0) {
        setCompleted(true);
      } else {
        setCurrentTarget(res.pending[0]?.userId || null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [groupTaskId]);

  useEffect(() => { load(); }, [load]);

  const submitAssessment = async () => {
    if (!currentTarget) return;
    setSubmitting(true);
    try {
      await api.post("/api/peer-assessment", {
        groupTaskId,
        assesseeId: currentTarget,
        ...ratings,
        textFeedback: feedback.trim(),
      });
      setFeedback("");
      setRatings({ collaboration: 3, contribution: 3, communication: 3, reliability: 3, respect: 3 });
      await load(); // refresh pending list
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  if (loading) return <p className="text-[10px] text-muted-foreground">Loading peer assessments...</p>;

  if (completed) {
    return (
      <div className="mt-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2">
        <p className="text-[10px] text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Peer assessments complete — thank you!
        </p>
      </div>
    );
  }

  const currentStudent = pending.find(p => p.userId === currentTarget);
  const dims = [
    { key: "collaboration" as const, label: "Collaboration", hint: "Worked well with the team" },
    { key: "contribution" as const, label: "Contribution", hint: "Did their fair share" },
    { key: "communication" as const, label: "Communication", hint: "Clear and responsive" },
    { key: "reliability" as const, label: "Reliability", hint: "Showed up and delivered on time" },
    { key: "respect" as const, label: "Respect", hint: "Respectful of others' ideas" },
  ];

  return (
    <div className="mt-3 rounded-md bg-primary/5 border border-primary/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-medium text-foreground">Rate Your Teammates</p>
        <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
          {pending.length} remaining
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Your assessments are anonymous to teammates and feed into their psychological + educational profile automatically.
      </p>

      {/* Target selector */}
      {pending.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {pending.map(p => (
            <button
              key={p.userId}
              onClick={() => setCurrentTarget(p.userId)}
              className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
                currentTarget === p.userId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Rating form for current target */}
      {currentStudent && (
        <div className="space-y-2">
          <p className="text-xs text-foreground font-medium">Rating: {currentStudent.name}</p>
          {dims.map(dim => (
            <div key={dim.key} className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-foreground font-medium">{dim.label}</p>
                <p className="text-[9px] text-muted-foreground">{dim.hint}</p>
              </div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRatings(prev => ({ ...prev, [dim.key]: n }))}
                    className="p-0.5"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        n <= ratings[dim.key]
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional feedback (shown to teacher only, never to the student)"
            className="w-full min-h-12 rounded-md bg-background border border-border p-2 text-[10px] text-foreground resize-y"
          />
          <Button
            onClick={submitAssessment}
            disabled={submitting}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Submit assessment
          </Button>
        </div>
      )}
    </div>
  );
}
