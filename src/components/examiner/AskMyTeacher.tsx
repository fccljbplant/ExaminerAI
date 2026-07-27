"use client";

/** AskMyTeacher — student → teacher messaging.
 *
 *  Course-plan-centric overhaul:
 *  - When `embedded` is true (rendered as a top-level nav item): show the
 *    dialog content INLINE (no floating button, no Dialog wrapper).
 *  - When `embedded` is false (legacy): render as a floating FAB that opens
 *    a Dialog. Currently AppShell uses embedded mode only.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Loader2, Send, CheckCircle2, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AskMyTeacherProps {
  currentView?: string;
  /** When true, render inline (no FAB, no Dialog wrapper) — used by the
   *  top-level "Ask My Teacher" nav item. */
  embedded?: boolean;
}
interface TeacherInfo { id: string; name: string; email: string; }

const VIEW_LABELS: Record<string, string> = {
  "dashboard": "Today", "journey": "My Journey", "checkin": "Today's Check-in",
  "question": "Practice", "weekly-test": "Weekly Test", "gantt": "My Project",
  "report-card": "My Progress", "ai-tutor": "AI Tutor", "course-outline": "Course",
  "messages": "Messages", "settings": "Settings", "ask-teacher": "Ask My Teacher",
};

export function AskMyTeacher({ currentView, embedded = false }: AskMyTeacherProps) {
  const [open, setOpen] = useState(false);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // In embedded mode, fetch the teacher immediately on mount (no need to
    // wait for the dialog to open). In FAB mode, defer until first open.
    if (!embedded && !open) return;
    if (teacher) return;
    setLoadingTeacher(true); setError("");
    api.get<{ teacher: TeacherInfo | null }>("/api/messages/teacher")
      .then((res) => {
        if (res.teacher) {
          setTeacher(res.teacher);
          const viewLabel = currentView ? VIEW_LABELS[currentView] ?? "Dashboard" : "Dashboard";
          setSubject(`Question about ${viewLabel}`);
        } else {
          setError("No teacher is assigned to you yet. Please contact your administrator.");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to find your teacher."))
      .finally(() => setLoadingTeacher(false));
  }, [open, embedded, teacher, currentView]);

  useEffect(() => {
    if (!embedded && !open) {
      const t = setTimeout(() => { setSuccess(false); setError(""); setBody(""); }, 300);
      return () => clearTimeout(t);
    }
  }, [open, embedded]);

  const send = async () => {
    if (!teacher || !body.trim()) return;
    setSending(true); setError("");
    try {
      await api.post("/api/messages", { toId: teacher.id, subject: subject.trim() || "Question", body: body.trim() });
      setSuccess(true);
      if (!embedded) setTimeout(() => setOpen(false), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send. Please try again.");
    } finally { setSending(false); }
  };

  // ============================================================
  // EMBEDDED MODE — render inline (no FAB, no Dialog wrapper).
  // Used by the top-level "Ask My Teacher" nav item.
  // ============================================================
  if (embedded) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> Ask my teacher
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Send a quick question to your teacher. They&apos;ll reply in your Messages tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {success ? (
            <div className="py-6 flex flex-col items-center text-center animate-success-burst">
              <CheckCircle2 className="h-12 w-12 text-growth-sage mb-3" />
              <p className="text-sm font-medium text-foreground">Message sent!</p>
              <p className="text-xs text-muted-foreground mt-1">Your teacher will see this in their Messages tab and reply soon.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSuccess(false); setBody(""); }}>
                Send another
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                {loadingTeacher ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Finding your teacher...</div>
                ) : teacher ? (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {teacher.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-sm text-foreground font-medium">{teacher.name} <span className="text-xs text-muted-foreground font-normal">· {teacher.email}</span></div>
                  </div>
                ) : (
                  <div className="text-xs text-growth-coral">{error || "No teacher found."}</div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ask-subject-emb" className="text-xs text-muted-foreground">Subject</Label>
                <Input id="ask-subject-emb" value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-muted border-border text-sm" placeholder="What's this about?" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ask-body-emb" className="text-xs text-muted-foreground">Your question</Label>
                <textarea
                  id="ask-body-emb" value={body} onChange={(e) => setBody(e.target.value)}
                  className="w-full min-h-32 rounded-md bg-muted border border-border p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="What's on your mind? e.g. 'I'm stuck on the weekly test Q3 — can you walk me through how to think about it?'"
                />
              </div>
              {error && <div className="text-xs text-growth-coral bg-growth-coral-soft rounded-md p-2">{error}</div>}
              <Button onClick={send} disabled={sending || !teacher || !body.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ============================================================
  // FAB MODE — floating button + Dialog (legacy, kept for fallback)
  // ============================================================
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40",
          "inline-flex items-center gap-2 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "px-4 py-3 text-sm font-medium",
          "hover:bg-primary/90 hover:shadow-xl",
          "transition-all duration-200 animate-fade-in-up",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label="Ask my teacher a question"
        title="Ask my teacher"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Ask my teacher</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Ask my teacher
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send a quick question to your teacher. They'll reply in your Messages tab.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-6 flex flex-col items-center text-center animate-success-burst">
              <CheckCircle2 className="h-12 w-12 text-growth-sage mb-3" />
              <p className="text-sm font-medium text-foreground">Message sent!</p>
              <p className="text-xs text-muted-foreground mt-1">Your teacher will see this in their Messages tab and reply soon.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                {loadingTeacher ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Finding your teacher...</div>
                ) : teacher ? (
                  <div className="text-sm text-foreground font-medium">{teacher.name} <span className="text-xs text-muted-foreground font-normal">· {teacher.email}</span></div>
                ) : (
                  <div className="text-xs text-growth-coral">{error || "No teacher found."}</div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ask-subject" className="text-xs text-muted-foreground">Subject</Label>
                <Input id="ask-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-muted border-border text-sm" placeholder="What's this about?" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ask-body" className="text-xs text-muted-foreground">Your question</Label>
                <textarea
                  id="ask-body" value={body} onChange={(e) => setBody(e.target.value)}
                  className="w-full min-h-24 rounded-md bg-muted border border-border p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="What's on your mind? e.g. 'I'm stuck on the weekly test Q3 — can you walk me through how to think about it?'"
                  autoFocus
                />
              </div>
              {error && <div className="text-xs text-growth-coral bg-growth-coral-soft rounded-md p-2">{error}</div>}
            </div>
          )}

          {!success && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="border-border"><X className="h-3 w-3" /> Cancel</Button>
              <Button onClick={send} disabled={sending || !teacher || !body.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
