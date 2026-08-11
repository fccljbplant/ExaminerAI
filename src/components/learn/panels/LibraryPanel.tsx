"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, ExternalLink, Plus, FileText, BookOpen, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface Resource {
  label: string;
  url: string;
}

interface Note {
  id: string;
  content: string;
  slideId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ResourceData {
  resources: Resource[];
  topic: { week: number; day: number; title: string; objective: string; phase: string } | null;
}

interface Props {
  courseId: string;
  slideId: string | null;
}

export function LibraryPanel({ courseId, slideId }: Props) {
  const [tab, setTab] = useState<"resources" | "notes">("resources");
  const [resourceData, setResourceData] = useState<ResourceData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchResources = useCallback(async () => {
    try {
      const url = slideId
        ? `/api/learn/resources?courseId=${courseId}&slideId=${slideId}`
        : `/api/learn/resources?courseId=${courseId}`;
      const res = await api.get<{ data: ResourceData }>(url);
      setResourceData(res.data);
    } catch (e) {
      toast.error("Couldn't load resources", { description: e instanceof Error ? e.message : undefined });
    }
  }, [courseId, slideId]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await api.get<{ data: { notes: Note[] } }>(`/api/learn/notes?courseId=${courseId}`);
      setNotes(res.data.notes);
    } catch (e) {
      toast.error("Couldn't load notes", { description: e instanceof Error ? e.message : undefined });
    }
  }, [courseId]);

  useEffect(() => {
    Promise.all([fetchResources(), fetchNotes()]).finally(() => setLoading(false));
  }, [fetchResources, fetchNotes]);

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteInput.trim()) return;
    setSavingNote(true);
    try {
      const res = await api.post<{ data: { note: Note } }>(
        `/api/learn/notes`,
        { courseId, slideId: slideId ?? undefined, content: noteInput.trim() },
      );
      setNotes(prev => [res.data.note, ...prev]);
      setNoteInput("");
      toast.success("Note saved");
    } catch (e) {
      toast.error("Couldn't save note", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 py-4 border-b">
        <h2 className="text-lg font-semibold">Library</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Curated resources and your private notes.</p>
        <div className="mt-3 inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
          <button
            onClick={() => setTab("resources")}
            className={cn("px-3 py-1 rounded inline-flex items-center gap-1.5", tab === "resources" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
          >
            <BookOpen className="h-3.5 w-3.5" /> Resources
          </button>
          <button
            onClick={() => setTab("notes")}
            className={cn("px-3 py-1 rounded inline-flex items-center gap-1.5", tab === "notes" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
          >
            <StickyNote className="h-3.5 w-3.5" /> Notes
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === "resources" && (
          <section>
            {resourceData?.topic && (
              <div className="mb-4 rounded-md bg-muted/40 p-3 text-sm">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Week {resourceData.topic.week} Day {resourceData.topic.day} · {resourceData.topic.phase}
                </div>
                <p className="font-medium mt-0.5">{resourceData.topic.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{resourceData.topic.objective}</p>
              </div>
            )}
            {resourceData?.resources && resourceData.resources.length > 0 ? (
              <ul className="space-y-2">
                {resourceData.resources.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
                    >
                      <FileText className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{r.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.url}</p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No curated resources for this topic yet.</p>
            )}
          </section>
        )}

        {tab === "notes" && (
          <section>
            <form onSubmit={saveNote} className="mb-4">
              <textarea
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Jot down a quick note about what you just learned..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                maxLength={5000}
              />
              <button
                type="submit"
                disabled={savingNote || !noteInput.trim()}
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Save note
              </button>
            </form>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet. Notes you save will appear here in reverse-chronological order.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map(n => (
                  <li key={n.id} className="rounded-md border p-3 text-sm">
                    <p className="whitespace-pre-wrap leading-relaxed">{n.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(n.createdAt).toLocaleString()}
                      {n.slideId && " · linked to current slide"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
