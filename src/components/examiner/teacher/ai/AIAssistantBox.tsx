"use client";

/**
 * AIAssistantBox — AI query box on the Today view.
 *
 * Free-text question → synthesized answer with reasoning + clickable
 * student references. Uses the configured AI model (callAI) via
 * /api/teacher/assistant — the AI Assistant.
 *
 * Keeps the last 5 queries in-session (not persisted).
 */

import { useState } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Send, ChevronRight } from "lucide-react";
import type { StudentRow } from "@/components/examiner/teacher/types";

interface AIAssistantResponse {
  answer: string;
  references: Array<{
    userId: string;
    name: string;
    tier: string | null;
    week: number;
  }>;
}

interface AIAssistantBoxProps {
  students: StudentRow[];
  onStudentClick: (student: StudentRow) => void;
}

const SUGGESTED_QUESTIONS = [
  "Who's likely to drop off in the next two weeks?",
  "Which students are overconfident but struggling?",
  "Who hasn't been contacted in over a week?",
  "Which topics are causing the most difficulty?",
];

export function AIAssistantBox({ students, onStudentClick }: AIAssistantBoxProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIAssistantResponse | null>(null);
  const [history, setHistory] = useState<Array<{ question: string; response: AIAssistantResponse }>>([]);

  const ask = async (q?: string) => {
    const query = (q || question).trim();
    if (!query) return;
    setLoading(true);
    setQuestion(query);
    try {
      const res = await api.post<AIAssistantResponse>("/api/teacher/assistant", { question: query }, AI_TIMEOUT_MS);
      setResponse(res);
      setHistory(prev => [{ question: query, response: res }, ...prev].slice(0, 5));
    } catch {
      setResponse({
        answer: "I wasn't able to process your question right now. Please try again.",
        references: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </CardTitle>
        <CardDescription className="text-xs">
          Ask a question about your class. The AI analyzes your student data and cites specific evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
            placeholder="Ask about your class..."
            disabled={loading}
            className="bg-background border-border"
          />
          <Button
            onClick={() => ask()}
            disabled={loading || !question.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {!response && !loading && (
          <div className="flex flex-wrap gap-1">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="px-2 py-1 text-[10px] rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Analyzing your class...</span>
          </div>
        )}

        {response && !loading && (
          <div className="space-y-2">
            <div className="rounded-lg bg-background border border-border p-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">{response.answer}</p>
            </div>

            {response.references.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Referenced students:</p>
                {response.references.map(ref => {
                  const student = students.find(s => s.id === ref.userId);
                  return (
                    <button
                      key={ref.userId}
                      onClick={() => student && onStudentClick(student)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{ref.name}</span>
                        {ref.tier && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                            ref.tier === "red" ? "bg-red-500/10 text-red-600" :
                            ref.tier === "warning" ? "bg-amber-500/10 text-amber-600" :
                            "bg-emerald-500/10 text-emerald-600"
                          }`}>
                            {ref.tier}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">Week {ref.week}</span>
                      </div>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {history.length > 1 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Recent questions:</p>
            {history.slice(1).map((h, i) => (
              <button
                key={i}
                onClick={() => { setResponse(h.response); setQuestion(h.question); }}
                className="block w-full text-left text-xs text-muted-foreground hover:text-foreground truncate py-0.5"
              >
                {h.question}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
