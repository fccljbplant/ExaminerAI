"use client";

import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import type { CommentRow } from "./types";

/** TeacherComments — shows teacher comments attached to a specific entity
 *  (interaction, task, daily log, or weekly test).
 *
 *  Phase 5.1: Extracted from StudentDashboard.tsx. Shared by multiple panels.
 */
export function TeacherComments({ comments, entityId, field }: {
  comments: CommentRow[];
  entityId: string;
  field: "interactionId" | "taskId" | "dailyLogId" | "weeklyTestId";
}) {
  const relevant = comments.filter(c => c[field] === entityId);
  if (relevant.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {relevant.map(c => (
        <div key={c.id} className="rounded-md bg-primary/10 border border-primary/20 p-1.5 text-[11px]">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-medium text-primary flex items-center gap-1">
              <MessageSquare className="h-2.5 w-2.5" /> {c.teacher.name}
            </span>
            {c.marksOverride !== null && (
              <Badge variant="outline" className="text-[8px] border-primary/30 text-primary">Score: {c.marksOverride}%</Badge>
            )}
          </div>
          {c.body && <p className="text-foreground/80 leading-snug">{c.body}</p>}
        </div>
      ))}
    </div>
  );
}
