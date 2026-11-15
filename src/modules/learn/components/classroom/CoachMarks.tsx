"use client";

// src/modules/learn/components/classroom/CoachMarks.tsx — first-visit
// orientation. Copy describes the REAL classroom (audit A9: the old
// copy pointed at a "Start learning" button, an avatar and a topics
// drawer that no longer exist — first-contact lies destroy trust).

import { CheckCircle2, ChevronRight, MessageSquare, Mic, Map as MapIcon, Focus } from "lucide-react";

export function CoachMarks({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="Welcome to your classroom" className="w-full max-w-md rounded-lg bg-bg p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-fg">Welcome to your classroom</h3>
        <ul className="mt-3 space-y-2 text-sm text-fg-muted">
          <li className="flex gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden />
            The lesson starts by itself — slides appear one at a time in the center.
          </li>
          <li className="flex gap-2">
            <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden />
            Your <b>AI tutor</b> narrates in the chat and answers questions any time — typed or spoken.
          </li>
          <li className="flex gap-2">
            <Mic className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden />
            Tap the mic to <b>ask by voice</b> — just speak your question.
          </li>
          <li className="flex gap-2">
            <MapIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden />
            The left rail opens your <b>journey map</b>, project, growth and notes.
          </li>
          <li className="flex gap-2">
            <Focus className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden />
            <b>Focus mode</b> (top-right) hides the chat for distraction-free reading.
          </li>
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Got it
        </button>
      </div>
    </div>
  );
}
