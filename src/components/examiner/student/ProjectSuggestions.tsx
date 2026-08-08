"use client";

/**
 * ProjectSuggestions — fetches AI-generated project ideas based on course content.
 * Shows 5 suggestions the student can pick from or use as inspiration.
 */

import { useState } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

interface Suggestion {
  name: string;
  type: string;
  description: string;
  why: string;
  difficulty: string;
  keyFeatures: string[];
}

export function ProjectSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ suggestions: Suggestion[]; message?: string }>(
        "/api/project/suggestions",
        undefined,
        AI_TIMEOUT_MS
      );
      setSuggestions(res.suggestions || []);
      if (res.message && res.suggestions.length === 0) {
        setError(res.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate suggestions right now.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  if (!loaded && !loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-center">
          <Lightbulb className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">Not sure what to build?</p>
          <p className="text-xs text-muted-foreground mb-3">
            Get 5 AI-generated project ideas based on your course content.
          </p>
          <Button onClick={fetchSuggestions} size="sm" variant="outline" className="border-primary/30">
            <Sparkles className="h-3 w-3 mr-1" /> Get Project Ideas
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Generating project ideas from your course...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button onClick={fetchSuggestions} size="sm" variant="ghost" className="mt-2 text-xs">
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" /> AI Project Suggestions
          <Badge variant="outline" className="text-[9px] ml-auto">{suggestions.length} ideas</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((s, i) => (
          <div key={i} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                  <Badge variant="outline" className="text-[8px] flex-shrink-0">{s.type}</Badge>
                  <Badge
                    variant="outline"
                    className={`text-[8px] flex-shrink-0 ${
                      s.difficulty === "beginner" ? "text-growth-sage" :
                      s.difficulty === "intermediate" ? "text-growth-amber" :
                      "text-destructive"
                    }`}
                  >
                    {s.difficulty}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
              </div>
              <Button
                onClick={() => setExpanded(expanded === i ? null : i)}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 flex-shrink-0"
              >
                {expanded === i ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
            {expanded === i && (
              <div className="mt-2 pt-2 border-t border-border space-y-1">
                <p className="text-[10px] text-muted-foreground"><strong>Why:</strong> {s.why}</p>
                <div className="flex flex-wrap gap-1">
                  {s.keyFeatures.map((f, j) => (
                    <Badge key={j} variant="secondary" className="text-[8px]">{f}</Badge>
                  ))}
                </div>
                <p className="text-[10px] text-primary mt-1">
                  💡 Use this as inspiration when filling out the project form below.
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
