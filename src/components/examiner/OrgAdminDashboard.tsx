"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Users, UserPlus, BookOpen, Loader2, Trash2, CheckCircle2, XCircle } from "lucide-react";

interface Member {
  id: string;
  role: string;
  seat: boolean;
  status: string;
  joined: string;
  user: { id: string; name: string; email: string; lastLogin: string | null };
}

interface OrgData {
  org: { id: string; name: string; slug: string; plan: string; seats: number };
  members: Member[];
  stats: { memberCount: number; seatsUsed: number; seatsTotal: number; orgName: string; plan: string };
}

export default function OrgAdminDashboard() {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteSeat, setInviteSeat] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<OrgData>("/api/org");
      setData(res);
    } catch { toast.error("Failed to load organization data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/org/members", { email: inviteEmail, role: inviteRole, seat: inviteSeat });
      toast.success(`Invited ${inviteEmail}`);
      setInviteOpen(false); setInviteEmail(""); setInviteRole("member"); setInviteSeat(false);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to invite"); }
    finally { setBusy(false); }
  };

  const toggleSeat = async (memberId: string, currentSeat: boolean) => {
    try {
      await api.patch(`/api/org/members/${memberId}`, { seat: !currentSeat });
      toast.success(currentSeat ? "Seat removed" : "Seat assigned");
      await load();
    } catch { toast.error("Failed to update seat"); }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this member from the organization?")) return;
    try {
      await api.del(`/api/org/members/${memberId}`);
      toast.success("Member removed");
      await load();
    } catch { toast.error("Failed to remove member"); }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <Card><CardContent className="p-6 text-center text-muted-foreground">No organization found.</CardContent></Card>;

  const { org, stats } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> {org.name}</h1>
          <p className="text-sm text-muted-foreground">Plan: <Badge variant="outline" className="capitalize">{org.plan}</Badge></p>
        </div>
        <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4 mr-1" /> Invite Member</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.memberCount}</div><div className="text-xs text-muted-foreground">Members</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.seatsUsed}/{stats.seatsTotal}</div><div className="text-xs text-muted-foreground">Seats Used</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{data.members.filter(m => m.role === "mentor").length}</div><div className="text-xs text-muted-foreground">Mentors</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{data.members.filter(m => m.status === "invited").length}</div><div className="text-xs text-muted-foreground">Pending Invites</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Team Members</CardTitle></CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No members yet. Invite your team!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-2">Name</th><th className="text-left">Email</th><th className="text-left">Role</th><th className="text-center">Seat</th><th className="text-left">Last Active</th><th></th></tr></thead>
                <tbody>
                  {data.members.map(m => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{m.user.name}</td>
                      <td className="text-muted-foreground">{m.user.email}</td>
                      <td><Badge variant="outline" className="capitalize">{m.role}</Badge></td>
                      <td className="text-center">
                        <button onClick={() => toggleSeat(m.id, m.seat)} className="inline-flex">
                          {m.seat ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </td>
                      <td className="text-xs text-muted-foreground">{m.user.lastLogin ? new Date(m.user.lastLogin).toLocaleDateString() : "—"}</td>
                      <td><button onClick={() => removeMember(m.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" /></div>
            <div><Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member (Learner)</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="seat" checked={inviteSeat} onChange={(e) => setInviteSeat(e.target.checked)} className="rounded" />
              <Label htmlFor="seat" className="text-sm">Assign a paid seat</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={inviteMember} disabled={busy || !inviteEmail.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
