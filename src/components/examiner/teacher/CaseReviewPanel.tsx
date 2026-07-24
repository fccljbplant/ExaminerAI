"use client";

/**
 * CaseReviewPanel — anonymized peer case review.
 *
 * Teachers post anonymized patterns for peer consultation.
 * AI strips identifying details before posting.
 */

import { useState, useEffect } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Eye, Send, CheckCircle2, Users } from "lucide-react";

interface CaseReview {
  id: string;
  patternSummary: string;
  createdAt: string;
  _count?: { responses: number };
}

export function CaseReviewPanel() {
  const [tab, setTab] = useState<"browse" | "post">("browse");
  const [reviews, setReviews] = useState<CaseReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawDescription, setRawDescription] = useState("");
  const [anonymized, setAnonymized] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [posted, setPosted] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<{ reviews: CaseReview[] }>("/api/mentorship/case-review")
      .then(res => setReviews(res.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const anonymize = async () => {
    if (!rawDescription.trim()) return;
    setProcessing(true);
    setAnonymized(null);
    setPosted(false);
    try {
      const res = await api.post<{ anonymizedSummary: string }>("/api/mentorship/case-review", { rawDescription }, AI_TIMEOUT_MS);
      setAnonymized(res.anonymizedSummary);
    } catch { setAnonymized("Anonymization failed. Review carefully before posting."); }
    finally { setProcessing(false); }
  };

  const publish = async () => {
    if (!anonymized) return;
    setPublishing(true);
    try {
      await api.put("/api/mentorship/case-review", { patternSummary: anonymized });
      setPosted(true);
      setAnonymized(null);
      setRawDescription("");
      load();
    } catch { }
    finally { setPublishing(false); }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Peer Case Review
        </CardTitle>
        <CardDescription className="text-xs">
          Share anonymized patterns for peer consultation. AI strips identifying details.
        </CardDescription>
        <div className="flex gap-1 mt-2">
          <button onClick={() => setTab("browse")} className={`px-2 py-1 text-[10px] rounded-md border ${tab === "browse" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>Browse</button>
          <button onClick={() => setTab("post")} className={`px-2 py-1 text-[10px] rounded-md border ${tab === "post" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>Post a case</button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tab === "browse" && (
          <>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!loading && reviews.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No open cases from peers. Check back later.</p>
            )}
            {reviews.map(r => (
              <div key={r.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-foreground">{r.patternSummary}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                  {r._count && r._count.responses > 0 && (
                    <span className="text-[10px] text-primary">{r._count.responses} response(s)</span>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "post" && (
          <>
            <Textarea
              value={rawDescription}
              onChange={e => setRawDescription(e.target.value)}
              placeholder="Describe the behavioral pattern (names will be stripped by AI)..."
              className="bg-background border-border text-sm min-h-[80px]"
              disabled={processing}
            />
            <Button onClick={anonymize} disabled={processing || !rawDescription.trim()} size="sm" className="bg-primary text-primary-foreground">
              {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
              Anonymize
            </Button>

            {anonymized && (
              <div className="space-y-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Review anonymized version:</p>
                <p className="text-xs text-foreground">{anonymized}</p>
                <p className="text-[10px] text-muted-foreground">Verify no names/dates/identifying details remain before posting.</p>
                <div className="flex gap-2">
                  <Button onClick={publish} disabled={publishing} size="sm" className="bg-emerald-600 text-white h-7 text-xs">
                    {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Post for peers
                  </Button>
                  <Button onClick={() => setAnonymized(null)} variant="outline" size="sm" className="border-border h-7 text-xs">Discard</Button>
                </div>
              </div>
            )}

            {posted && (
              <div className="flex items-center gap-2 text-xs text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Case posted for peer review.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
