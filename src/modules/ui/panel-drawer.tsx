"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * modules/ui/panel-drawer.tsx — the classroom's slide-over drawer.
 *
 * One drawer shell for every classroom panel (journey / project / grow /
 * library) so headers, backdrops, ESC handling and focus behavior stay
 * identical (audit A6: three copy-pasted drawer shells had drifted).
 * Escape closes, backdrop click closes, body scroll locks while open.
 */

interface PanelDrawerProps {
 /** Accessible name shown in the drawer header. */
 title: string;
 /** Icon + label pairing in the header (optional). */
 icon?: ReactNode;
 open: boolean;
 onClose: () => void;
 children: ReactNode;
}

export function PanelDrawer({ title, icon, open, onClose, children }: PanelDrawerProps) {
 // Escape closes + body scroll lock while open.
 useEffect(() => {
 if (!open) return;
 const onKey = (e: KeyboardEvent) => {
 if (e.key === "Escape") onClose();
 };
 document.addEventListener("keydown", onKey);
 const prevOverflow = document.body.style.overflow;
 document.body.style.overflow = "hidden";
 return () => {
 document.removeEventListener("keydown", onKey);
 document.body.style.overflow = prevOverflow;
 };
 }, [open, onClose]);

 if (!open) return null;

 return (
 <div className="fixed inset-0 z-[var(--p-z-drawer)] flex">
 <div
 className="absolute inset-0 bg-black/30"
 onClick={onClose}
 aria-hidden
 />
 <div
 role="dialog"
 aria-modal="true"
 aria-label={title}
 className="relative z-10 flex w-full max-w-full flex-col border-r border-line bg-bg shadow-xl animate-in slide-in-from-left sm:w-[480px]"
 >
 <div className="flex h-14 flex-shrink-0 items-center justify-between gap-2 border-b border-line px-4">
 <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg">
 {icon}
 <span className="truncate">{title}</span>
 </h2>
 <button
 type="button"
 onClick={onClose}
 aria-label={`Close ${title}`}
 className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
 >
 <X className="h-4 w-4" aria-hidden />
 </button>
 </div>
 <div className="flex-1 overflow-hidden">{children}</div>
 </div>
 </div>
 );
}
