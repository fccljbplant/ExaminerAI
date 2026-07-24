"use client";

/**
 * VoiceTouchpointLogger — natural-language touchpoint logging.
 *
 * "Log a touchpoint with Alex, went well, still worried about pacing"
 * → parsed into structured fields → teacher confirms → saved.
 */

import { useState } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, Send, CheckCircle2, Edit3 } from "lucide-react";

interface ParsedTouchpoint {
  studentId: string | null;
  studentName: string | null;
  type: string;
  note: string;
  outcome: string | null;
  followUpDate: string | null;
}

export function VoiceTouchpointLogger({ onLogged }: { onLogged?: () => void }) {
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState<ParsedTouchpoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const parse = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setError("");
    setParsed(null);
    setSaved(false);
    try {
      const res = await api.post<{ parsed: ParsedTouchpoint }>(`/api/mentorship/touchpoints/parse`, { transcript }, AI_TIMEOUT_MS);
      if (res.parsed) {
        setParsed(res.parsed);
      } else {
        setError("Could not parse the touchpoint. Try rephrasing.");
      }
    } catch { setError("Failed to parse. Try again."); }
    finally { setLoading(false); }
  };

  const confirm = async () => {
    if (!parsed?.studentId) {
      setError("Could not match a student. Please log manually.");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/mentorship/touchpoints`, {
        userId: parsed.studentId,
        type: parsed.type,
        note: parsed.note,
        outcome: parsed.outcome,
        followUpDate: parsed.followUpDate,
      });
      setSaved(true);
      setParsed(null);
      setTranscript("");
      onLogged?.();
    } catch { setError("Failed to save. Try again."); }
    finally { setSaving(false); }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" /> Quick Touchpoint Logger
        </CardTitle>
        <CardDescription className="text-xs">
          Type or paste what happened. AI parses it into structured fields for your review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder="e.g. 'Log a touchpoint with Alex, went well, still worried about pacing'"
          className="bg-background border-border text-sm min-h-[60px]"
          disabled={loading || saving}
        />
        <Button onClick={parse} disabled={loading || !transcript.trim()} size="sm" className="bg-primary text-primary-foreground">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Parse
        </Button>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {parsed && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Review before saving:</p>
            <div className="space-y-1 text-xs">
              <div><span className="text-muted-foreground">Student:</span> <span className="font-medium text-foreground">{parsed.studentName || "— not matched —"}</span></div>
              <div><span className="text-muted-foreground">Type:</span> {parsed.type}</div>
              <div><span className="text-muted-foreground">Note:</span> {parsed.note}</div>
              {parsed.outcome && <div><span className="text-muted-foreground">Outcome:</span> {parsed.outcome}</div>}
              {parsed.followUpDate && <div><span className="text-muted-foreground">Follow-up:</span> {parsed.followUpDate}</div>}
            </div>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={saving || !parsed.studentId} size="sm" className="bg-emerald-600 text-white h-7 text-xs">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Confirm & Save
              </Button>
              <Button onClick={() => setParsed(null)} variant="outline" size="sm" className="border-border h-7 text-xs">
                <Edit3 className="h-3 w-3" /> Discard
              </Button>
            </div>
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Touchpoint saved successfully.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
