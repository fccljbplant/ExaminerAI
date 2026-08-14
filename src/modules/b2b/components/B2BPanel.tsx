"use client";
// src/components/examiner/admin/B2BPanel.tsx
// B2B management panel — organizations, seats, pipeline.
// Shows org list, seat utilization, plan breakdown, and org member counts.

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Building2, Users, RefreshCw, Loader2, TrendingUp, DollarSign } from "lucide-react";
import { StatCard } from "@/modules/ui/stat-card";
import { SkeletonPanel, EmptyState } from "@/modules/ui/states";

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
  createdAt: string;
  _count?: { members: number };
}

interface OrgListResponse {
  orgs: Org[];
}

export function B2BPanel() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.get<OrgListResponse>("/api/admin/orgs");
      setOrgs(Array.isArray(res.orgs) ? res.orgs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organizations");
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonPanel lines={1} className="h-24" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonPanel key={i} lines={2} className="h-24" />)}
        </div>
        <SkeletonPanel lines={6} className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title="Couldn't load organizations"
        hint={error}
        action={<Button onClick={load} variant="outline" size="sm">Retry</Button>}
      />
    );
  }

  const totalOrgs = orgs?.length ?? 0;
  const totalSeats = orgs?.reduce((sum, o) => sum + o.seats, 0) ?? 0;
  const totalMembers = orgs?.reduce((sum, o) => sum + (o._count?.members ?? 0), 0) ?? 0;
  const seatsUsed = totalSeats > 0 ? Math.round((totalMembers / totalSeats) * 100) : 0;

  // Plan breakdown
  const planCounts: Record<string, number> = {};
  orgs?.forEach(o => { planCounts[o.plan] = (planCounts[o.plan] || 0) + 1; });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> B2B — Organizations
          </h2>
          <p className="text-sm text-muted-foreground">Manage organizations, seats, and plans.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Organizations" value={totalOrgs} icon={Building2} tone="info" />
        <StatCard label="Total Seats" value={totalSeats} icon={Users} tone="default" hint={`${seatsUsed}% utilized`} progress={seatsUsed} />
        <StatCard label="Members" value={totalMembers} icon={Users} tone="success" hint="Active across all orgs" />
        <StatCard label="Plans" value={Object.keys(planCounts).length} icon={DollarSign} tone="default" hint="Distinct plan types" />
      </div>

      {/* Org table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Organizations</CardTitle>
          <CardDescription>Click an org to manage members and seats.</CardDescription>
        </CardHeader>
        <CardContent>
          {totalOrgs === 0 ? (
            <EmptyState
              icon="🏢"
              title="No organizations yet"
              hint="Orgs will appear here when teams self-register via /signup/b2b or when you create them."
              action={<Button asChild size="sm"><a href="/signup/b2b">Create Org</a></Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Organization</th>
                    <th className="text-left py-2 px-3 font-medium">Plan</th>
                    <th className="text-left py-2 px-3 font-medium">Seats</th>
                    <th className="text-left py-2 px-3 font-medium">Members</th>
                    <th className="text-left py-2 px-3 font-medium">Utilization</th>
                    <th className="text-left py-2 px-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs?.map((org) => {
                    const members = org._count?.members ?? 0;
                    const util = org.seats > 0 ? Math.round((members / org.seats) * 100) : 0;
                    return (
                      <tr key={org.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-foreground">{org.name}</div>
                          <div className="text-xs text-muted-foreground">/{org.slug}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="capitalize">{org.plan}</Badge>
                        </td>
                        <td className="py-2.5 px-3 tabular-nums">{org.seats}</td>
                        <td className="py-2.5 px-3 tabular-nums">{members}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full ${util >= 90 ? "bg-destructive" : util >= 70 ? "bg-growth-amber" : "bg-growth-sage"}`} style={{ width: `${Math.min(100, util)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">{util}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
