"use client";

/**
 * StudentAITools — AI features for the student detail panel.
 *
 * Combines:
 * - Explain this student (one-click narrative, cached)
 * - Living-book narrative (per-week, scrollable)
 * - Draft-a-check-in (AI drafts message in teacher's voice)
 * - Rehearsal mode (practice conversation against AI student persona)
 *
 * All use the configured AI model (callAI) via backend routes.
 */

import { useState } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, BookOpen, BookMarked, MessageSquarePlus, Drama, Send, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentAIToolsProps {
  studentId: string;
  studentName: string;
  onDraftCheckin?: (draft: string) => void;
}

export function StudentAITools({ studentId, studentName, onDraftCheckin }: StudentAIToolsProps) {
  const [tab, setTab] = useState<"explain" | "narrative" | "draft" | "rehearse">("explain");

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Tools for {studentName}
        </CardTitle>
        <div className="flex flex-wrap gap-1 mt-2">
          {([
            { key: "explain", label: "Explain", icon: BookOpen },
            { key: "narrative", label: "Narrative", icon: BookMarked },
            { key: "draft", label: "Draft check-in", icon: MessageSquarePlus },
            { key: "rehearse", label: "Rehearse", icon: Drama },
          ] as const).map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-[11px] whitespace-nowrap rounded-md border transition-colors",
                  tab === t.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <Icon className="h-3 w-3" /> {t.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {tab === "explain" && <ExplainStudent studentId={studentId} />}
        {tab === "narrative" && <NarrativeView studentId={studentId} />}
        {tab === "draft" && <DraftCheckin studentId={studentId} studentName={studentName} onDraftCheckin={onDraftCheckin} />}
        {tab === "rehearse" && <RehearsalMode studentId={studentId} studentName={studentName} />}
      </CardContent>
    </Card>
  );
}

// === Explain Student ===
function ExplainStudent({ studentId }: { studentId: string }) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ narrative: string; cached: boolean }>(`/api/students/${studentId}/explain`, undefined, AI_TIMEOUT_MS);
      setNarrative(res.narrative);
      setCached(res.cached);
    } catch { setNarrative("Failed to generate narrative. Try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-2">
      {!narrative && !loading && (
        <Button onClick={load} size="sm" className="bg-primary text-primary-foreground">
          <Sparkles className="h-3 w-3 mr-1" /> Generate summary
        </Button>
      )}
      {loading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Analyzing evidence...</span>
        </div>
      )}
      {narrative && !loading && (
        <div className="space-y-2">
          <p className="text-sm text-foreground whitespace-pre-wrap">{narrative}</p>
          <div className="flex items-center gap-2">
            <Button onClick={load} size="sm" variant="outline" className="border-border text-xs h-7">Refresh</Button>
            {cached && <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600">cached</Badge>}
          </div>
        </div>
      )}
    </div>
  );
}

// === Living-Book Narrative ===
function NarrativeView({ studentId }: { studentId: string }) {
  const [narratives, setNarratives] = useState<Array<{ week: number; text: string; cached: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ narratives: Array<{ week: number; text: string; cached: boolean }> }>(`/api/students/${studentId}/narrative`, undefined, AI_TIMEOUT_MS);
      setNarratives(res.narratives || []);
    } catch { setNarratives([]); }
    finally { setLoading(false); setLoaded(true); }
  };

  return (
    <div className="space-y-2">
      {!loaded && !loading && (
        <Button onClick={load} size="sm" className="bg-primary text-primary-foreground">
          <BookOpen className="h-3 w-3 mr-1" /> Load narrative
        </Button>
      )}
      {loading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Writing weekly narratives...</span>
        </div>
      )}
      {loaded && narratives.length > 0 && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {narratives.map(n => (
            <div key={n.week} className="rounded-lg bg-background/50 border border-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-primary">Week {n.week}</span>
                {n.cached && <Badge variant="outline" className="text-[9px] bg-muted">cached</Badge>}
              </div>
              <p className="text-xs text-foreground">{n.text}</p>
            </div>
          ))}
        </div>
      )}
      {loaded && narratives.length === 0 && (
        <p className="text-xs text-muted-foreground">No narrative data available yet.</p>
      )}
    </div>
  );
}

