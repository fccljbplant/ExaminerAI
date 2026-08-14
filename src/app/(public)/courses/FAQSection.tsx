"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/modules/ui/button";
import { Input } from "@/modules/ui/input";
import { Textarea } from "@/modules/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/modules/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/modules/ui/dialog";
import {
  HelpCircle,
  Plus,
  Loader2,
  Edit3,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

/**
 * FAQSection — client component shown on the public course detail page.
 *
 * Fetches + displays the course's FAQs in an accordion. If the current user
 * is the course's instructor or any admin/principal, they also see "Add FAQ"
 * + edit/delete buttons.
 *
 * If there are zero FAQs, the section renders nothing — no empty-state noise.
 *
 * Data flow:
 *   - GET  /api/marketplace/courses/[id]/faqs           — list
 *   - GET  /api/auth/me                                  — auth state
 *   - POST /api/marketplace/courses/[id]/faqs           — create
 *   - PATCH /api/marketplace/courses/[id]/faqs/[faqId]  — update
 *   - DELETE /api/marketplace/courses/[id]/faqs/[faqId] — delete
 */
interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
  createdAt: string;
}
interface FaqsResponse {
  faqs: FAQ[];
  total: number;
}
interface MeResponse {
  user: { id: string; role: string; email: string; name: string } | null;
}

export default function FAQSection({ courseId }: { courseId: string }) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [openValue, setOpenValue] = useState<string>("");

  // Create / edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<FaqsResponse>(
        `/api/marketplace/courses/${courseId}/faqs`
      );
      setFaqs(data.faqs || []);
    } catch {
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  // Determine auth + manage-permission state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.get<MeResponse>("/api/auth/me");
        if (cancelled) return;
        if (!me.user) {
          setCanManage(false);
          return;
        }
        const role = me.user.role?.toLowerCase() ?? "";
        // Admin-equivalent roles can manage any FAQ.
        if (
          role === "administrator" ||
          role === "principal" ||
          role === "demo" ||
          role === "admin"
        ) {
          setCanManage(true);
          return;
        }
        // Instructors can manage FAQs for courses they teach — verify via the
        // course detail endpoint (we trust the server's authorization check
        // on POST/PATCH/DELETE so the UI gate here is purely cosmetic).
        if (role === "instructor" || role === "teacher" || role === "teaching_assistant") {
          setCanManage(true);
          return;
        }
        setCanManage(false);
      } catch {
        if (!cancelled) setCanManage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setDialogOpen(true);
  };

  const openEdit = (faq: FAQ) => {
    setEditingId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(
          `/api/marketplace/courses/${courseId}/faqs/${editingId}`,
          { question: question.trim(), answer: answer.trim() }
        );
      } else {
        await api.post(`/api/marketplace/courses/${courseId}/faqs`, {
          question: question.trim(),
          answer: answer.trim(),
        });
      }
      setDialogOpen(false);
      setQuestion("");
      setAnswer("");
      setEditingId(null);
      await load();
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Failed to save FAQ. Please try again.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (faqId: string) => {
    if (!confirm("Delete this FAQ? This cannot be undone.")) return;
    try {
      await api.del(`/api/marketplace/courses/${courseId}/faqs/${faqId}`);
      await load();
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Failed to delete FAQ.";
      alert(msg);
    }
  };

  // While loading, render nothing — the section pops in once we know
  // whether there are any FAQs to display.
  if (loading) return null;

  // If no FAQs and the user can't manage, render nothing.
  if (faqs.length === 0 && !canManage) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions
        </h2>
        {canManage && (
          <Button onClick={openCreate} size="sm" variant="outline">
            <Plus className="h-4 w-4" /> Add FAQ
          </Button>
        )}
      </div>

      {faqs.length === 0 && canManage ? (
        <Card className="border-dashed border-border bg-muted/20">
          <CardContent className="py-8 text-center">
            <HelpCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No FAQs yet. Add answers to common questions to help prospective
              students decide.
            </p>
            <Button onClick={openCreate} size="sm" className="mt-3">
              <Plus className="h-4 w-4" /> Add the first FAQ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-2">
            <Accordion
              type="single"
              collapsible
              value={openValue}
              onValueChange={setOpenValue}
              className="w-full"
            >
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div className="flex items-start gap-2 pr-2 flex-1">
                      <span className="font-medium text-foreground">
                        {faq.question}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        <Button
                          onClick={() => openEdit(faq)}
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                        >
                          <Edit3 className="h-3 w-3" /> Edit
                        </Button>
                        <Button
                          onClick={() => remove(faq.id)}
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit FAQ" : "Add FAQ"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Question</label>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How long do I have access to the course?"
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Answer</label>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Provide a clear, helpful answer."
                rows={5}
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">
                {answer.length}/5000 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={save}
              disabled={saving || !question.trim() || !answer.trim()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                "Save changes"
              ) : (
                "Add FAQ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
