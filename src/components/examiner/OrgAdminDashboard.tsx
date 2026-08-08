"use client";
// OrgAdminDashboard — modernized.
// Uses DashboardShell + PageHeader + StatStrip + states kit + AlertDialog.
// Consistent with every other role dashboard.

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Building2, Users, UserPlus, Loader2, Trash2,
  CheckCircle2, XCircle, Mail, Crown, Clock, BookOpen,
} from "lucide-react";
import { DashboardHeader } from "@/components/shared/dashboard-shell";
import { StatCard, StatStrip } from "@/components/shared/stat-card";
import { SkeletonPanel, EmptyState } from "@/components/ui/states";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { COPY } from "@/content/copy";
import { OrgCourseAssigner } from "@/modules/b2b";

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
    } catch {
      toast.error("Failed to load organization data");
    } finally {
      setLoading(false);
    }
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  };

  const toggleSeat = async (memberId: string, currentSeat: boolean) => {
    try {
      await api.patch(`/api/org/members/${memberId}`, { seat: !currentSeat });
      toast.success(currentSeat ? "Seat removed" : "Seat assigned");
      await load();
    } catch {
      toast.error("Failed to update seat");
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await api.del(`/api/org/members/${memberId}`);
      toast.success("Member removed");
      await load();
    } catch {
      toast.error("Failed to remove member");
    }
  };

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          crumbs={[{ label: "Org Admin" }]}
          title="Loading organization…"
          subtitle="Fetching team members and seat usage"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
          <SkeletonPanel lines={1} className="h-24" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonPanel key={i} lines={2} className="h-24" />
            ))}
          </div>
          <SkeletonPanel lines={5} className="h-96" />
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          crumbs={[{ label: "Org Admin" }]}
          title="No organization"
          subtitle="You're not part of an organization yet"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <EmptyState
            icon="🏢"
            title="No organization found"
            hint="Contact your platform administrator to be added to an organization."
            action={<Button variant="outline" onClick={() => load()}>Retry</Button>}
          />
        </div>
      </div>
    );
  }

  const { org, stats } = data;
  const mentorCount = data.members.filter(m => m.role === "mentor").length;
  const pendingCount = data.members.filter(m => m.status === "invited").length;
  const seatUtilization = stats.seatsTotal > 0
    ? Math.round((stats.seatsUsed / stats.seatsTotal) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <DashboardHeader
        crumbs={[
          { label: "Org Admin" },
          { label: org.name },
        ]}
        title={org.name}
        subtitle={COPY.orgSubtitle}
        chips={
          <div className="hidden sm:flex items-center gap-1.5">
            <Badge variant="outline" className="capitalize">{org.plan} plan</Badge>
            <Badge variant="outline">{stats.seatsUsed}/{stats.seatsTotal} seats</Badge>
          </div>
        }
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Stat strip — the at-a-glance numbers */}
        <StatStrip
          stats={[
            {
              value: stats.memberCount,
              label: "Members",
              icon: Users,
              tone: "info",
              hint: "Total team size",
            },
            {
              value: `${stats.seatsUsed}/${stats.seatsTotal}`,
              label: "Seats Used",
              icon: Building2,
              tone: seatUtilization >= 90 ? "danger" : seatUtilization >= 70 ? "warning" : "success",
              progress: seatUtilization,
              hint: `${seatUtilization}% utilization`,
            },
            {
              value: mentorCount,
              label: "Mentors",
              icon: Crown,
              tone: "default",
              hint: "Active instructors",
            },
            {
              value: pendingCount,
              label: "Pending",
              icon: Clock,
              tone: pendingCount > 0 ? "warning" : "default",
              hint: "Awaiting acceptance",
            },
          ]}
        />

        {/* Team members table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Team Members
              <Badge variant="secondary" className="ml-auto">{data.members.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.members.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No members yet"
                hint="Invite your first team member to get started."
                action={
                  <Button size="sm" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite Member
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto -mx-2">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="text-xs text-muted-foreground border-b">
                      <TableHead className="text-left py-2 px-2 font-medium">Name</TableHead>
                      <TableHead className="text-left px-2 font-medium">Email</TableHead>
                      <TableHead className="text-left px-2 font-medium">Role</TableHead>
                      <TableHead className="text-center px-2 font-medium">Seat</TableHead>
                      <TableHead className="text-left px-2 font-medium">Last Active</TableHead>
                      <TableHead className="px-2"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.members.map(m => (
                      <TableRow key={m.id} className="border-b last:border-0 hover:bg-muted/40 transition">
                        <TableCell className="py-2.5 px-2 font-medium text-foreground">{m.user.name}</TableCell>
                        <TableCell className="px-2 text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {m.user.email}
                          </span>
                        </TableCell>
                        <TableCell className="px-2">
                          <Badge variant="outline" className="capitalize">{m.role}</Badge>
                        </TableCell>
                        <TableCell className="px-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSeat(m.id, m.seat)}
                            className="inline-flex p-1 rounded hover:bg-muted transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={m.seat ? "Remove seat" : "Assign seat"}
                            title={m.seat ? "Remove seat" : "Assign seat"}
                          >
                            {m.seat
                              ? <CheckCircle2 className="h-4 w-4 text-growth-sage" />
                              : <XCircle className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </TableCell>
                        <TableCell className="px-2 text-xs text-muted-foreground">
                          {m.user.lastLogin ? new Date(m.user.lastLogin).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="px-2 text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex p-1.5 rounded text-destructive hover:bg-destructive/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                                aria-label="Remove member"
                                title="Remove member"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {m.user.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {m.user.name} ({m.user.email}) from your organization.
                                  They will lose access to all org resources. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeMember(m.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove member
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Course assignment — assign marketplace courses to team members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Assign Courses
              <Badge variant="secondary" className="ml-auto">{data.members.filter(m => m.role === "member").length} learners</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.members.filter(m => m.role === "member").length === 0 ? (
              <EmptyState
                icon="📚"
                title="No learners to assign"
                hint="Invite team members as 'Learner' first, then assign courses here."
              />
            ) : (
              <OrgCourseAssigner members={data.members.filter(m => m.role === "member")} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                type="email"
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Learner</SelectItem>
                  <SelectItem value="mentor">Mentor (Instructor)</SelectItem>
                  <SelectItem value="admin">Org Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="seat"
                checked={inviteSeat}
                onChange={(e) => setInviteSeat(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="seat" className="text-sm">Assign a paid seat</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={inviteMember} disabled={busy || !inviteEmail.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