// === Draft Check-in ===
function DraftCheckin({ studentId, studentName, onDraftCheckin }: { studentId: string; studentName: string; onDraftCheckin?: (draft: string) => void }) {
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ draft: string; note: string }>(`/api/students/${studentId}/draft-checkin`, { reason }, AI_TIMEOUT_MS);
      setDraft(res.draft);
    } catch { setDraft("Failed to generate draft. Try writing manually."); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">AI drafts a warm check-in in your voice. You edit before sending.</p>
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason for check-in (optional — e.g. 'missed 3 days')"
        className="w-full px-2 py-1 text-xs rounded-md bg-background border border-border"
      />
      <Button onClick={generate} disabled={loading} size="sm" className="bg-primary text-primary-foreground">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquarePlus className="h-3 w-3" />}
        Draft message
      </Button>
      {draft && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="bg-background border-border text-sm min-h-[80px]"
          />
          {onDraftCheckin && (
            <Button onClick={() => onDraftCheckin(draft)} size="sm" className="bg-primary text-primary-foreground">
              <Send className="h-3 w-3" /> Use in compose
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// === Rehearsal Mode ===
interface RehearseMsg { role: "instructor" | "student_sim"; content: string; timestamp: string }

function RehearsalMode({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [conversation, setConversation] = useState<RehearseMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [scenario, setScenario] = useState("");

  const start = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ conversation: RehearseMsg[]; warning: string }>(`/api/students/${studentId}/rehearse`, {
        action: "start", scenario,
      }, AI_TIMEOUT_MS);
      setConversation(res.conversation);
      setStarted(true);
    } catch { setConversation([{ role: "student_sim", content: "Failed to start rehearsal.", timestamp: new Date().toISOString() }]); }
    finally { setBusy(false); }
  };

  const reply = async () => {
    if (!input.trim() || busy) return;
    const msg = input.trim();
    setInput("");
    setBusy(true);
    try {
      const res = await api.post<{ conversation: RehearseMsg[]; isComplete?: boolean }>(`/api/students/${studentId}/rehearse`, {
        action: "reply", conversation, teacherReply: msg,
      }, AI_TIMEOUT_MS);
      setConversation(res.conversation);
      if (res.isComplete) setIsComplete(true);
    } catch { }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
        <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0" />
        <p className="text-[10px] text-amber-700">
          This is a <strong>simulation for practice</strong>, not a prediction. The real student may respond differently.
        </p>
      </div>
      {!started && (
        <div className="space-y-2">
          <input
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            placeholder="Scenario (optional — e.g. 'discussing missed deadlines')"
            className="w-full px-2 py-1 text-xs rounded-md bg-background border border-border"
          />
          <Button onClick={start} disabled={busy} size="sm" className="bg-primary text-primary-foreground">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Drama className="h-3 w-3" />}
            Start rehearsal
          </Button>
        </div>
      )}
      {started && conversation.length > 0 && (
        <>
          <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1">
            {conversation.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "instructor" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-xs",
                  m.role === "instructor" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  {m.role === "student_sim" && <div className="text-[9px] font-medium opacity-70 mb-0.5">{studentName} (simulated)</div>}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-xs flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                </div>
              </div>
            )}
          </div>
          {!isComplete && (
            <div className="flex gap-1">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); reply(); } }}
                placeholder="Your message..."
                className="flex-1 px-2 py-1 text-xs rounded-md bg-background border border-border"
                disabled={busy}
              />
              <Button onClick={reply} disabled={busy || !input.trim()} size="sm" className="bg-primary text-primary-foreground">
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
