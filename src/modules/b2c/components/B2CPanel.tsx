"use client";
// src/components/examiner/admin/B2CPanel.tsx
// B2C management panel — individual learners, enrollment metrics, revenue.

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, RefreshCw, TrendingUp, Award, Activity } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { SkeletonPanel, EmptyState } from "@/components/ui/states";

interface B2CStats {
  totalLearners: number;
  activeToday: number;
  enrolledInCourses: number;
  completedCertificates: number;
  avgScore: number | null;
  completionRate: number;
}

interface RecentLearner {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLogin: string | null;
  _count?: { enrollments: number };
}

interface B2CData {
  stats: B2CStats;
  recentLearners: RecentLearner[];
}

export function B2CPanel() {
  const [data, setData] = useState<B2CData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.get<B2CData>("/api/admin/b2c-stats");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load B2C data");
      setData(null);
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

  if (!data) {
    return (
      <EmptyState
        icon="⚠️"
        title="Couldn't load B2C data"
        hint={error || "Unknown error"}
        action={<Button onClick={load} variant="outline" size="sm">Retry</Button>}
      />
    );
  }

  const { stats, recentLearners } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> B2C — Learners
          </h2>
          <p className="text-sm text-muted-foreground">Individual learners, enrollment metrics, and engagement.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Learners" value={stats.totalLearners} icon={Users} tone="info" />
        <StatCard label="Active Today" value={stats.activeToday} icon={Activity} tone={stats.activeToday > 0 ? "success" : "default"} hint="Logged in last 24h" />
        <StatCard label="Certificates" value={stats.completedCertificates} icon={Award} tone="default" hint="Issued to B2C learners" />
        <StatCard label="Avg Score" value={stats.avgScore !== null ? `${stats.avgScore}%` : "—"} icon={TrendingUp} tone="default" hint="Across all tests" />
      </div>

      {/* Recent learners */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Learners</CardTitle>
          <CardDescription>Newest individual learners (not in an org).</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLearners.length === 0 ? (
            <EmptyState
              icon="🎓"
              title="No learners yet"
              hint="Learners will appear here when they self-register via /for-learners."
              action={<Button asChild size="sm"><a href="/for-learners">View B2C Landing</a></Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Name</th>
                    <th className="text-left py-2 px-3 font-medium">Email</th>
                    <th className="text-left py-2 px-3 font-medium hidden sm:table-cell">Joined</th>
                    <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLearners.map((learner) => (
                    <tr key={learner.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition">
                      <td className="py-2.5 px-3 font-medium text-foreground">{learner.name}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{learner.email}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(learner.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground hidden md:table-cell">
                        {learner.lastLogin ? new Date(learner.lastLogin).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
