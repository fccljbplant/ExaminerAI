"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  GraduationCap,
  Award,
  MessageSquare,
  Trophy,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * NotificationBell — top-bar bell with unread badge + dropdown panel.
 *
 * Polls `/api/notifications` every 30 seconds for fresh items. Clicking a
 * notification marks it as read and navigates to its `link`. Includes a
 * "Mark all as read" action.
 */

type NotificationType =
  | "enrollment"
  | "course_completed"
  | "credential_earned"
  | "message_received"
  | "milestone_earned";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

const POLL_INTERVAL_MS = 30_000;

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  enrollment: GraduationCap,
  course_completed: Check,
  credential_earned: Award,
  message_received: MessageSquare,
  milestone_earned: Trophy,
};

const TYPE_TINT: Record<NotificationType, string> = {
  enrollment: "bg-primary/15 text-primary",
  course_completed: "bg-emerald-500/15 text-emerald-500",
  credential_earned: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  message_received: "bg-sky-500/15 text-sky-500",
  milestone_earned: "bg-violet-500/15 text-violet-500",
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(1, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const initialFetchRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<NotificationsResponse>("/api/notifications");
      setItems(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Silently ignore — the bell is non-critical UI. Don't toast errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    void fetchNotifications();
  }, [fetchNotifications]);

  // Poll every 30 seconds while mounted.
  useEffect(() => {
    const id = setInterval(() => {
      void fetchNotifications();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Refresh when the popover opens (user is actively looking).
  useEffect(() => {
    if (open) void fetchNotifications();
  }, [open, fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await api.patch("/api/notifications", {});
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore — non-critical
    } finally {
      setMarkingAll(false);
    }
  }, [unreadCount]);

  const handleNotificationClick = useCallback(
    async (notification: NotificationItem) => {
      // Optimistic mark-read.
      if (!notification.read) {
        setItems((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        try {
          await api.patch("/api/notifications", { id: notification.id });
        } catch {
          // ignore — non-critical
        }
      }
      setOpen(false);
      if (notification.link) {
        // Use full-page navigation so deep links like /app?course=... work.
        window.location.href = notification.link;
      }
    },
    []
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-card">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {markingAll ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            <span className="ml-1">Mark all read</span>
          </Button>
        </div>

        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                New enrollments, credentials, and messages will show here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const tint = TYPE_TINT[n.type] ?? "bg-muted text-muted-foreground";
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        "w-full text-left px-3 py-3 flex items-start gap-3 transition-colors hover:bg-accent/50",
                        !n.read && "bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg",
                          tint
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-xs leading-snug",
                              !n.read
                                ? "font-semibold text-foreground"
                                : "font-medium text-muted-foreground"
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
