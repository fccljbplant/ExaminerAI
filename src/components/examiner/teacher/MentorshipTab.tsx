"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  GraduationCap, HeartHandshake, Plus, Download,
} from "lucide-react";
import type { StudentRow } from "@/components/examiner/teacher/types";

export function MentorshipTab({ students, onCompose }: { students: StudentRow[]; onCompose: (studentId: string) => void }) {
  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Student Outreach
          </CardTitle>
          <CardDescription className="text-muted-foreground">Quick message any student who needs a check-in</CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No students yet.</p>
          ) : (
            <div className="space-y-1.5">
              {students.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    {s.needsAttention && <span className="h-2 w-2 rounded-full bg-red-500" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Week {s.currentWeek} · {s.progress}% progress
                        {s.latestScore !== null && ` · ${s.latestScore}% score`}
                        {s.attentionReasons && s.attentionReasons.length > 0 && ` · ${s.attentionReasons[0]}`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onCompose(s.id)} className="border-border h-7 text-xs">
                    <Mail className="h-3 w-3" /> Message
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Mentorship Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>• Students with red dots need the most attention — message them first.</p>
          <p>• Use the Today view to see crisis flags, overdue touchpoints, and unread messages in one urgency-sorted list.</p>
          <p>• Check the Students roster for emotional/behavioral patterns and academic performance trends per student.</p>
          <p>• Comment directly on student work (check-ins, tasks, tests) for specific feedback.</p>
        </CardContent>
      </Card>
    </div>
  );
}
