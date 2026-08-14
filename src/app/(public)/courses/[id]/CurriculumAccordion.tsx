"use client";

/**
 * CurriculumAccordion — compact, professional curriculum viewer for the
 * public course detail page. Replaces the old tall-card-per-week layout
 * (which used ~60% of the page height) with a single-row-per-week
 * accordion where days expand inline.
 *
 * Behaviour:
 *   - Each week renders as one row: "Week N · Phase · D days · Milestone".
 *   - Clicking a week toggles an inline day list (text-xs).
 *   - First 4 weeks are expanded by default.
 *   - If there are >4 weeks, the remaining weeks render collapsed and a
 *     "Show all N weeks" button expands every week.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { Badge } from "@/modules/ui/badge";
import { Button } from "@/modules/ui/button";
import { cn } from "@/lib/utils";

export interface CurriculumWeek {
  id: string;
  weekNumber: number;
  phase: string;
  milestone: string;
  days: Array<{
    id: string;
    day: number;
    title: string;
    objective: string;
  }>;
}

interface Props {
  weeks: CurriculumWeek[];
  totalDays: number;
}

const INITIAL_EXPANDED_COUNT = 4;

export default function CurriculumAccordion({ weeks, totalDays }: Props) {
  const hasManyWeeks = weeks.length > INITIAL_EXPANDED_COUNT;
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    // Expand the first N weeks by default (or all if there are <= 4).
    const limit = hasManyWeeks ? INITIAL_EXPANDED_COUNT : weeks.length;
    for (let i = 0; i < limit; i++) initial.add(i);
    return initial;
  });
  const [showAll, setShowAll] = useState(!hasManyWeeks);

  const toggle = (idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAll = () => {
    setShowAll(true);
    setExpanded(new Set(weeks.map((_, i) => i)));
  };

  // When showAll is true we render every week; otherwise we render only
  // the first INITIAL_EXPANDED_COUNT weeks (and the rest stay collapsed
  // but visible behind the toggle is overkill — instead we hide them
  // behind the "Show all" button per the spec).
  const visibleWeeks = showAll ? weeks : weeks.slice(0, INITIAL_EXPANDED_COUNT);
  const hiddenCount = weeks.length - visibleWeeks.length;

  return (
    <div className="space-y-1.5">
      {visibleWeeks.map((week, idx) => {
        const isOpen = expanded.has(idx);
        return (
          <div
            key={week.id}
            className={cn(
              "rounded-md border border-line bg-surface/40 overflow-hidden transition-colors",
              isOpen && "bg-surface/80 border-brand/30"
            )}
          >
            {/* Header row — single line, click to expand */}
            <button
              type="button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-subtle/40 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-fg-muted flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-fg-muted flex-shrink-0" />
              )}
              <Badge variant="outline" className="text-[10px] text-brand border-brand/30 flex-shrink-0">
                W{week.weekNumber}
              </Badge>
              <span className="font-medium text-fg truncate flex-1">{week.phase}</span>
              <span className="text-[10px] text-fg-muted flex-shrink-0">
                {week.days.length} {week.days.length === 1 ? "day" : "days"}
              </span>
              {week.milestone && (
                <Badge variant="outline" className="text-[10px] ml-1 flex-shrink-0">
                  {week.milestone}
                </Badge>
              )}
            </button>

            {/* Day list — compact, one line per day */}
            {isOpen && (
              <ul className="border-t border-line/60 px-3 py-2 space-y-1">
                {week.days.map((day) => (
                  <li
                    key={day.id}
                    className="flex items-start gap-2 text-xs leading-relaxed"
                  >
                    <span className="font-mono text-fg-muted/80 mt-0.5 flex-shrink-0 w-6">
                      D{day.day}
                    </span>
                    <span className="font-medium text-fg/90">{day.title}</span>
                    {day.objective && (
                      <span className="text-fg-muted truncate">— {day.objective}</span>
                    )}
                  </li>
                ))}
                {week.days.length === 0 && (
                  <li className="text-xs text-fg-muted italic flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3" /> Days to be announced
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}

      {/* "Show all N weeks" — only when there are hidden weeks */}
      {hiddenCount > 0 && !showAll && (
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="w-full border-dashed text-fg-muted hover:text-fg"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Show all {weeks.length} weeks ({hiddenCount} hidden)
          </Button>
        </div>
      )}
    </div>
  );
}
