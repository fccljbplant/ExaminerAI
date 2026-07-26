"use client";
import { showError } from "@/lib/toast-helpers";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Loader2, Send, Inbox, ArrowUpRight, Trash2, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";

interface Message {
  id: string;
  fromId: string;
  toId: string;
  subject: string | null;
  body: string;
  sentAt: string;
  isRead: boolean;
  reply: string | null;
  repliedAt: string | null;
  from: { name: string; email: string };
  to: { name: string; email: string };
}
interface UserRow { id: string; email: string; name: string; role: string; }

export default function Messages() {
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [toId, setToId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (pageNum?: number) => {
    setLoading(true);
    try {
      const box = tab === "inbox" ? "received" : "sent";
      const p = pageNum ?? page;
      const res = await api.get<{ messages: Message[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/messages?box=${box}&page=${p}&pageSize=20`);
      setMessages(res.messages);
      if (res.pagination) setPagination(res.pagination);
      // Load users (teacher or admin sees everyone; student sees teachers+admin)
      const usersRes = await api.get<{ users: UserRow[] }>("/api/users").catch(() => ({ users: [] as UserRow[] }));
      setUsers(usersRes.users);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { setPage(1); load(1); }, [tab]);  
  useEffect(() => { load(); }, [page]);  

  const markRead = async (id: string) => {
    try {
      await api.patch(`/api/messages/${id}/read`, {});
      load();
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post("/api/messages/mark-all-read");
      load();
    } catch { /* ignore */ }
    finally { setMarkingAll(false); }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    try {
      await api.del(`/api/messages/${id}`);
      load();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to delete message");
    }
  };

  const send = async () => {
    if (!toId || !body.trim()) return;
    setSending(true);
    try {
      await api.post("/api/messages", { toId, subject, body });
      setComposeOpen(false); setToId(""); setSubject(""); setBody("");
      if (tab !== "sent") setTab("sent");
      else load();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Messages</CardTitle>
              <CardDescription className="text-muted-foreground">Send and receive messages with teachers and students</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {tab === "inbox" && messages.some(m => !m.isRead) && (
                <Button onClick={markAllRead} disabled={markingAll} variant="outline" size="sm" className="border-border">
                  {markingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                  Mark all read
                </Button>
              )}
              <Button onClick={() => setComposeOpen(true)} size="sm" className="bg-primary hover:bg-primary/90 text-foreground">
                <Send className="h-4 w-4" /> Compose
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "inbox" | "sent")}>
            <TabsList className="bg-muted">
              <TabsTrigger value="inbox"><Inbox className="h-3 w-3 mr-1" /> Inbox</TabsTrigger>
              <TabsTrigger value="sent"><ArrowUpRight className="h-3 w-3 mr-1" /> Sent</TabsTrigger>
            </TabsList>

            <TabsContent value="inbox" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Mail className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No messages in your inbox.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Messages from your teacher will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className={`rounded-md p-3 border ${m.isRead ? "bg-muted/50 border-border" : "bg-primary/10 border-primary/40"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {!m.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                          <span className="text-sm font-medium text-foreground">{m.from.name}</span>
                          <span className="text-xs text-muted-foreground">{m.from.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(m.sentAt).toLocaleString()}</span>
                          <button
                            onClick={() => deleteMessage(m.id)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete this message" aria-label="Delete message"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80">{m.subject ?? "(no subject)"}</p>
                      <p className="text-sm text-muted-foreground mt-1">{m.body}</p>
                      {!m.isRead && (
                        <Button onClick={() => markRead(m.id)} size="sm" variant="ghost" className="mt-2 h-6 text-xs text-muted-foreground">
                          Mark as read
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Mail className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No sent messages.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Click "Compose" to send a message.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className="rounded-md p-3 bg-muted/50 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">To: {m.to.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(m.sentAt).toLocaleString()}</span>
                          <button
                            onClick={() => deleteMessage(m.id)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete this message" aria-label="Delete message"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80">{m.subject ?? "(no subject)"}</p>
                      <p className="text-sm text-muted-foreground mt-1">{m.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} messages
              </div>
              <div className="flex items-center gap-1">
                <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page <= 1 || loading} variant="outline" size="sm" className="h-7 px-2 border-border">
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">Page {pagination.page} of {pagination.totalPages}</span>
                <Button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages || loading} variant="outline" size="sm" className="h-7 px-2 border-border">
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">New Message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground">To</Label>
              {users.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recipients available — students can only message teachers/admins.</p>
              ) : (
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Select recipient..." /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.id).map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email}) — {u.role}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Message</Label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full min-h-32 rounded-md bg-muted border border-border p-3 text-sm text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={send} disabled={sending || !toId || !body.trim()} className="bg-primary hover:bg-primary/90 text-foreground">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
